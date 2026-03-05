import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import ImportacaoCenso from './ImportacaoCenso';
import { toggleClinicalTag, updateProvavelAlta, removeProvavelAlta, updateFluxoTrauma, removeFluxoTrauma, updateMedications } from '../services/kanbanService';
import { gerarRelatorioRondas } from './utils/GeradorPDF';

const SETORES_URGENCIA = [
  "PS DECISÃO CIRURGICA",
  "PS DECISÃO CLINICA",
  "SALA DE EMERGENCIA",
  "SALA LARANJA"
];

const SETORES_OCULTOS = [
  "CC - PRE OPERATORIO",
  "CC - RECUPERAÇÃO",
  "CCA - SALAS CIRURGICAS"
];

// Helper para converter datas (DD/MM/YYYY ou YYYY-MM-DD)
const parseDate = (str) => {
  if (!str) return new Date();
  if (str instanceof Date) return str;
  const stringData = String(str).split(' ')[0];
  if (stringData.includes('/')) {
    const partes = stringData.split('/');
    return new Date(partes[2], partes[1] - 1, partes[0]);
  }
  const d = new Date(stringData);
  return isNaN(d.getTime()) ? new Date() : d;
};

export default function PainelKanban() {
  const [showImportModal, setShowImportModal] = useState(false);
  const [pacientes, setPacientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ultimaSinc, setUltimaSinc] = useState('Buscando...');

  // Estados dos Filtros
  const [busca, setBusca] = useState('');
  const [filtroSetor, setFiltroSetor] = useState('');
  const [filtroKanban, setFiltroKanban] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [filtroSisreg, setFiltroSisreg] = useState(false);
  const [filtroNotas, setFiltroNotas] = useState(false);

  const [filtroEmad, setFiltroEmad] = useState(false);
  const [filtroRetaguarda, setFiltroRetaguarda] = useState(false);
  const [filtroAlta, setFiltroAlta] = useState(false);
  const [filtroTrauma, setFiltroTrauma] = useState(false);

  // Estados dos Modais Interativos
  const [modalNotasPaciente, setModalNotasPaciente] = useState(null);
  const [novaNota, setNovaNota] = useState('');
  const [notaEmEdicao, setNotaEmEdicao] = useState(null);
  const [notaParaApagar, setNotaParaApagar] = useState(null);

  const [modalSisregPaciente, setModalSisregPaciente] = useState(null);
  const [formSisreg, setFormSisreg] = useState({ data: new Date().toISOString().split('T')[0], numero: '' });
  const [confirmarApagarSisreg, setConfirmarApagarSisreg] = useState(false);

  const [modalProvavelAlta, setModalProvavelAlta] = useState(null);
  const [pendenciaAlta, setPendenciaAlta] = useState('');
  const [modalDetalhesAlta, setModalDetalhesAlta] = useState(null);

  const [modalFluxoTrauma, setModalFluxoTrauma] = useState(null);
  const [descricaoTrauma, setDescricaoTrauma] = useState('');
  const [modalDetalhesTrauma, setModalDetalhesTrauma] = useState(null);

  // Estados dos Modais de Medicação
  const [modalMedicacoesPaciente, setModalMedicacoesPaciente] = useState(null);
  const [formMedicacao, setFormMedicacao] = useState({
    id: '',
    nome_medicacao: '',
    data_inicio: new Date().toISOString().split('T')[0],
    duracao_dias: ''
  });
  const [medicacaoParaApagar, setMedicacaoParaApagar] = useState(null);

  // 1. BUSCA EM TEMPO REAL NO FIREBASE
  useEffect(() => {
    const qPacientes = query(collection(db, 'nexus_kanban_pacientes'));
    const unsubPacientes = onSnapshot(qPacientes, (snap) => {
      const lista = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPacientes(lista);

      setModalNotasPaciente(prev => {
        if (!prev) return null;
        const pAtualizado = lista.find(p => p.id === prev.id);
        if (pAtualizado) {
          try { pAtualizado.notasArray = JSON.parse(pAtualizado.historicoJson || "[]"); } catch (e) { pAtualizado.notasArray = []; }
          return pAtualizado;
        }
        return null;
      });

      setModalMedicacoesPaciente(prev => {
        if (!prev) return null;
        return lista.find(p => p.id === prev.id) || null;
      });

      setLoading(false);
    });

    const unsubSinc = onSnapshot(doc(db, 'nexus_kanban_config', 'metadata'), (docSnap) => {
      if (docSnap.exists() && docSnap.data().ultimaSincronizacao) {
        const data = docSnap.data().ultimaSincronizacao.toDate();
        const dataFormatada = data.toLocaleDateString('pt-BR');
        const horaFormatada = data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        setUltimaSinc(`${dataFormatada} às ${horaFormatada}`);
      } else {
        setUltimaSinc('Nunca sincronizado');
      }
    });

    return () => {
      unsubPacientes();
      unsubSinc();
    };
  }, []);

  // 2. LÓGICA DE PROCESSAMENTO E FILTROS
  const { filtrados, kpis, setoresAgrupados, setoresDisponiveis } = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const counts = { verde: 0, amarelo: 0, vermelho: 0, laranja: 0, roxo: 0, preto: 0, sisreg: 0 };
    const listaSetores = new Set();
    const mapAgrupado = {};

    let dadosFiltrados = pacientes.filter(p => {
      if (SETORES_OCULTOS.includes(p.setor)) return false;

      const dInt = parseDate(p.dataInternacao);
      dInt.setHours(0, 0, 0, 0);
      const dias = Math.floor((hoje - dInt) / (1000 * 60 * 60 * 24));

      let pKanban = "verde";
      if (dias >= 2 && dias <= 3) pKanban = "amarelo";
      else if (dias > 3 && dias <= 7) pKanban = "vermelho";
      else if (dias > 7 && dias <= 15) pKanban = "laranja";
      else if (dias > 15 && dias <= 30) pKanban = "roxo";
      else if (dias > 30) pKanban = "preto";

      p.diasInternado = dias;
      p.corKanban = pKanban;

      const setorLimpo = String(p.setor).toUpperCase().trim();
      p.exigeSisreg = SETORES_URGENCIA.includes(setorLimpo);
      p.semSisreg = p.exigeSisreg && (!p.numeroSisreg || p.numeroSisreg.trim() === "");

      let notasArray = [];
      try { notasArray = JSON.parse(p.historicoJson || "[]"); } catch (e) { }
      p.temNotas = notasArray.length > 0;
      p.notasArray = notasArray;

      listaSetores.add(p.setor);

      let valid = true;
      if (busca && !p.nome.toLowerCase().includes(busca.toLowerCase()) && !String(p.leito).toLowerCase().includes(busca.toLowerCase())) valid = false;
      if (filtroSetor && p.setor !== filtroSetor) valid = false;
      if (filtroKanban && pKanban !== filtroKanban) valid = false;
      if (filtroSisreg && !p.semSisreg) valid = false;
      if (filtroNotas && !p.temNotas) valid = false;
      if (filtroEmad && !p.perfil_emad?.active) valid = false;
      if (filtroRetaguarda && !p.perfil_retaguarda?.active) valid = false;
      if (filtroAlta && !p.provavel_alta?.active) valid = false;
      if (filtroTrauma && !p.fluxo_trauma?.active) valid = false;
      if (dataInicio && dInt < new Date(dataInicio + "T00:00:00")) valid = false;
      if (dataFim && dInt > new Date(dataFim + "T23:59:59")) valid = false;

      if (valid) {
        counts[pKanban]++;
        if (p.semSisreg) counts.sisreg++;
      }

      return valid;
    });

    dadosFiltrados.sort((a, b) => String(a.leito).localeCompare(String(b.leito), undefined, { numeric: true, sensitivity: 'base' }));
    dadosFiltrados.forEach(p => {
      if (!mapAgrupado[p.setor]) mapAgrupado[p.setor] = [];
      mapAgrupado[p.setor].push(p);
    });

    return {
      filtrados: dadosFiltrados,
      kpis: counts,
      setoresAgrupados: mapAgrupado,
      setoresDisponiveis: Array.from(listaSetores).sort()
    };
  }, [pacientes, busca, filtroSetor, filtroKanban, dataInicio, dataFim, filtroSisreg, filtroNotas, filtroEmad, filtroRetaguarda, filtroAlta, filtroTrauma]);

  // 3. AÇÕES DE BANCO DE DADOS (NOTAS E SISREG)
  const salvarNota = async () => {
    if (!novaNota.trim()) return toast.warning("Digite uma anotação.");
    try {
      const docRef = doc(db, 'nexus_kanban_pacientes', modalNotasPaciente.id);
      let novasNotas = [...modalNotasPaciente.notasArray];

      if (notaEmEdicao !== null) {
        novasNotas[notaEmEdicao].texto = novaNota.trim();
        novasNotas[notaEmEdicao].editadaEm = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      } else {
        novasNotas.unshift({
          data: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
          usuario: "Usuário Atual",
          texto: novaNota.trim()
        });
      }

      await updateDoc(docRef, { historicoJson: JSON.stringify(novasNotas) });
      toast.success(notaEmEdicao !== null ? "Nota atualizada!" : "Nota salva com sucesso!");
      setNovaNota('');
      setNotaEmEdicao(null);
    } catch (error) { toast.error("Erro ao salvar nota."); }
  };

  const iniciarEdicaoNota = (index, texto) => {
    setNotaEmEdicao(index);
    setNovaNota(texto);
  };

  const cancelarEdicaoNota = () => {
    setNotaEmEdicao(null);
    setNovaNota('');
  };

  const confirmarApagarAnotacao = async () => {
    if (notaParaApagar === null) return;
    try {
      const docRef = doc(db, 'nexus_kanban_pacientes', modalNotasPaciente.id);
      const novasNotas = [...modalNotasPaciente.notasArray];
      novasNotas.splice(notaParaApagar, 1);
      await updateDoc(docRef, { historicoJson: JSON.stringify(novasNotas) });
      toast.success("Nota apagada.");
      if (notaEmEdicao === notaParaApagar) cancelarEdicaoNota();
    } catch (error) {
      toast.error("Erro ao apagar nota.");
    } finally {
      setNotaParaApagar(null);
    }
  };

  const abrirModalSisregParaEdicao = (p) => {
    let dataFormatada = new Date().toISOString().split('T')[0];
    if (p.dataSisreg) {
      const partes = p.dataSisreg.split('/');
      dataFormatada = `${partes[2]}-${partes[1]}-${partes[0]}`;
    }
    setFormSisreg({ data: dataFormatada, numero: p.numeroSisreg });
    setModalSisregPaciente(p);
  };

  const salvarSisreg = async () => {
    if (!formSisreg.data || !formSisreg.numero) return toast.warning("Preencha a data e o número.");
    try {
      const docRef = doc(db, 'nexus_kanban_pacientes', modalSisregPaciente.id);
      const partes = formSisreg.data.split("-");
      const dataFormatada = `${partes[2]}/${partes[1]}/${partes[0]}`;

      await updateDoc(docRef, {
        dataSisreg: dataFormatada,
        numeroSisreg: formSisreg.numero.trim().toUpperCase()
      });
      toast.success("SISREG salvo com sucesso!");
      setModalSisregPaciente(null);
    } catch (error) { toast.error("Erro ao salvar SISREG."); }
  };

  const apagarSisreg = async () => {
    try {
      const docRef = doc(db, 'nexus_kanban_pacientes', modalSisregPaciente.id);
      await updateDoc(docRef, {
        dataSisreg: "",
        numeroSisreg: ""
      });
      toast.success("SISREG apagado com sucesso.");
      setModalSisregPaciente(null);
      setConfirmarApagarSisreg(false);
    } catch (error) { toast.error("Erro ao apagar SISREG."); }
  };

  // 4. AÇÕES DE BANCO DE DADOS (MEDICAÇÕES)
  const salvarMedicacao = async () => {
    if (!formMedicacao.nome_medicacao.trim() || !formMedicacao.data_inicio || !formMedicacao.duracao_dias) {
      return toast.warning("Preencha todos os campos da medicação.");
    }

    try {
      const p = pacientes.find(pat => pat.id === modalMedicacoesPaciente.id);
      if (!p) return;

      let currentMedications = p.medicacoes_curso || [];
      let newMedications;

      if (formMedicacao.id) {
        // Edição
        newMedications = currentMedications.map(med =>
          med.id === formMedicacao.id ? { ...med, ...formMedicacao } : med
        );
      } else {
        // Inclusão
        newMedications = [
          ...currentMedications,
          {
            id: crypto.randomUUID(),
            nome_medicacao: formMedicacao.nome_medicacao.trim(),
            data_inicio: formMedicacao.data_inicio,
            duracao_dias: parseInt(formMedicacao.duracao_dias)
          }
        ];
      }

      await updateMedications(modalMedicacoesPaciente.id, newMedications);
      toast.success(formMedicacao.id ? "Medicação atualizada!" : "Medicação salva com sucesso!");

      // Reset form
      setFormMedicacao({
        id: '',
        nome_medicacao: '',
        data_inicio: new Date().toISOString().split('T')[0],
        duracao_dias: ''
      });

    } catch (error) {
      toast.error("Erro ao salvar medicação.");
    }
  };

  const iniciarEdicaoMedicacao = (med) => {
    setFormMedicacao({
      id: med.id,
      nome_medicacao: med.nome_medicacao,
      data_inicio: med.data_inicio,
      duracao_dias: med.duracao_dias
    });
  };

  const cancelarEdicaoMedicacao = () => {
    setFormMedicacao({
      id: '',
      nome_medicacao: '',
      data_inicio: new Date().toISOString().split('T')[0],
      duracao_dias: ''
    });
  };

  const confirmarApagarMedicacao = async () => {
    if (!medicacaoParaApagar) return;
    try {
      const p = pacientes.find(pat => pat.id === modalMedicacoesPaciente.id);
      if (!p) return;

      const newMedications = (p.medicacoes_curso || []).filter(med => med.id !== medicacaoParaApagar.id);

      await updateMedications(modalMedicacoesPaciente.id, newMedications);
      toast.success("Medicação apagada com sucesso.");

    } catch (error) {
      toast.error("Erro ao apagar medicação.");
    } finally {
      setMedicacaoParaApagar(null);
    }
  };

  const calcularDiasPassados = (dataInicio) => {
    const inicio = new Date(dataInicio + "T00:00:00");
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const diffTime = Math.max(0, hoje - inicio);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const coresMap = {
    verde: "border-emerald-500 bg-emerald-50",
    amarelo: "border-amber-500 bg-amber-50",
    vermelho: "border-red-500 bg-red-50",
    laranja: "border-orange-500 bg-orange-50",
    roxo: "border-purple-500 bg-purple-50",
    preto: "border-slate-800 bg-slate-200",
    alta: "border-slate-400 bg-slate-100"
  };

  return (
    <div className="flex flex-col h-full gap-6 text-nexus-text relative">

      {/* ToastContainer Configurado para Tema LIGHT (Sem o verde fluorescente) */}
      <ToastContainer position="top-right" theme="light" />

      {/* Barra Superior */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="text-center sm:text-left w-full sm:w-auto">
          <h2 className="text-lg font-bold text-slate-800">Monitoramento de Fluxo</h2>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-sm text-slate-500 mt-0.5">
            <span>Censo atual: <strong className="text-slate-700">{filtrados.length}</strong> pacientes.</span>
            <span className="hidden sm:inline text-slate-300">|</span>
            <span className="flex items-center justify-center gap-1.5 bg-slate-100 px-2 py-0.5 rounded-md text-xs border border-slate-200">
              <svg className="w-3.5 h-3.5 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              Sincronizado: <strong className="text-slate-600">{ultimaSinc}</strong>
            </span>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-3">
          <button onClick={() => toast.info('Funcionalidade em desenvolvimento: Integração RPA para inclusão automática de pedidos de internação em lote no SISREG.')} className="bg-slate-100 border border-indigo-100 hover:bg-indigo-50 text-indigo-800 px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 shrink-0">
            <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            Inclusão SISREG (RPA)
          </button>
          <button onClick={() => gerarRelatorioRondas(pacientes)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
            Relatório Rondas
          </button>
          <button onClick={() => setShowImportModal(true)} className="bg-sky-600 hover:bg-sky-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md transition-all flex items-center gap-2 shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            Sincronizar Censo
          </button>
        </div>
      </div>

      {/* Grid de KPIs */}
      <div className={`grid grid-cols-2 md:grid-cols-3 ${filtroSisreg || kpis.sisreg > 0 ? 'lg:grid-cols-7' : 'lg:grid-cols-6'} gap-3 transition-all duration-300`}>
        <div className="bg-white p-3 rounded-xl shadow-sm border-b-4 border-emerald-500 flex flex-col justify-between">
          <p className="text-[10px] font-bold text-slate-400 uppercase leading-tight">&lt; 48h internado</p>
          <h2 className="text-2xl font-black text-slate-700 mt-2">{loading ? '...' : kpis.verde}</h2>
        </div>
        <div className="bg-white p-3 rounded-xl shadow-sm border-b-4 border-amber-500 flex flex-col justify-between">
          <p className="text-[10px] font-bold text-slate-400 uppercase leading-tight">Entre 48h e 72h</p>
          <h2 className="text-2xl font-black text-slate-700 mt-2">{loading ? '...' : kpis.amarelo}</h2>
        </div>
        <div className="bg-white p-3 rounded-xl shadow-sm border-b-4 border-red-500 flex flex-col justify-between">
          <p className="text-[10px] font-bold text-slate-400 uppercase leading-tight">&gt; 72h internado</p>
          <h2 className="text-2xl font-black text-slate-700 mt-2">{loading ? '...' : kpis.vermelho}</h2>
        </div>
        <div className="bg-white p-3 rounded-xl shadow-sm border-b-4 border-orange-500 flex flex-col justify-between">
          <p className="text-[10px] font-bold text-slate-400 uppercase leading-tight">&gt; 7 dias internado</p>
          <h2 className="text-2xl font-black text-slate-700 mt-2">{loading ? '...' : kpis.laranja}</h2>
        </div>
        <div className="bg-white p-3 rounded-xl shadow-sm border-b-4 border-purple-500 flex flex-col justify-between">
          <p className="text-[10px] font-bold text-slate-400 uppercase leading-tight">&gt; 15 dias internado</p>
          <h2 className="text-2xl font-black text-slate-700 mt-2">{loading ? '...' : kpis.roxo}</h2>
        </div>
        <div className="bg-white p-3 rounded-xl shadow-sm border-b-4 border-slate-800 flex flex-col justify-between">
          <p className="text-[10px] font-bold text-slate-400 uppercase leading-tight">&gt; 30 dias internado</p>
          <h2 className="text-2xl font-black text-slate-700 mt-2">{loading ? '...' : kpis.preto}</h2>
        </div>
        {(filtroSisreg || kpis.sisreg > 0) && (
          <div className="bg-indigo-50 p-3 rounded-xl shadow-sm border-b-4 border-indigo-500 flex flex-col justify-between animate-[fadeIn_0.3s_ease-in]">
            <p className="text-[10px] font-bold text-indigo-600 uppercase leading-tight flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              Falta SISREG
            </p>
            <h2 className="text-2xl font-black text-indigo-700 mt-2">{loading ? '...' : kpis.sisreg}</h2>
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200 grid grid-cols-2 md:grid-cols-6 gap-3 sm:gap-4">
        <div className="col-span-2 md:col-span-1 relative">
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Paciente / Leito</label>
          <input type="text" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar..." className="w-full p-2 sm:p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-sky-500 outline-none" />
        </div>
        <div className="col-span-2 md:col-span-1">
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Setor</label>
          <select value={filtroSetor} onChange={e => setFiltroSetor(e.target.value)} className="w-full p-2 sm:p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 outline-none">
            <option value="">Todos os Setores</option>
            {setoresDisponiveis.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="col-span-2 md:col-span-1">
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Status Kanban</label>
          <select value={filtroKanban} onChange={e => setFiltroKanban(e.target.value)} className="w-full p-2 sm:p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 outline-none">
            <option value="">Todos os Tempos</option>
            <option value="verde">🟢 &lt; 48h de int.</option>
            <option value="amarelo">🟡 Entre 48h e 72h</option>
            <option value="vermelho">🔴 &gt; 72h de int.</option>
            <option value="laranja">🟠 &gt; 7 dias de int.</option>
            <option value="roxo">🟣 &gt; 15 dias de int.</option>
            <option value="preto">⚫ &gt; 30 dias de int.</option>
          </select>
        </div>
        <div className="col-span-1 md:col-span-1">
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Internação De:</label>
          <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="w-full p-2 sm:p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 outline-none" />
        </div>
        <div className="col-span-1 md:col-span-1">
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Até:</label>
          <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="w-full p-2 sm:p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 outline-none" />
        </div>

        {/* Toggles Interativos com visual de Switch */}
        <div className="col-span-2 md:col-span-6 border-t pt-3 md:pt-4">
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Filtros Rápidos</label>
          <div className="flex flex-wrap gap-4 sm:gap-6">
            <label className="flex items-center cursor-pointer gap-2 group">
              <div className="relative">
                <input type="checkbox" checked={filtroSisreg} onChange={() => setFiltroSisreg(!filtroSisreg)} className="sr-only" />
                <div className={`block w-10 h-5 rounded-full transition-colors ${filtroSisreg ? 'bg-rose-500' : 'bg-slate-300'}`}></div>
                <div className={`dot absolute left-1 top-0.5 bg-white w-4 h-4 rounded-full transition-transform ${filtroSisreg ? 'transform translate-x-4' : ''} shadow-sm`}></div>
              </div>
              <span className={`text-[10px] font-black uppercase tracking-wider transition-colors ${filtroSisreg ? 'text-rose-600' : 'text-slate-400 group-hover:text-slate-600'}`}>Sem Sisreg</span>
            </label>
            <label className="flex items-center cursor-pointer gap-2 group">
              <div className="relative">
                <input type="checkbox" checked={filtroNotas} onChange={() => setFiltroNotas(!filtroNotas)} className="sr-only" />
                <div className={`block w-10 h-5 rounded-full transition-colors ${filtroNotas ? 'bg-blue-500' : 'bg-slate-300'}`}></div>
                <div className={`dot absolute left-1 top-0.5 bg-white w-4 h-4 rounded-full transition-transform ${filtroNotas ? 'transform translate-x-4' : ''} shadow-sm`}></div>
              </div>
              <span className={`text-[10px] font-black uppercase tracking-wider transition-colors ${filtroNotas ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'}`}>Com Notas</span>
            </label>

            <label className="flex items-center cursor-pointer gap-2 group border-l pl-4 sm:pl-6 border-slate-200">
              <div className="relative">
                <input type="checkbox" checked={filtroEmad} onChange={() => setFiltroEmad(!filtroEmad)} className="sr-only" />
                <div className={`block w-10 h-5 rounded-full transition-colors ${filtroEmad ? 'bg-sky-500' : 'bg-slate-300'}`}></div>
                <div className={`dot absolute left-1 top-0.5 bg-white w-4 h-4 rounded-full transition-transform ${filtroEmad ? 'transform translate-x-4' : ''} shadow-sm`}></div>
              </div>
              <span className={`text-[10px] font-black uppercase tracking-wider transition-colors ${filtroEmad ? 'text-sky-600' : 'text-slate-400 group-hover:text-slate-600'}`}>Perfil EMAD</span>
            </label>
            <label className="flex items-center cursor-pointer gap-2 group">
              <div className="relative">
                <input type="checkbox" checked={filtroRetaguarda} onChange={() => setFiltroRetaguarda(!filtroRetaguarda)} className="sr-only" />
                <div className={`block w-10 h-5 rounded-full transition-colors ${filtroRetaguarda ? 'bg-purple-500' : 'bg-slate-300'}`}></div>
                <div className={`dot absolute left-1 top-0.5 bg-white w-4 h-4 rounded-full transition-transform ${filtroRetaguarda ? 'transform translate-x-4' : ''} shadow-sm`}></div>
              </div>
              <span className={`text-[10px] font-black uppercase tracking-wider transition-colors ${filtroRetaguarda ? 'text-purple-600' : 'text-slate-400 group-hover:text-slate-600'}`}>Retaguarda</span>
            </label>
            <label className="flex items-center cursor-pointer gap-2 group">
              <div className="relative">
                <input type="checkbox" checked={filtroAlta} onChange={() => setFiltroAlta(!filtroAlta)} className="sr-only" />
                <div className={`block w-10 h-5 rounded-full transition-colors ${filtroAlta ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                <div className={`dot absolute left-1 top-0.5 bg-white w-4 h-4 rounded-full transition-transform ${filtroAlta ? 'transform translate-x-4' : ''} shadow-sm`}></div>
              </div>
              <span className={`text-[10px] font-black uppercase tracking-wider transition-colors ${filtroAlta ? 'text-emerald-600' : 'text-slate-400 group-hover:text-slate-600'}`}>Provável Alta</span>
            </label>
            <label className="flex items-center cursor-pointer gap-2 group border-l pl-4 sm:pl-6 border-slate-200">
              <div className="relative">
                <input type="checkbox" checked={filtroTrauma} onChange={() => setFiltroTrauma(!filtroTrauma)} className="sr-only" />
                <div className={`block w-10 h-5 rounded-full transition-colors ${filtroTrauma ? 'bg-amber-500' : 'bg-slate-300'}`}></div>
                <div className={`dot absolute left-1 top-0.5 bg-white w-4 h-4 rounded-full transition-transform ${filtroTrauma ? 'transform translate-x-4' : ''} shadow-sm`}></div>
              </div>
              <span className={`text-[10px] font-black uppercase tracking-wider transition-colors ${filtroTrauma ? 'text-amber-600' : 'text-slate-400 group-hover:text-slate-600'}`}>Fluxo Trauma</span>
            </label>
          </div>
        </div>
      </div>

      {/* Lista de Pacientes agrupada por Setor */}
      <div className="space-y-6 pb-12">
        {loading ? (
          <div className="text-center py-12 text-slate-400"><div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>Carregando pacientes...</div>
        ) : Object.keys(setoresAgrupados).length === 0 ? (
          <div className="text-center py-12 text-slate-400 bg-white border border-dashed border-slate-300 rounded-2xl">Nenhum paciente encontrado com os filtros atuais.</div>
        ) : (
          Object.keys(setoresAgrupados).sort().map(setor => (
            <div key={setor}>
              <div className="flex items-center gap-2 mb-3 border-b-2 border-slate-200 pb-1">
                <svg className="w-5 h-5 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest">{setor}</h3>
                <span className="bg-slate-200 text-slate-600 text-[10px] px-2 py-0.5 rounded-full font-bold ml-2">{setoresAgrupados[setor].length}</span>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {setoresAgrupados[setor].map(p => (
                  <div key={p.id} className={`border-y border-r border-l-[12px] shadow-sm rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:shadow-md transition-all ${coresMap[p.status === 'SINALIZADA' ? 'alta' : p.corKanban]}`}>

                    <div className="flex-1 w-full">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="bg-slate-800 text-white text-[11px] font-black px-2.5 py-0.5 rounded shadow-sm shrink-0">{p.leito}</span>
                        <h3 className="font-bold text-slate-800 text-sm sm:text-base uppercase">{p.nome}</h3>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600 mt-1.5">
                        <span className="flex items-center gap-1"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg> Nasc: {p.nascimento}</span>
                        <span className="flex items-center gap-1 font-medium"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg> {p.especialidade || 'NÃO INFORMADA'}</span>
                        <span className={`flex items-center gap-1 ${p.diasInternado > 3 ? 'text-red-600 font-bold' : ''}`}>
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          {p.diasInternado} dias internado
                        </span>
                      </div>

                      {/* Botões de Ações Rápidas Resumidos e Otimizados para Mobile */}
                      <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-100/50 w-full">
                        <button onClick={() => toggleClinicalTag(p.id, 'perfil_emad', !p.perfil_emad?.active)} className={`flex items-center justify-center gap-1.5 p-2 sm:px-3 sm:py-1.5 rounded-lg text-[10px] sm:text-[10px] font-black transition-all border shadow-sm ${p.perfil_emad?.active ? 'bg-sky-50 text-sky-700 border-sky-300 ring-1 ring-sky-100' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`} title="Perfil EMAD">
                          <svg className="w-5 h-5 sm:w-3.5 sm:h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                          <span className="hidden sm:inline">EMAD</span>
                        </button>

                        <button onClick={() => toggleClinicalTag(p.id, 'perfil_retaguarda', !p.perfil_retaguarda?.active)} className={`flex items-center justify-center gap-1.5 p-2 sm:px-3 sm:py-1.5 rounded-lg text-[10px] sm:text-[10px] font-black transition-all border shadow-sm ${p.perfil_retaguarda?.active ? 'bg-purple-50 text-purple-700 border-purple-300 ring-1 ring-purple-100' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`} title="Perfil Retaguarda">
                          <svg className="w-5 h-5 sm:w-3.5 sm:h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                          <span className="hidden sm:inline">RETAGUARDA</span>
                        </button>

                        <button onClick={() => { p.provavel_alta?.active ? setModalDetalhesAlta(p) : setModalProvavelAlta(p) }} className={`flex items-center justify-center gap-1.5 p-2 sm:px-3 sm:py-1.5 rounded-lg text-[10px] sm:text-[10px] font-black transition-all border shadow-sm ${p.provavel_alta?.active ? 'bg-emerald-50 text-emerald-700 border-emerald-300 ring-1 ring-emerald-100' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`} title="Provável Alta">
                          <svg className="w-5 h-5 sm:w-3.5 sm:h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          <span className="hidden sm:inline">PROVÁVEL ALTA</span>
                        </button>

                        <button onClick={() => { p.fluxo_trauma?.active ? setModalDetalhesTrauma(p) : setModalFluxoTrauma(p) }} className={`flex items-center justify-center gap-1.5 p-2 sm:px-3 sm:py-1.5 rounded-lg text-[10px] sm:text-[10px] font-black transition-all border shadow-sm ${p.fluxo_trauma?.active ? 'bg-amber-50 text-amber-700 border-amber-300 ring-1 ring-amber-100' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`} title="Fluxo Trauma">
                          <svg className="w-5 h-5 sm:w-3.5 sm:h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                          <span className="hidden sm:inline">TRAUMA</span>
                        </button>

                        {/* Botão de Monitoramento de Medicações */}
                        <button onClick={() => setModalMedicacoesPaciente(p)} className={`flex items-center justify-center gap-1.5 p-2 sm:px-3 sm:py-1.5 rounded-lg text-[10px] sm:text-[10px] font-black transition-all border shadow-sm relative group ${p.medicacoes_curso?.length > 0 ? 'bg-indigo-50 text-indigo-700 border-indigo-300 ring-1 ring-indigo-100' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`} title="Medicações em Curso">
                          <svg className="w-5 h-5 sm:w-3.5 sm:h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.6 4.4a5 5 0 117.07 7.07l-6.26 6.26a5 5 0 11-7.07-7.07l6.26-6.26z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.5 15.5l7-7" />
                          </svg>
                          <span className="hidden sm:inline">MEDICAÇÕES</span>
                          {p.medicacoes_curso?.length > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 bg-indigo-500 text-white text-[9px] w-4 h-4 flex items-center justify-center rounded-full shadow-sm ring-2 ring-indigo-50">{p.medicacoes_curso.length}</span>
                          )}
                        </button>
                      </div>

                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto justify-end shrink-0">
                      {p.exigeSisreg && (
                        p.semSisreg ? (
                          <button onClick={() => abrirModalSisregParaEdicao(p)} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-rose-50 border border-red-200 text-red-600 hover:bg-rose-600 hover:text-white px-3 py-2 rounded-lg transition-all text-[10px] font-black shadow-sm animate-pulse">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                            INCLUIR SISREG
                          </button>
                        ) : (
                          <button onClick={() => abrirModalSisregParaEdicao(p)} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300 px-3 py-1.5 rounded-lg text-[10px] font-black transition-colors group" title="Clique para editar SISREG">
                            <svg className="w-4 h-4 text-indigo-500 group-hover:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            <svg className="w-4 h-4 text-indigo-500 hidden group-hover:block" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            <div className="flex flex-col leading-none text-left">
                              <span className="text-[8px] uppercase font-bold text-indigo-400">Sisreg Solicitado</span>
                              <span>Nº {p.numeroSisreg}</span>
                            </div>
                          </button>
                        )
                      )}

                      <button onClick={() => setModalNotasPaciente(p)} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white hover:bg-sky-50 text-sky-600 px-4 py-2 rounded-lg transition-all text-[10px] font-black shadow-sm relative border border-sky-200">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        <span>NOTAS DA EQUIPE</span>
                        {p.temNotas && <span className="absolute -top-2 -right-2 bg-sky-600 text-white text-[9px] w-5 h-5 flex items-center justify-center rounded-full border-2 border-white shadow-sm">{p.notasArray.length}</span>}
                      </button>
                    </div>

                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Importação XLSX */}
      {showImportModal && <ImportacaoCenso onClose={() => setShowImportModal(false)} onImportSuccess={() => setShowImportModal(false)} />}

      {/* Modal Incluir/Editar SISREG */}
      {modalSisregPaciente && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">

          {/* Modal Sobreposto de Confirmação de Exclusão do SISREG */}
          {confirmarApagarSisreg && (
            <div className="absolute inset-0 z-[10010] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 rounded-2xl animate-[fadeIn_0.2s_ease-in-out]">
              <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center">
                <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Excluir SISREG?</h3>
                <p className="text-slate-500 text-sm mb-6">
                  O paciente voltará para a fila de pendência de regulação. Confirma a exclusão?
                </p>
                <div className="flex w-full gap-3">
                  <button onClick={() => setConfirmarApagarSisreg(false)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2.5 rounded-xl transition-colors">Cancelar</button>
                  <button onClick={apagarSisreg} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 rounded-xl transition-shadow shadow-md shadow-red-600/20">Excluir Registro</button>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-[fadeIn_0.2s_ease-in-out]">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3 mb-4">
              <h3 className="text-lg font-bold text-slate-800">{formSisreg.numero ? 'Editar' : 'Incluir'} Pedido SISREG</h3>
              {formSisreg.numero && (
                <button onClick={() => setConfirmarApagarSisreg(true)} className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors" title="Apagar SISREG">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              )}
            </div>

            <p className="text-xs text-slate-500 mb-4">Paciente: <strong className="text-slate-800">{modalSisregPaciente.nome}</strong></p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Data da Solicitação</label>
                <input type="date" value={formSisreg.data} onChange={e => setFormSisreg({ ...formSisreg, data: e.target.value })} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm bg-slate-50" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Número do SISREG</label>
                <input type="text" placeholder="Ex: 123456789" value={formSisreg.numero} onChange={e => setFormSisreg({ ...formSisreg, numero: e.target.value.replace(/\D/g, '') })} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-mono tracking-widest bg-slate-50" />
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setModalSisregPaciente(null)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2.5 rounded-xl transition-colors">Cancelar</button>
              <button onClick={salvarSisreg} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl transition-shadow shadow-md">Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Registrar Provável Alta */}
      {modalProvavelAlta && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-[fadeIn_0.2s_ease-in-out]">
            <h3 className="text-lg font-bold text-slate-800 border-b pb-3 mb-4">Registrar Provável Alta</h3>
            <p className="text-xs text-slate-500 mb-4">Paciente: <strong className="text-slate-800">{modalProvavelAlta.nome}</strong></p>

            <div className="mb-6">
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Pendência para a alta</label>
              <textarea
                value={pendenciaAlta}
                onChange={(e) => setPendenciaAlta(e.target.value)}
                placeholder="Ex: Aguardando exames laboratoriais..."
                className="w-full p-3 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 resize-none h-24"
              ></textarea>
            </div>

            <div className="flex gap-3">
              <button onClick={() => { setModalProvavelAlta(null); setPendenciaAlta(''); }} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2.5 rounded-xl transition-colors">Cancelar</button>
              <button
                onClick={async () => {
                  if (!pendenciaAlta.trim()) { return toast.warning("Informe a pendência da alta."); }
                  try {
                    await updateProvavelAlta(modalProvavelAlta.id, pendenciaAlta.trim());
                    toast.success("Provável alta registrada!");
                    setModalProvavelAlta(null);
                    setPendenciaAlta('');
                  } catch (e) { }
                }}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl transition-shadow shadow-md"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalhes Provável Alta */}
      {modalDetalhesAlta && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-[fadeIn_0.2s_ease-in-out]">
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Provável Alta
              </h3>
              <button onClick={() => setModalDetalhesAlta(null)} className="text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 p-1.5 rounded-full transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-4">Paciente: <strong className="text-slate-800">{modalDetalhesAlta.nome}</strong></p>

            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 mb-6">
              <p className="text-[10px] font-bold text-emerald-600 uppercase mb-1">Pendência Registrada:</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{modalDetalhesAlta.provavel_alta?.pendencia || 'Nenhuma pendência especificada.'}</p>
              {modalDetalhesAlta.provavel_alta?.timestamp && (
                <p className="text-[9px] text-slate-400 mt-2 text-right">
                  Registrado em: {modalDetalhesAlta.provavel_alta.timestamp?.toDate ? modalDetalhesAlta.provavel_alta.timestamp.toDate().toLocaleString('pt-BR') : 'Tempo real'}
                </p>
              )}
            </div>

            <button
              onClick={async () => {
                try {
                  await removeProvavelAlta(modalDetalhesAlta.id);
                  toast.success("Tag de alta removida!");
                  setModalDetalhesAlta(null);
                } catch (e) { }
              }}
              className="w-full bg-red-50 hover:bg-red-600 text-red-600 hover:text-white font-bold py-2.5 rounded-xl transition-colors border border-red-200 hover:border-red-600 flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              Remover Tag de Alta
            </button>
          </div>
        </div>
      )}

      {/* Modal Registrar Fluxo Trauma */}
      {modalFluxoTrauma && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-[fadeIn_0.2s_ease-in-out]">
            <h3 className="text-lg font-bold text-slate-800 border-b pb-3 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              Registrar Fluxo Trauma
            </h3>
            <p className="text-xs text-slate-500 mb-4">Paciente: <strong className="text-slate-800">{modalFluxoTrauma.nome}</strong></p>

            <div className="mb-6">
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Descrição do Trauma</label>
              <textarea
                value={descricaoTrauma}
                onChange={(e) => setDescricaoTrauma(e.target.value)}
                placeholder="Ex: Fratura de Fêmur..."
                className="w-full p-3 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-500 bg-slate-50 resize-none h-24"
              ></textarea>
            </div>

            <div className="flex gap-3">
              <button onClick={() => { setModalFluxoTrauma(null); setDescricaoTrauma(''); }} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2.5 rounded-xl transition-colors">Cancelar</button>
              <button
                onClick={async () => {
                  if (!descricaoTrauma.trim()) { return toast.warning("Informe a descrição do trauma."); }
                  try {
                    await updateFluxoTrauma(modalFluxoTrauma.id, descricaoTrauma.trim());
                    toast.success("Trauma registrado!");
                    setModalFluxoTrauma(null);
                    setDescricaoTrauma('');
                  } catch (e) { }
                }}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 rounded-xl transition-shadow shadow-md"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalhes Fluxo Trauma */}
      {modalDetalhesTrauma && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-[fadeIn_0.2s_ease-in-out]">
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                Fluxo Trauma
              </h3>
              <button onClick={() => setModalDetalhesTrauma(null)} className="text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 p-1.5 rounded-full transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-4">Paciente: <strong className="text-slate-800">{modalDetalhesTrauma.nome}</strong></p>

            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 mb-6">
              <p className="text-[10px] font-bold text-amber-600 uppercase mb-1">Descrição Registrada:</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{modalDetalhesTrauma.fluxo_trauma?.descricao || 'Nenhuma descrição especificada.'}</p>
              {modalDetalhesTrauma.fluxo_trauma?.timestamp && (
                <p className="text-[9px] text-slate-400 mt-2 text-right">
                  Registrado em: {modalDetalhesTrauma.fluxo_trauma.timestamp?.toDate ? modalDetalhesTrauma.fluxo_trauma.timestamp.toDate().toLocaleString('pt-BR') : 'Tempo real'}
                </p>
              )}
            </div>

            <button
              onClick={async () => {
                try {
                  await removeFluxoTrauma(modalDetalhesTrauma.id);
                  toast.success("Tag de trauma removida!");
                  setModalDetalhesTrauma(null);
                } catch (e) { }
              }}
              className="w-full bg-red-50 hover:bg-red-600 text-red-600 hover:text-white font-bold py-2.5 rounded-xl transition-colors border border-red-200 hover:border-red-600 flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              Remover Fluxo Trauma
            </button>
          </div>
        </div>
      )}

      {/* Modal Notas da Equipe */}
      {modalNotasPaciente && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">

          {/* Modal Sobreposto de Confirmação de Exclusão da Nota */}
          {notaParaApagar !== null && (
            <div className="absolute inset-0 z-[10010] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 rounded-2xl animate-[fadeIn_0.2s_ease-in-out]">
              <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center">
                <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Excluir Anotação?</h3>
                <p className="text-slate-500 text-sm mb-6">
                  Tem certeza que deseja excluir esta nota permanentemente? Esta ação não pode ser desfeita.
                </p>
                <div className="flex w-full gap-3">
                  <button onClick={() => setNotaParaApagar(null)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2.5 rounded-xl transition-colors">Cancelar</button>
                  <button onClick={confirmarApagarAnotacao} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 rounded-xl transition-shadow shadow-md shadow-red-600/20">Excluir</button>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] animate-[fadeIn_0.2s_ease-in-out] relative w-full sm:w-[500px]">
            <div className="p-4 sm:p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-2xl">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-800 leading-tight">Notas e Evolução</h3>
                <p className="text-[10px] sm:text-xs text-slate-500">{modalNotasPaciente.nome}</p>
              </div>
              <button onClick={() => { setModalNotasPaciente(null); cancelarEdicaoNota(); }} className="text-slate-400 hover:text-slate-700 bg-slate-200/50 hover:bg-slate-200 p-2 rounded-full transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto custom-scrollbar flex-1 bg-slate-100/50 space-y-3">
              {modalNotasPaciente.notasArray.length === 0 ? (
                <p className="text-slate-400 text-center italic text-sm py-8">Nenhuma anotação registrada.</p>
              ) : (
                modalNotasPaciente.notasArray.map((nota, i) => (
                  <div key={i} className={`p-3 sm:p-4 rounded-xl border-l-4 shadow-sm text-left relative group transition-colors ${notaEmEdicao === i ? 'bg-sky-50 border-sky-500' : 'bg-white border-sky-400 hover:bg-slate-50'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div className="text-[9px] sm:text-[10px] text-sky-600 font-bold uppercase flex items-center gap-1.5">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        {nota.usuario}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-widest text-right">
                          {nota.data} {nota.editadaEm && <span className="text-amber-500 italic ml-1" title={`Editada em ${nota.editadaEm}`}>(Editada)</span>}
                        </span>
                        {/* Botões de Ação */}
                        <div className="flex items-center gap-1 ml-1 sm:ml-2 opacity-50 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <button onClick={() => iniciarEdicaoNota(i, nota.texto)} className="text-slate-400 hover:text-amber-500 p-1 rounded transition-colors" title="Editar Nota">
                            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                          </button>
                          <button onClick={() => setNotaParaApagar(i)} className="text-slate-400 hover:text-red-500 p-1 rounded transition-colors" title="Apagar Nota">
                            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{nota.texto}</p>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 sm:p-5 border-t border-slate-200 bg-white rounded-b-2xl">
              <div className="flex justify-between items-center mb-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase">
                  {notaEmEdicao !== null ? <span className="text-amber-600 flex items-center gap-1"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg> Editando Anotação</span> : 'Nova Anotação / Pendência'}
                </label>
                {notaEmEdicao !== null && (
                  <button onClick={cancelarEdicaoNota} className="text-[10px] text-slate-500 hover:text-slate-700 underline">Cancelar Edição</button>
                )}
              </div>

              <textarea value={novaNota} onChange={e => setNovaNota(e.target.value)} className={`w-full p-3 border rounded-xl text-sm outline-none focus:ring-2 h-20 sm:h-24 mb-3 resize-none custom-scrollbar ${notaEmEdicao !== null ? 'bg-amber-50 border-amber-300 focus:ring-amber-500' : 'bg-slate-50 border-slate-300 focus:ring-sky-500'}`} placeholder="Digite a evolução, entrave para alta ou pedido gerado..."></textarea>

              <button onClick={salvarNota} className={`w-full text-white font-bold py-2.5 sm:py-3 rounded-xl transition-shadow shadow-md flex justify-center items-center gap-2 ${notaEmEdicao !== null ? 'bg-amber-500 hover:bg-amber-600' : 'bg-sky-600 hover:bg-sky-700'}`}>
                {notaEmEdicao !== null ? (
                  <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Salvar Edição</>
                ) : (
                  <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg> Registrar Nota</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Monitoramento de Medicações */}
      {modalMedicacoesPaciente && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">

          {/* Modal Sobreposto de Confirmação de Exclusão da Medicação */}
          {medicacaoParaApagar !== null && (
            <div className="absolute inset-0 z-[10010] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 rounded-2xl animate-[fadeIn_0.2s_ease-in-out]">
              <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center">
                <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Excluir Medicação?</h3>
                <p className="text-slate-500 text-sm mb-6">
                  Tem certeza que deseja excluir esta medicação? A exclusão não poderá ser desfeita.
                </p>
                <div className="flex w-full gap-3">
                  <button onClick={() => setMedicacaoParaApagar(null)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2.5 rounded-xl transition-colors">Cancelar</button>
                  <button onClick={confirmarApagarMedicacao} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 rounded-xl transition-shadow shadow-md shadow-red-600/20">Excluir</button>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] animate-[fadeIn_0.2s_ease-in-out] relative w-full sm:w-[500px]">
            <div className="p-4 sm:p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-2xl">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-800 leading-tight">Monitoramento de Medicações</h3>
                <p className="text-[10px] sm:text-xs text-slate-500">{modalMedicacoesPaciente.nome}</p>
              </div>
              <button onClick={() => { setModalMedicacoesPaciente(null); cancelarEdicaoMedicacao(); }} className="text-slate-400 hover:text-slate-700 bg-slate-200/50 hover:bg-slate-200 p-2 rounded-full transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Lista de Medicações Ativas */}
            <div className="p-4 sm:p-5 overflow-y-auto custom-scrollbar flex-1 bg-slate-100/50 space-y-3">
              {(!modalMedicacoesPaciente.medicacoes_curso || modalMedicacoesPaciente.medicacoes_curso.length === 0) ? (
                <p className="text-slate-400 text-center italic text-sm py-8">Nenhuma medicação em curso.</p>
              ) : (
                modalMedicacoesPaciente.medicacoes_curso.map((med, i) => {
                  const diasPassados = calcularDiasPassados(med.data_inicio);
                  // Progresso visual simples
                  const percent = Math.min(100, Math.round((diasPassados / med.duracao_dias) * 100)) || 0;
                  const isCritico = diasPassados >= med.duracao_dias;

                  return (
                    <div key={med.id || i} className={`p-3 sm:p-4 rounded-xl border-l-4 shadow-sm text-left relative group transition-colors ${formMedicacao.id === med.id ? 'bg-indigo-50 border-indigo-500' : 'bg-white border-indigo-400 hover:bg-slate-50'}`}>
                      <div className="flex justify-between items-start mb-2">
                        <div className="text-sm sm:text-base font-bold text-slate-800">{med.nome_medicacao}</div>
                        <div className="flex items-center gap-1 sm:gap-2 opacity-50 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <button onClick={() => iniciarEdicaoMedicacao(med)} className="text-slate-400 hover:text-indigo-500 p-1 rounded transition-colors" title="Editar Medicação">
                            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                          </button>
                          <button onClick={() => setMedicacaoParaApagar(med)} className="text-slate-400 hover:text-red-500 p-1 rounded transition-colors" title="Apagar Medicação">
                            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </div>

                      <div className="flex justify-between text-xs text-slate-500 mb-2">
                        <span>Acesso: <strong className="font-mono text-[10px]">{med.data_inicio.split('-').reverse().join('/')}</strong></span>
                        <span className={`font-bold ${isCritico ? 'text-rose-600' : 'text-indigo-600'}`}>
                          {diasPassados} de {med.duracao_dias} dias
                        </span>
                      </div>

                      {/* Barra de Progresso */}
                      <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div className={`h-1.5 rounded-full ${isCritico ? 'bg-rose-500' : 'bg-indigo-500'}`} style={{ width: `${percent}%` }}></div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Formulário Inclusão / Edição */}
            <div className="p-4 sm:p-5 border-t border-slate-200 bg-white rounded-b-2xl">
              <div className="flex justify-between items-center mb-3">
                <label className="block text-[10px] font-bold text-slate-400 uppercase">
                  {formMedicacao.id ? <span className="text-indigo-600 flex items-center gap-1"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg> Editando Medicação</span> : 'Nova Medicação'}
                </label>
                {formMedicacao.id && (
                  <button onClick={cancelarEdicaoMedicacao} className="text-[10px] text-slate-500 hover:text-slate-700 underline">Cancelar Edição</button>
                )}
              </div>

              <div className="space-y-3 mb-4">
                <div>
                  <input type="text" placeholder="Nome do Antibiótico / Medicação" value={formMedicacao.nome_medicacao} onChange={e => setFormMedicacao({ ...formMedicacao, nome_medicacao: e.target.value })} className={`w-full p-2.5 sm:p-3 border rounded-xl text-sm outline-none focus:ring-2 bg-slate-50 ${formMedicacao.id ? 'border-indigo-300 focus:ring-indigo-500' : 'border-slate-300 focus:ring-indigo-500'}`} />
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-[9px] font-bold text-slate-400 uppercase pl-1 mb-1">Início</label>
                    <input type="date" value={formMedicacao.data_inicio} onChange={e => setFormMedicacao({ ...formMedicacao, data_inicio: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[9px] font-bold text-slate-400 uppercase pl-1 mb-1">Duração Total (Dias)</label>
                    <input type="number" min="1" placeholder="Ex: 7" value={formMedicacao.duracao_dias} onChange={e => setFormMedicacao({ ...formMedicacao, duracao_dias: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50" />
                  </div>
                </div>
              </div>

              <button onClick={salvarMedicacao} className={`w-full text-white font-bold py-2.5 sm:py-3 rounded-xl transition-shadow shadow-md flex justify-center items-center gap-2 ${formMedicacao.id ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                {formMedicacao.id ? (
                  <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Salvar Alterações</>
                ) : (
                  <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg> Adicionar Medicação</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}