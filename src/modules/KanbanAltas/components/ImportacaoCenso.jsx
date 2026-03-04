import { useState } from 'react';
import * as XLSX from 'xlsx';
import { collection, getDocs, doc, writeBatch, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { toast } from 'react-toastify';

export default function ImportacaoCenso({ onClose, onImportSuccess }) {
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
      const qAtivos = query(collection(db, 'nexus_kanban_pacientes'));
      const snapshotAtivos = await getDocs(qAtivos);
      
      const pacientesNoBanco = new Map();
      snapshotAtivos.forEach(docSnap => {
        pacientesNoBanco.set(docSnap.data().uid, { idDocumento: docSnap.id, ...docSnap.data() });
      });

      setStatusText('Processando reconciliação (Apagando altas)...');
      
      const batch = writeBatch(db);
      const uidsNoRelatorioNovo = new Set();
      let novos = 0;
      let atualizados = 0;
      let excluidos = 0;

      // Ignora o cabeçalho (linha 0) do Excel
      const dadosValidos = jsonData.slice(1).filter(row => row[0] && row[0] !== "NM_PACIENTE");

      dadosValidos.forEach(row => {
        const nome = String(row[0] || '');
        const nasc = String(row[1] || '');
        const sexo = String(row[2] || '');
        const dataInt = String(row[3] || '');
        const setor = String(row[4] || '');
        const leito = String(row[6] || ''); 
        const especialidade = String(row[7] || '');

        if (!nome) return;

        const uid = generateUID(nome, nasc);
        uidsNoRelatorioNovo.add(uid);

        if (pacientesNoBanco.has(uid)) {
          const pacExistente = pacientesNoBanco.get(uid);
          const docRef = doc(db, 'nexus_kanban_pacientes', pacExistente.idDocumento);
          
          batch.update(docRef, {
            setor: setor,
            leito: leito,
            especialidade: especialidade,
            status: pacExistente.status === 'SINALIZADA' ? 'SINALIZADA' : 'ATIVO',
            ultimaAtualizacao: serverTimestamp()
          });
          atualizados++;
        } else {
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

      // DELEÇÃO DE QUEM NÃO ESTÁ MAIS NO RELATÓRIO
      pacientesNoBanco.forEach((paciente, uidMap) => {
        if (!uidsNoRelatorioNovo.has(uidMap)) {
          const docRef = doc(db, 'nexus_kanban_pacientes', paciente.idDocumento);
          batch.delete(docRef); // Apaga o documento do banco permanentemente
          excluidos++;
        }
      });

      // Atualiza o relógio da última sincronização
      const configRef = doc(db, 'nexus_kanban_config', 'metadata');
      batch.set(configRef, { 
        ultimaSincronizacao: serverTimestamp(),
        totalImportado: dadosValidos.length
      }, { merge: true });

      setStatusText('Salvando alterações no servidor...');
      await batch.commit();

      // Toast Customizado e Elegante (Sem Emojis)
      toast.success(
        <div className="flex flex-col gap-1.5 ml-1">
          <strong className="text-slate-800 text-sm tracking-tight">Sincronização Concluída</strong>
          <div className="flex flex-col gap-0.5 text-xs text-slate-600">
            <span><span className="font-bold text-sky-600 text-[13px]">{novos}</span> Novas Internações</span>
            <span><span className="font-bold text-emerald-600 text-[13px]">{atualizados}</span> Leitos Atualizados</span>
            <span><span className="font-bold text-rose-600 text-[13px]">{excluidos}</span> Pacientes Apagados (Alta)</span>
          </div>
        </div>, 
        { autoClose: 7000 }
      );

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
    e.target.value = null; 
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease-in-out]">
      
      {/* Container Principal do Modal */}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col md:flex-row overflow-hidden relative">
        
        {/* Botão Fechar */}
        <button 
          onClick={onClose}
          disabled={loading}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-colors z-10 disabled:opacity-50"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>

        {/* Coluna Esquerda: Instruções do Soul MV */}
        <div className="w-full md:w-1/2 bg-slate-50 p-8 border-r border-slate-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-sky-100 text-sky-600 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <h3 className="text-lg font-bold text-slate-800">Passo a Passo MV</h3>
          </div>
          
          <ol className="space-y-4 text-sm text-slate-600 relative border-l-2 border-slate-200 ml-3 pl-5">
            <li className="relative">
              <span className="absolute -left-[29px] bg-white border-2 border-slate-300 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-slate-500">1</span>
              Acesse o painel do Soul MV no link <a href="http://1495prd.cloudmv.com.br/Painel/" target="_blank" rel="noreferrer" className="text-sky-600 hover:underline font-medium">1495prd.cloudmv.com.br</a>
            </li>
            <li className="relative">
              <span className="absolute -left-[29px] bg-white border-2 border-slate-300 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-slate-500">2</span>
              Faça login com o usuário <strong>"nir"</strong> e senha <strong>"mvnir"</strong>
            </li>
            <li className="relative">
              <span className="absolute -left-[29px] bg-white border-2 border-slate-300 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-slate-500">3</span>
              Em "Indicadores", localize o painel <strong className="text-slate-800">"NIR - Ocupação Setores"</strong>
            </li>
            <li className="relative">
              <span className="absolute -left-[29px] bg-white border-2 border-slate-300 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-slate-500">4</span>
              Clique no ícone de banco de dados, depois em <strong>"Exportar"</strong>
            </li>
            <li className="relative">
              <span className="absolute -left-[29px] bg-white border-2 border-slate-300 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-slate-500">5</span>
              Selecione o formato <strong>"XLS"</strong> e clique no disquete para salvar
            </li>
            <li className="relative">
              <span className="absolute -left-[29px] bg-white border-2 border-sky-500 bg-sky-50 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-sky-600">6</span>
              <strong className="text-sky-700">Importe o arquivo salvo no quadro ao lado.</strong>
            </li>
          </ol>
        </div>

        {/* Coluna Direita: Área de Drop / Upload */}
        <div className="w-full md:w-1/2 p-8 flex flex-col items-center justify-center relative">
          
          {loading ? (
            <div className="flex flex-col items-center justify-center text-center animate-[fadeIn_0.2s_ease-in-out]">
              <div className="w-14 h-14 border-4 border-slate-200 border-t-sky-500 rounded-full animate-spin mb-4"></div>
              <h3 className="font-bold text-slate-800 text-lg">Processando Arquivo</h3>
              <p className="text-sm text-slate-500 mt-2">{statusText}</p>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-slate-800">Sincronização</h3>
                <p className="text-sm text-slate-500 mt-1">
                  O sistema fará a reconciliação automática e <strong>apagará do banco</strong> quem não estiver na planilha.
                </p>
              </div>

              <label className="w-full relative flex flex-col items-center justify-center border-2 border-dashed border-sky-300 bg-sky-50/50 rounded-2xl p-10 hover:bg-sky-50 hover:border-sky-500 transition-all cursor-pointer group">
                <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <svg className="w-8 h-8 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <span className="text-sm font-bold text-sky-700 text-center">Clique para buscar o arquivo<br/>ou arraste e solte aqui</span>
                <span className="text-xs font-medium text-slate-400 mt-3 bg-white px-3 py-1 rounded-full border border-slate-200 shadow-sm">Formato: .XLSX</span>
              </label>
            </>
          )}

        </div>
      </div>
    </div>
  );
}