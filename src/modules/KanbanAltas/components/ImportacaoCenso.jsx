import { useState } from 'react';
import * as XLSX from 'xlsx';
import { collection, getDocs, doc, writeBatch, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { toast } from 'react-toastify';

export default function ImportacaoCenso({ onImportSuccess }) {
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState('');

  // Função para gerar um UID único (Nome + Nascimento em Base64 simulado)
  const generateUID = (nome, nasc) => {
    const stringBase = `${nome.trim().toUpperCase()}_${nasc}`;
    return btoa(unescape(encodeURIComponent(stringBase))).replace(/[/+=]/g, ''); 
  };

  const processarExcel = async (jsonData) => {
    setLoading(true);
    setStatusText('Consultando pacientes ativos no banco de dados...');
    
    try {
      // 1. Busca todos os pacientes que estão ATIVOS no Firebase
      const qAtivos = query(collection(db, 'nexus_kanban_pacientes'), where('status', 'in', ['ATIVO', 'SINALIZADA']));
      const snapshotAtivos = await getDocs(qAtivos);
      
      const pacientesNoBanco = new Map();
      snapshotAtivos.forEach(docSnap => {
        pacientesNoBanco.set(docSnap.data().uid, { idDocumento: docSnap.id, ...docSnap.data() });
      });

      setStatusText('Processando reconciliação (Altas automáticas)...');
      
      const batch = writeBatch(db);
      const uidsNoRelatorioNovo = new Set();
      let novos = 0;
      let atualizados = 0;
      let altasAutomatica = 0;

      // Ignora o cabeçalho (linha 0) do Excel
      const dadosValidos = jsonData.slice(1).filter(row => row[0] && row[0] !== "NM_PACIENTE");

      // 2. Mapeia a planilha importada
      dadosValidos.forEach(row => {
        const nome = String(row[0] || '');
        const nasc = String(row[1] || '');
        const sexo = String(row[2] || '');
        const dataInt = String(row[3] || '');
        const setor = String(row[4] || '');
        const leito = String(row[6] || ''); // Pulando índice 5 conforme seu script original
        const especialidade = String(row[7] || '');

        if (!nome) return;

        const uid = generateUID(nome, nasc);
        uidsNoRelatorioNovo.add(uid);

        if (pacientesNoBanco.has(uid)) {
          // Paciente já existe: Atualiza Setor, Leito e garante que está ATIVO
          const pacExistente = pacientesNoBanco.get(uid);
          const docRef = doc(db, 'nexus_kanban_pacientes', pacExistente.idDocumento);
          
          batch.update(docRef, {
            setor: setor,
            leito: leito,
            especialidade: especialidade,
            status: pacExistente.status === 'SINALIZADA' ? 'SINALIZADA' : 'ATIVO', // Mantém sinalizada se já estiver
            ultimaAtualizacao: serverTimestamp()
          });
          atualizados++;
        } else {
          // Paciente Novo: Insere
          const novoDocRef = doc(collection(db, 'nexus_kanban_pacientes'));
          batch.set(novoDocRef, {
            uid: uid,
            nome: nome.toUpperCase(),
            nascimento: nasc,
            sexo: sexo,
            dataInternacao: dataInt,
            setor: setor,
            leito: leito,
            especialidade: especialidade,
            status: 'ATIVO',
            dataSisreg: '',
            numeroSisreg: '',
            historicoJson: '[]',
            criadoEm: serverTimestamp(),
            ultimaAtualizacao: serverTimestamp()
          });
          novos++;
        }
      });

      // 3. RECONCILIAÇÃO ESTRITA: Quem está no banco como ATIVO mas não veio no XLSX, recebe ALTA.
      pacientesNoBanco.forEach((paciente, uidMap) => {
        if (!uidsNoRelatorioNovo.has(uidMap)) {
          const docRef = doc(db, 'nexus_kanban_pacientes', paciente.idDocumento);
          batch.update(docRef, {
            status: 'ALTA',
            dataAlta: serverTimestamp(),
            ultimaAtualizacao: serverTimestamp()
          });
          altasAutomatica++;
        }
      });

      setStatusText('Salvando alterações no servidor...');
      await batch.commit();

      toast.success(
        <div className="flex flex-col">
          <strong>Sincronização Concluída!</strong>
          <span className="text-xs mt-1">+ {novos} Novas Internações</span>
          <span className="text-xs">~ {atualizados} Leitos Atualizados</span>
          <span className="text-xs text-emerald-300 font-bold">✓ {altasAutomatica} Altas Sistêmicas Executadas</span>
        </div>, 
        { autoClose: 6000 }
      );

      // Redireciona de volta para a aba do Painel Kanban
      if (onImportSuccess) onImportSuccess();

    } catch (error) {
      console.error(error);
      toast.error('Erro na sincronização: ' + error.message);
    } finally {
      setLoading(false);
      setStatusText('');
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const firstSheet = workbook.SheetNames[0];
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { header: 1 });
        
        processarExcel(jsonData);
      } catch (err) {
        toast.error('Falha ao ler o arquivo Excel.');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = null; // Limpa o input
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 relative">
      {/* Overlay de Loading Local */}
      {loading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-50/80 backdrop-blur-sm rounded-2xl">
          <div className="bg-nexus-card p-6 rounded-2xl shadow-xl flex flex-col items-center border border-nexus-border">
            <div className="w-12 h-12 border-4 border-nexus-border border-t-nexus-primary rounded-full animate-spin mb-4"></div>
            <h3 className="font-bold text-nexus-text">Sincronizando Censo</h3>
            <p className="text-xs text-nexus-text/60 mt-1">{statusText}</p>
          </div>
        </div>
      )}

      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 w-full max-w-lg text-center">
        <div className="bg-sky-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
        </div>
        <h3 className="text-xl font-bold text-slate-800">Importar Relatório de Internações</h3>
        <p className="text-sm text-slate-500 mt-2 mb-8">
          Selecione o arquivo <strong>.xlsx</strong> extraído do sistema Tasy para atualizar o mapa de leitos e calcular as altas automaticamente.
        </p>

        <label className="relative flex flex-col items-center justify-center border-2 border-dashed border-sky-300 rounded-xl p-8 hover:bg-sky-50 hover:border-sky-500 transition-all cursor-pointer group">
          <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" disabled={loading} />
          <svg className="w-10 h-10 text-sky-400 group-hover:text-sky-600 mb-3 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <span className="text-sm font-semibold text-sky-700 group-hover:text-sky-800">Clique ou arraste o arquivo aqui</span>
          <span className="text-xs text-slate-400 mt-1">Somente arquivos Excel (.xlsx)</span>
        </label>
      </div>
    </div>
  );
}