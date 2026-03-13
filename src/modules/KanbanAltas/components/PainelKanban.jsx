import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, orderBy, limit } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import ImportacaoCenso from './ImportacaoCenso';
import { saveActivityLog, toggleClinicalTag, updateProvavelAlta, removeProvavelAlta, updateFluxoTrauma, removeFluxoTrauma, updateMedications, updatePatientSpecialties, saveSisregWorkflow, togglePCP } from '../services/kanbanService';
import { PROFISSIONAL_ESPECIALIDADES } from '../../../utils/specialties';
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

// Helper para converter datas de forma resiliente
const parseDate = (str) => {
  if (!str) return new Date();
  if (str instanceof Date) return str;
  
  const stringData = String(str);
  
  // Caso 1: Formato Brasileiro Legado ou com "/" (DD/MM/YYYY)
  if (stringData.includes('/')) {
    const [dataPart, horaPart] = stringData.split(' ');
    const [dia, mes, ano] = dataPart.split('/');
    const [hora, minuto] = horaPart ? horaPart.split(':') : [0, 0];
    const d = new Date(ano, mes - 1, dia, hora, minuto);
    return isNaN(d.getTime()) ? new Date() : d;
  }
  
  // Caso 2: Formato ISO-8601 (YYYY-MM-DDTHH:mm:SS)
  const dISO = new Date(stringData);
  if (!isNaN(dISO.getTime())) return dISO;

  return new Date(); // Fallback final
};

export default function PainelKanban() {
  const [showImportModal, setShowImportModal] = useState(false);
  const [pacientes, setPacientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ultimaSinc, setUltimaSinc] = useState('Buscando...');
  const [dataUltimaImportacaoRaw, setDataUltimaImportacaoRaw] = useState(null);

  // Estado do Easter Egg (Enf. Thiago)
  const [modalThiagoAberto, setModalThiagoAberto] = useState(false);

  // Estados dos Filtros
  const [busca, setBusca] = useState('');
  const [filtroSetor, setFiltroSetor] = useState('');
  const [filtroKanban, setFiltroKanban] = useState('');
  const [filtroEspecialidade, setFiltroEspecialidade] = useState('');
  const [filtrosSisreg, setFiltrosSisreg] = useState([]); // Filtro multiplo: 'SEM SISREG', 'PENDENTE', 'DEVOLVIDO', 'FINALIZADO'
  const [filtroNotas, setFiltroNotas] = useState(false);
  const [filtroSisregDropdownAberto, setFiltroSisregDropdownAberto] = useState(false);

  const [filtroEmad, setFiltroEmad] = useState(false);
  const [filtroRetaguarda, setFiltroRetaguarda] = useState(false);
  const [filtroAlta, setFiltroAlta] = useState(false);
  const [filtroTrauma, setFiltroTrauma] = useState(false);
  const [filtroMedicacao, setFiltroMedicacao] = useState(false);
  const [filtroPCP, setFiltroPCP] = useState(false);

  // States do Log e Tutorial
  const [activityLogs, setActivityLogs] = useState([]);
  const [isLogDropdownOpen, setIsLogDropdownOpen] = useState(false);
  const [hasRecentLog, setHasRecentLog] = useState(false);
  const [showTutorialModal, setShowTutorialModal] = useState(false);

  // Estado do Modal Relatório Gerencial SISREG
  const [showRelatorioSisreg, setShowRelatorioSisreg] = useState(false);
  const [relatorioFiltro, setRelatorioFiltro] = useState({ dataInicial: '', dataFinal: '' });
  const [relatorioGerado, setRelatorioGerado] = useState(null); // null = estágio 1, objeto = estágio 2

  // Estados dos Modais Interativos
  const [modalNotasPaciente, setModalNotasPaciente] = useState(null);
  const [novaNota, setNovaNota] = useState('');
  const [notaEmEdicao, setNotaEmEdicao] = useState(null);
  const [notaParaApagar, setNotaParaApagar] = useState(null);

  const [modalSisregPaciente, setModalSisregPaciente] = useState(null);
  const [formSisreg, setFormSisreg] = useState({ data: new Date().toISOString().split('T')[0], numero: '', devolutiva: '', resposta: '' });
  const [confirmarApagarSisreg, setConfirmarApagarSisreg] = useState(false);

  const [modalProvavelAlta, setModalProvavelAlta] = useState(null);
  const [pendenciaAlta, setPendenciaAlta] = useState('');
  const [modalDetalhesAlta, setModalDetalhesAlta] = useState(null);

  const [modalFluxoTrauma, setModalFluxoTrauma] = useState(null);
  const [descricaoTrauma, setDescricaoTrauma] = useState('');
  const [modalDetalhesTrauma, setModalDetalhesTrauma] = useState(null);

  // Estados do Modal PCP (Protocolo de Capacidade Plena)
  const [modalPCPConfirmar, setModalPCPConfirmar] = useState(null);   // paciente aguardando confirmação de elegibilidade
  const [modalPCPRemover, setModalPCPRemover] = useState(null);       // paciente aguardando confirmação de remoção

  // Estados dos Modais de Medicação
  const [modalMedicacoesPaciente, setModalMedicacoesPaciente] = useState(null);
  const [formMedicacao, setFormMedicacao] = useState({
    id: '',
    nome_medicacao: '',
    data_inicio: new Date().toISOString().split('T')[0],
    duracao_dias: ''
  });
  const [medicacaoParaApagar, setMedicacaoParaApagar] = useState(null);

  // Estados dos Modais de Especialidade
  const [modalEspecialidadePaciente, setModalEspecialidadePaciente] = useState(null);
  const [formEspecialidade, setFormEspecialidade] = useState({ principal: '', adicionais: [] });
  const [selecaoAdicional, setSelecaoAdicional] = useState('');

  // Sincroniza form de Especialidade com o Modal quando ele for aberto
  useEffect(() => {
    if (modalEspecialidadePaciente) {
      setFormEspecialidade({
        principal: modalEspecialidadePaciente.especialidade_gestao?.principal || modalEspecialidadePaciente.especialidade || '',
        adicionais: modalEspecialidadePaciente.especialidade_gestao?.adicionais || []
      });
      setSelecaoAdicional('');
    }
  }, [modalEspecialidadePaciente]);

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

      setModalEspecialidadePaciente(prev => {
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
        setDataUltimaImportacaoRaw(data); // Armazena o Date bruto para o Staleness Check
      } else {
        setUltimaSinc('Nunca sincronizado');
        setDataUltimaImportacaoRaw(null);
      }
    });

    return () => {
      unsubPacientes();
      unsubSinc();
    };
  }, []);

  // 1.5. LÓGICA DE AUDITORIA E LOGS (CENTRAL DE ATIVIDADES)
  useEffect(() => {
    const qLogs = query(collection(db, 'nexus_kanban_logs'), orderBy('timestamp', 'desc'), limit(5));
    const unsubLogs = onSnapshot(qLogs, (snapshot) => {
      const logsDocs = [];
      snapshot.forEach(doc => {
        logsDocs.push({ id: doc.id, ...doc.data() });
      });
      setActivityLogs(logsDocs);

      if (logsDocs.length > 0 && logsDocs[0].timestamp) {
        const agora = new Date();
        const diffMs = agora - logsDocs[0].timestamp.toDate();
        if (diffMs < 3 * 60 * 1000) {
          setHasRecentLog(true);
        } else {
          setHasRecentLog(false);
        }
      }
    });
    return () => unsubLogs();
  }, []);

  // 2. LÓGICA DE PROCESSAMENTO E FILTROS
  // Utilitária: calcula a idade exata a partir de uma string de data de nascimento (DD/MM/YYYY)
  const calcularIdade = (nascimento) => {
    if (!nascimento) return null;
    const nasc = String(nascimento);
    // Suporta DD/MM/YYYY
    const match = nasc.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (!match) return null;
    const [, dia, mes, ano] = match;
    const dataNasc = new Date(Number(ano), Number(mes) - 1, Number(dia));
    const hoje = new Date();
    let idade = hoje.getFullYear() - dataNasc.getFullYear();
    const mesAtual = hoje.getMonth() - dataNasc.getMonth();
    if (mesAtual < 0 || (mesAtual === 0 && hoje.getDate() < dataNasc.getDate())) idade--;
    return isNaN(idade) ? null : idade;
  };

  const { filtrados, kpis, contadoresRapidos, setoresAgrupados, setoresDisponiveis } = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const counts = { verde: 0, amarelo: 0, vermelho: 0, laranja: 0, roxo: 0, preto: 0, sisreg: 0 };
    const contadoresFiltros = { sisreg: 0, comSisreg: 0, notas: 0, emad: 0, retaguarda: 0, alta: 0, trauma: 0, medicacao: 0, pcp: 0 };
    const listaSetores = new Set();
    const mapAgrupado = {};

    let dadosFiltradosBase = pacientes.filter(p => {
      if (SETORES_OCULTOS.includes(p.setor)) return false;

      const dInt = parseDate(p.dataInternacao);
      // Cálculo de LOS usando diferença absoluta em milissegundos
      const diffMs = Math.max(0, hoje.getTime() - dInt.getTime());
      const dias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      let pKanban = "verde";
      if (dias >= 2 && dias <= 3) pKanban = "amarelo";
      else if (dias > 3 && dias <= 7) pKanban = "vermelho";
      else if (dias > 7 && dias <= 15) pKanban = "laranja";
      else if (dias > 15 && dias <= 30) pKanban = "roxo";
      else if (dias > 30) pKanban = "preto";

      p.diasInternado = dias;
      p.corKanban = pKanban;

      let isAlertaMedicacao = false;
      if (p.medicacoes_curso && p.medicacoes_curso.length > 0) {
        isAlertaMedicacao = p.medicacoes_curso.some(med => {
          const inicio = new Date(med.data_inicio + "T00:00:00");
          const dif = Math.max(0, hoje - inicio);
          const passados = Math.ceil(dif / (1000 * 60 * 60 * 24));
          return passados >= med.duracao_dias;
        });
      }
      p.isAlertaMedicacao = isAlertaMedicacao;

      const setorLimpo = String(p.setor).toUpperCase().trim();
      p.exigeSisreg = SETORES_URGENCIA.includes(setorLimpo);
      p.semSisreg = p.exigeSisreg && (!p.numeroSisreg || p.numeroSisreg.trim() === "");
      p.comSisreg = p.exigeSisreg && (!!p.numeroSisreg && p.numeroSisreg.trim() !== "");

      let notasArray = [];
      try { notasArray = JSON.parse(p.historicoJson || "[]"); } catch (e) { }
      p.temNotas = notasArray.length > 0;
      p.notasArray = notasArray;

      listaSetores.add(p.setor);

      let validBase = true;
      if (busca && !p.nome.toLowerCase().includes(busca.toLowerCase()) && !String(p.leito).toLowerCase().includes(busca.toLowerCase())) validBase = false;
      if (filtroSetor && p.setor !== filtroSetor) validBase = false;
      if (filtroKanban && pKanban !== filtroKanban) validBase = false;

      if (filtroEspecialidade) {
        const especialidadeEfetiva = p.especialidade_gestao?.principal || p.especialidade || 'NÃO INFORMADA';
        const isPrincipal = especialidadeEfetiva === filtroEspecialidade;
        if (!isPrincipal) validBase = false;
      }

      // Calcula e persiste a idade no objeto (usada pelo botão PCP)
      p.idadeCalculada = calcularIdade(p.nascimento);

      if (validBase) {
        if (p.semSisreg) contadoresFiltros.sisreg++;
        if (p.comSisreg) contadoresFiltros.comSisreg++;
        if (p.temNotas) contadoresFiltros.notas++;
        if (p.perfil_emad?.active) contadoresFiltros.emad++;
        if (p.perfil_retaguarda?.active) contadoresFiltros.retaguarda++;
        if (p.provavel_alta?.active) contadoresFiltros.alta++;
        if (p.fluxo_trauma?.active) contadoresFiltros.trauma++;
        if (p.medicacoes_curso && p.medicacoes_curso.length > 0) contadoresFiltros.medicacao++;
        if (p.pcp === true) contadoresFiltros.pcp++;
      }

      return validBase;
    });

    let dadosFiltrados = dadosFiltradosBase.filter(p => {
      let valid = true;

      // Filtro multiplo de SISREG
      if (filtrosSisreg.length > 0) {
        const statusSisregEfetivo = p.sisreg_status || (p.numeroSisreg ? 'PENDENTE' : 'SEM SISREG');
        if (!filtrosSisreg.includes(statusSisregEfetivo)) valid = false;
      }

      if (filtroNotas && !p.temNotas) valid = false;
      if (filtroEmad && !p.perfil_emad?.active) valid = false;
      if (filtroRetaguarda && !p.perfil_retaguarda?.active) valid = false;
      if (filtroAlta && !p.provavel_alta?.active) valid = false;
      if (filtroTrauma && !p.fluxo_trauma?.active) valid = false;
      if (filtroMedicacao && (!p.medicacoes_curso || p.medicacoes_curso.length === 0)) valid = false;
      if (filtroPCP && p.pcp !== true) valid = false;

      if (valid) {
        counts[p.corKanban]++;
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
      contadoresRapidos: contadoresFiltros,
      setoresAgrupados: mapAgrupado,
      setoresDisponiveis: Array.from(listaSetores).sort()
    };
  }, [pacientes, busca, filtroSetor, filtroEspecialidade, filtroKanban, filtrosSisreg, filtroNotas, filtroEmad, filtroRetaguarda, filtroAlta, filtroTrauma, filtroMedicacao, filtroPCP]);

  // ===== EASTER EGG: ENF. THIAGO =====
  // Passo 1: Contagem individual por setor-foco
  const SETORES_FOCO_THIAGO = [
    'PS DECISÃO CIRURGICA',
    'PS DECISÃO CLINICA',
    'SALA DE EMERGENCIA',
    'SALA LARANJA',
    'UNID. AVC AGUDO'
  ];

  const contagemThiago = useMemo(() => {
    const contagem = {
      'PS DECISÃO CIRURGICA': 0,
      'PS DECISÃO CLINICA': 0,
      'SALA DE EMERGENCIA': 0,
      'SALA LARANJA': 0,
      'UNID. AVC AGUDO': 0
    };
    pacientes.forEach(p => {
      const setor = (p.setor || p.setor_atual || '').toUpperCase().trim();
      if (contagem[setor] !== undefined) contagem[setor]++;
    });
    return contagem;
  }, [pacientes]);

  // Passo 2: Staleness Check - verifica se o censo está desatualizado (> 60 min)
  const diferencaMinutos = dataUltimaImportacaoRaw
    ? Math.floor((new Date() - dataUltimaImportacaoRaw) / (1000 * 60))
    : null;
  const isDesatualizado = diferencaMinutos !== null && diferencaMinutos > 60;
  // ===================================

  const limparFiltros = () => {
    setBusca('');
    setFiltroSetor('');
    setFiltroKanban('');
    setFiltroEspecialidade('');
    setFiltrosSisreg([]);
    setFiltroNotas(false);
    setFiltroEmad(false);
    setFiltroRetaguarda(false);
    setFiltroAlta(false);
    setFiltroTrauma(false);
    setFiltroMedicacao(false);
    setFiltroPCP(false);
    toast.info("Filtros limpos!");
  };

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
      await saveActivityLog(modalNotasPaciente.id, 'NOTAS DA EQUIPE', notaEmEdicao !== null ? 'Atualizou anotação manual' : 'Adicionou nova anotação manual');

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
      await saveActivityLog(modalNotasPaciente.id, 'NOTAS DA EQUIPE', 'Apagou uma anotação do histórico');

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
    setFormSisreg({ 
      data: dataFormatada, 
      numero: p.numeroSisreg,
      devolutiva: '',
      resposta: '' 
    });
    setModalSisregPaciente(p);
  };

  const salvarSisreg = async (novoStatus = 'PENDENTE') => {
    if (!formSisreg.data || !formSisreg.numero) return toast.warning("Preencha a data e o número.");
    try {
      const p = modalSisregPaciente;
      let payload = {
            dataSisreg: formSisreg.data.split("-").reverse().join("/"),
            numeroSisreg: formSisreg.numero.trim().toUpperCase(),
            sisreg_status: novoStatus
      };

      let logMsg = '';
      let statGlobal = null;

      // Montando o array de Eventos (Linha do Tempo)
      const novoEvento = {
        dataHora: new Date().toISOString(),
        usuario: "Equipe de Regulação",
      };

      if(novoStatus === 'PENDENTE' && p.sisreg_status !== 'PENDENTE' && p.sisreg_status !== 'DEVOLVIDO') {
        novoEvento.acao = "SISREG Registrado";
        novoEvento.descricao = `Pedido nº ${payload.numeroSisreg}`;
        logMsg = `Cadastrou/Atualizou SISREG: ${payload.numeroSisreg}`;
        statGlobal = 'total_criados';
      } else if (novoStatus === 'DEVOLVIDO') {
        if(!formSisreg.devolutiva.trim()) return toast.warning("A devolutiva é obrigatória.");
        novoEvento.acao = "Devolvido";
        novoEvento.descricao = formSisreg.devolutiva.trim();
        logMsg = `Marcou SISREG como DEVOLVIDO. Motivo: ${novoEvento.descricao}`;
        statGlobal = 'total_devolucoes';
        // Resetamos o campo de resposta ao registrar devolutiva
        payload.resposta = ""; 
      } else if (novoStatus === 'PENDENTE' && p.sisreg_status === 'DEVOLVIDO') {
        // Significa que respondeu uma devolução
        if(!formSisreg.resposta.trim()) return toast.warning("Descreva a ação tomada para reativar o pedido.");
        novoEvento.acao = "Ação Tomada";
        novoEvento.descricao = formSisreg.resposta.trim();
        logMsg = `Respondeu devolução do SISREG: ${novoEvento.descricao}`;
        statGlobal = 'total_respostas';
        // Resetamos o campo de devolutiva ao registrar resposta
        payload.devolutiva = "";
      } else if (novoStatus === 'FINALIZADO') {
        novoEvento.acao = "Finalizado";
        novoEvento.descricao = "Regulação Concluída.";
        logMsg = `Finalizou o ciclo do SISREG nº ${payload.numeroSisreg}`;
        statGlobal = 'total_finalizados';
      }

      // Merge de arrays do firebase não sobrescreve os originais, então usamos o espelho atual concatenado para setar direto
      payload.sisreg_historico = [...(p.sisreg_historico || []), novoEvento];

      await saveSisregWorkflow(p.id, payload, logMsg, statGlobal);

      toast.success(`SISREG: Status atualizado para ${novoStatus}!`);
      setModalSisregPaciente(null);
    } catch (error) { toast.error("Erro ao processar fluxo SISREG."); console.error(error); }
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
      await saveActivityLog(modalMedicacoesPaciente.id, 'MEDICAÇÃO', formMedicacao.id ? `Alterou a medicação: ${formMedicacao.nome_medicacao}` : `Adicionou a medicação: ${formMedicacao.nome_medicacao} (${formMedicacao.duracao_dias} dias)`);
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
      await saveActivityLog(modalMedicacoesPaciente.id, 'MEDICAÇÃO', `Removeu a medicação: ${medicacaoParaApagar.nome_medicacao}`);
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

  // 5. GESTÃO DE ESPECIALIDADES CLÍNICAS
  const addEspecialidadeAdicional = () => {
    if (!selecaoAdicional) return;
    if (formEspecialidade.adicionais.includes(selecaoAdicional)) return toast.warning("Especialidade já adicionada");
    if (formEspecialidade.principal === selecaoAdicional) return toast.warning("Esta é a especialidade principal");

    setFormEspecialidade(prev => ({ ...prev, adicionais: [...prev.adicionais, selecaoAdicional] }));
    setSelecaoAdicional('');
  };

  const removeEspecialidadeAdicional = (esp) => {
    setFormEspecialidade(prev => ({ ...prev, adicionais: prev.adicionais.filter(e => e !== esp) }));
  };

  const salvarEspecialidades = async () => {
    if (!formEspecialidade.principal) return toast.warning("Informe a especialidade principal");

    try {
      const p = pacientes.find(pat => pat.id === modalEspecialidadePaciente.id);
      let historicoObj = null;
      if (p) {
        const principalAntiga = p.especialidade_gestao?.principal || p.especialidade || 'N/A';
        if (principalAntiga !== formEspecialidade.principal) {
          historicoObj = {
            dataHora: new Date().toISOString(),
            usuario: "Equipe NIR",
            de: principalAntiga,
            para: formEspecialidade.principal
          };
          await saveActivityLog(p.id, 'ESPECIALIDADE', `Alterou especialidade principal de [${principalAntiga}] para [${formEspecialidade.principal}]`);
        }
        const adicionaisAntigas = p.especialidade_gestao?.adicionais || [];
        const novasAdicionais = formEspecialidade.adicionais || [];
        const adicionadas = novasAdicionais.filter(x => !adicionaisAntigas.includes(x));
        const removidas = adicionaisAntigas.filter(x => !novasAdicionais.includes(x));

        for (let add of adicionadas) {
          await saveActivityLog(p.id, 'ESPECIALIDADE', `Adicionou a especialidade acompanhante: ${add}`);
        }
        for (let rem of removidas) {
          await saveActivityLog(p.id, 'ESPECIALIDADE', `Removeu a especialidade acompanhante: ${rem}`);
        }
      }

      await updatePatientSpecialties(modalEspecialidadePaciente.id, formEspecialidade.principal, formEspecialidade.adicionais, historicoObj);
      toast.success("Especialidades salvas e protegidas!");
      setModalEspecialidadePaciente(null);
    } catch (error) {
      toast.error("Erro ao salvar especialidades.");
    }
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
      <ToastContainer position="top-right" theme="light" className="!z-[99999]" />

      {/* Barra Superior */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="text-center sm:text-left w-full sm:w-auto">
          <h2 className="text-lg font-bold text-slate-800">Monitoramento de Fluxo</h2>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-sm text-slate-500 mt-0.5">
            {/* Easter Egg: texto clicável para o Enf. Thiago */}
            <span
              onClick={() => setModalThiagoAberto(true)}
              className="cursor-pointer hover:text-indigo-600 transition-colors select-none"
              title="Clique para detalhes do censo por setor ✨"
            >
              Censo atual: <strong className="text-slate-700 hover:text-indigo-700 transition-colors">{filtrados.length}</strong> pacientes.
            </span>
            <span className="hidden sm:inline text-slate-300">|</span>
            <span className="flex items-center justify-center gap-1.5 bg-slate-100 px-2 py-0.5 rounded-md text-xs border border-slate-200">
              <svg className="w-3.5 h-3.5 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              Sincronizado: <strong className="text-slate-600">{ultimaSinc}</strong>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto flex-wrap justify-end">
          {/* Central de Atividades Dropdown */}
          <div className="relative shrink-0">
            <button disabled={activityLogs.length === 0} onClick={() => { setIsLogDropdownOpen(!isLogDropdownOpen); setHasRecentLog(false); }} className={`bg-slate-100 text-slate-700 w-10 h-10 rounded-xl flex items-center justify-center transition-all relative ${activityLogs.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-200 cursor-pointer'}`}>
              <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
              {hasRecentLog && <span className="absolute -top-1 -right-1 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span></span>}
            </button>
            {isLogDropdownOpen && activityLogs.length > 0 && (
              <div className="absolute top-full right-0 origin-top-right mt-2 w-72 max-w-[90vw] sm:w-[320px] bg-white shadow-xl border border-slate-200 rounded-2xl z-[9999] p-4">
                <h4 className="text-sm font-bold text-slate-800 border-b pb-2 mb-3">Últimas Atualizações</h4>
                <div className="flex flex-col gap-3">
                  {activityLogs.map(log => (
                    <div key={log.id} className="flex gap-3 text-sm items-start">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 shrink-0 text-base">
                        {log.acao === 'SINC. MV' ? (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        )}
                      </div>
                      <div className="flex flex-col w-full">
                        <span className="font-bold text-slate-700 text-[11px] leading-tight flex justify-between gap-2">
                          <span className="truncate w-36 sm:w-44">{log.nome_paciente}</span>
                          <span className="text-[9px] font-normal text-slate-400">{log.timestamp ? new Date(log.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                        </span>
                        <span className="text-[10px] text-slate-500 leading-tight mt-0.5">{log.descricao}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Botão Universidade Nexus (Desktop Only) */}
          <button onClick={() => setShowTutorialModal(true)} className="hidden md:flex bg-slate-100 hover:bg-slate-200 text-slate-700 w-10 h-10 rounded-xl items-center justify-center transition-all text-base shrink-0">
            <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
          </button>

          <button onClick={() => toast.info('Funcionalidade em desenvolvimento: Integração RPA para inclusão automática de pedidos de internação em lote no SISREG.')} className="hidden lg:flex bg-slate-100 border border-indigo-100 hover:bg-indigo-50 text-indigo-800 px-4 py-2.5 rounded-xl text-sm font-bold transition-all items-center gap-2 shrink-0">
            <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            Inclusão SISREG (RPA)
          </button>
          {/* Botão Relatório Gerencial SISREG - visível em md+, em sm coloca full-width */}
          <button onClick={() => { setRelatorioGerado(null); setRelatorioFiltro({ dataInicial: '', dataFinal: '' }); setShowRelatorioSisreg(true); }} className="flex sm:w-auto bg-white border border-blue-200 hover:bg-blue-50 text-blue-700 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors items-center gap-2 shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Relatório SISREG
          </button>
          <button onClick={() => gerarRelatorioRondas(pacientes)} className="hidden lg:flex bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-[13px] sm:text-sm font-bold transition-all items-center gap-2 shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
            Relatório Rondas
          </button>
          <button onClick={() => setShowImportModal(true)} className="hidden lg:flex bg-sky-600 hover:bg-sky-700 text-white px-5 py-2.5 rounded-xl text-[13px] sm:text-sm font-bold shadow-md transition-all items-center gap-2 shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            Sincronizar Censo
          </button>
        </div>
      </div>

      {/* Grid de KPIs */}
      <div className={`grid grid-cols-2 md:grid-cols-3 ${filtrosSisreg.includes('SEM SISREG') || kpis.sisreg > 0 ? 'lg:grid-cols-7' : 'lg:grid-cols-6'} gap-3 transition-all duration-300`}>
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
        {(filtrosSisreg.includes('SEM SISREG') || kpis.sisreg > 0) && (
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
        {/* Paciente / Leito */}
        <div className="col-span-2 md:col-span-1 relative">
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Paciente / Leito</label>
          <input type="text" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar..." className="w-full p-2 sm:p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-sky-500 outline-none" />
        </div>

        {/* Setor */}
        <div className="col-span-2 md:col-span-1">
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Setor</label>
          <select value={filtroSetor} onChange={e => setFiltroSetor(e.target.value)} className="w-full p-2 sm:p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 outline-none">
            <option value="">Todos os Setores</option>
            {setoresDisponiveis.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Status Kanban */}
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

        {/* Dropdown Filtro Múltiplo: Status SISREG */}
        <div className="col-span-2 md:col-span-1 relative">
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Status SISREG</label>
          <button
            type="button"
            onClick={() => setFiltroSisregDropdownAberto(prev => !prev)}
            className={`w-full p-2 sm:p-2.5 border rounded-lg text-sm text-left flex items-center justify-between gap-2 transition-all outline-none ${
              filtrosSisreg.length > 0
                ? 'border-indigo-400 bg-indigo-50 text-indigo-700 font-semibold'
                : 'border-slate-300 bg-slate-50 text-slate-500'
            }`}
          >
            <span className="truncate">
              {filtrosSisreg.length === 0 ? 'Todos os Status' : filtrosSisreg.join(', ')}
            </span>
            <svg className={`w-4 h-4 shrink-0 transition-transform ${filtroSisregDropdownAberto ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
          {filtroSisregDropdownAberto && (
            <div className="absolute z-50 top-full left-0 mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-xl p-2 flex flex-col gap-1">
              {['SEM SISREG', 'PENDENTE', 'DEVOLVIDO', 'FINALIZADO'].map(opcao => (
                <label key={opcao} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer text-sm text-slate-700 select-none">
                  <input
                    type="checkbox"
                    checked={filtrosSisreg.includes(opcao)}
                    onChange={() => {
                      setFiltrosSisreg(prev =>
                        prev.includes(opcao)
                          ? prev.filter(f => f !== opcao)
                          : [...prev, opcao]
                      );
                    }}
                    className="w-4 h-4 accent-indigo-600 rounded"
                  />
                  <span className="font-medium">{opcao}</span>
                </label>
              ))}
              {filtrosSisreg.length > 0 && (
                <button
                  onClick={() => setFiltrosSisreg([])}
                  className="mt-1 w-full text-xs text-center text-rose-500 hover:text-rose-700 font-semibold py-1 border-t border-slate-100"
                >
                  Limpar seleção
                </button>
              )}
            </div>
          )}
        </div>

        {/* Especialidade Clínica + Botão Limpar */}
        <div className="col-span-2 md:col-span-2 flex items-end gap-2">
          <div className="flex-1">
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Especialidade Clínica</label>
            <select value={filtroEspecialidade} onChange={e => setFiltroEspecialidade(e.target.value)} className="w-full p-2 sm:p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 outline-none">
              <option value="">Todas as Especialidades</option>
              {PROFISSIONAL_ESPECIALIDADES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <button
            onClick={limparFiltros}
            title="Limpar todos os filtros"
            className="p-2.5 text-slate-500 hover:text-sky-600 hover:bg-sky-50 border border-slate-300 rounded-lg transition-all flex items-center justify-center shrink-0 mb-[1px]"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>

        {/* Toggles Rápidos */}
        <div className="col-span-2 md:col-span-6 border-t pt-3 md:pt-4">
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Filtros Rápidos</label>
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <label className={`flex items-center gap-2 group transition-all ${contadoresRapidos?.notas === 0 ? 'opacity-40 grayscale cursor-not-allowed' : 'cursor-pointer'}`}>
              <div className="relative">
                <input type="checkbox" disabled={contadoresRapidos?.notas === 0} checked={filtroNotas} onChange={() => setFiltroNotas(!filtroNotas)} className="sr-only" />
                <div className={`block w-10 h-5 rounded-full transition-colors ${filtroNotas ? 'bg-blue-500' : 'bg-slate-300'}`}></div>
                <div className={`dot absolute left-1 top-0.5 bg-white w-4 h-4 rounded-full transition-transform ${filtroNotas ? 'transform translate-x-4' : ''} shadow-sm`}></div>
              </div>
              <span className={`text-[10px] sm:text-[11px] font-black uppercase tracking-wider transition-colors ${filtroNotas ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'}`}>Com Notas <span className="text-[10px] ml-0.5 opacity-80">({contadoresRapidos?.notas || 0})</span></span>
            </label>
            <label className={`flex items-center gap-2 group border-l pl-4 sm:pl-6 border-slate-200 transition-all ${contadoresRapidos?.emad === 0 ? 'opacity-40 grayscale cursor-not-allowed' : 'cursor-pointer'}`}>
              <div className="relative">
                <input type="checkbox" disabled={contadoresRapidos?.emad === 0} checked={filtroEmad} onChange={() => setFiltroEmad(!filtroEmad)} className="sr-only" />
                <div className={`block w-10 h-5 rounded-full transition-colors ${filtroEmad ? 'bg-sky-500' : 'bg-slate-300'}`}></div>
                <div className={`dot absolute left-1 top-0.5 bg-white w-4 h-4 rounded-full transition-transform ${filtroEmad ? 'transform translate-x-4' : ''} shadow-sm`}></div>
              </div>
              <span className={`text-[10px] sm:text-[11px] font-black uppercase tracking-wider transition-colors ${filtroEmad ? 'text-sky-600' : 'text-slate-400 group-hover:text-slate-600'}`}>EMAD <span className="text-[10px] ml-0.5 opacity-80">({contadoresRapidos?.emad || 0})</span></span>
            </label>
            <label className={`flex items-center gap-2 group transition-all ${contadoresRapidos?.retaguarda === 0 ? 'opacity-40 grayscale cursor-not-allowed' : 'cursor-pointer'}`}>
              <div className="relative">
                <input type="checkbox" disabled={contadoresRapidos?.retaguarda === 0} checked={filtroRetaguarda} onChange={() => setFiltroRetaguarda(!filtroRetaguarda)} className="sr-only" />
                <div className={`block w-10 h-5 rounded-full transition-colors ${filtroRetaguarda ? 'bg-purple-500' : 'bg-slate-300'}`}></div>
                <div className={`dot absolute left-1 top-0.5 bg-white w-4 h-4 rounded-full transition-transform ${filtroRetaguarda ? 'transform translate-x-4' : ''} shadow-sm`}></div>
              </div>
              <span className={`text-[10px] sm:text-[11px] font-black uppercase tracking-wider transition-colors ${filtroRetaguarda ? 'text-purple-600' : 'text-slate-400 group-hover:text-slate-600'}`}>Retaguarda <span className="text-[10px] ml-0.5 opacity-80">({contadoresRapidos?.retaguarda || 0})</span></span>
            </label>
            <label className={`flex items-center gap-2 group transition-all ${contadoresRapidos?.alta === 0 ? 'opacity-40 grayscale cursor-not-allowed' : 'cursor-pointer'}`}>
              <div className="relative">
                <input type="checkbox" disabled={contadoresRapidos?.alta === 0} checked={filtroAlta} onChange={() => setFiltroAlta(!filtroAlta)} className="sr-only" />
                <div className={`block w-10 h-5 rounded-full transition-colors ${filtroAlta ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                <div className={`dot absolute left-1 top-0.5 bg-white w-4 h-4 rounded-full transition-transform ${filtroAlta ? 'transform translate-x-4' : ''} shadow-sm`}></div>
              </div>
              <span className={`text-[10px] sm:text-[11px] font-black uppercase tracking-wider transition-colors ${filtroAlta ? 'text-emerald-600' : 'text-slate-400 group-hover:text-slate-600'}`}>Alta <span className="text-[10px] ml-0.5 opacity-80">({contadoresRapidos?.alta || 0})</span></span>
            </label>
            <label className={`flex items-center gap-2 group transition-all ${contadoresRapidos?.trauma === 0 ? 'opacity-40 grayscale cursor-not-allowed' : 'cursor-pointer'}`}>
              <div className="relative">
                <input type="checkbox" disabled={contadoresRapidos?.trauma === 0} checked={filtroTrauma} onChange={() => setFiltroTrauma(!filtroTrauma)} className="sr-only" />
                <div className={`block w-10 h-5 rounded-full transition-colors ${filtroTrauma ? 'bg-amber-500' : 'bg-slate-300'}`}></div>
                <div className={`dot absolute left-1 top-0.5 bg-white w-4 h-4 rounded-full transition-transform ${filtroTrauma ? 'transform translate-x-4' : ''} shadow-sm`}></div>
              </div>
              <span className={`text-[10px] sm:text-[11px] font-black uppercase tracking-wider transition-colors ${filtroTrauma ? 'text-amber-600' : 'text-slate-400 group-hover:text-slate-600'}`}>Trauma <span className="text-[10px] ml-0.5 opacity-80">({contadoresRapidos?.trauma || 0})</span></span>
            </label>
            <label className={`flex items-center gap-2 group border-l pl-4 sm:pl-6 border-slate-200 transition-all ${contadoresRapidos?.medicacao === 0 ? 'opacity-40 grayscale cursor-not-allowed' : 'cursor-pointer'}`}>
              <div className="relative">
                <input type="checkbox" disabled={contadoresRapidos?.medicacao === 0} checked={filtroMedicacao} onChange={() => setFiltroMedicacao(!filtroMedicacao)} className="sr-only" />
                <div className={`block w-10 h-5 rounded-full transition-colors ${filtroMedicacao ? 'bg-indigo-500' : 'bg-slate-300'}`}></div>
                <div className={`dot absolute left-1 top-0.5 bg-white w-4 h-4 rounded-full transition-transform ${filtroMedicacao ? 'transform translate-x-4' : ''} shadow-sm`}></div>
              </div>
              <span className={`text-[10px] sm:text-[11px] font-black uppercase tracking-wider transition-colors ${filtroMedicacao ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'}`}>Medicação <span className="text-[10px] ml-0.5 opacity-80">({contadoresRapidos?.medicacao || 0})</span></span>
            </label>
            <label className={`flex items-center gap-2 group border-l pl-4 sm:pl-6 border-slate-200 transition-all ${contadoresRapidos?.pcp === 0 ? 'opacity-40 grayscale cursor-not-allowed' : 'cursor-pointer'}`}>
              <div className="relative">
                <input type="checkbox" disabled={contadoresRapidos?.pcp === 0} checked={filtroPCP} onChange={() => setFiltroPCP(!filtroPCP)} className="sr-only" />
                <div className={`block w-10 h-5 rounded-full transition-colors ${filtroPCP ? 'bg-teal-500' : 'bg-slate-300'}`}></div>
                <div className={`dot absolute left-1 top-0.5 bg-white w-4 h-4 rounded-full transition-transform ${filtroPCP ? 'transform translate-x-4' : ''} shadow-sm`}></div>
              </div>
              <span className={`text-[10px] sm:text-[11px] font-black uppercase tracking-wider transition-colors ${filtroPCP ? 'text-teal-600' : 'text-slate-400 group-hover:text-slate-600'}`}>PCP <span className="text-[10px] ml-0.5 opacity-80">({contadoresRapidos?.pcp || 0})</span></span>
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
                  <div key={p.id} className={`border-y border-r border-l-[12px] shadow-sm rounded-xl p-3 sm:p-4 flex flex-col gap-2 hover:shadow-md transition-all ${coresMap[p.status === 'SINALIZADA' ? 'alta' : p.corKanban]}`}>

                    {/* Linha 1: Bio e Tempo de Internação */}
                    <div className="flex flex-row flex-wrap items-center justify-between w-full">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="bg-slate-800 text-white text-[11px] font-black px-2.5 py-0.5 rounded shadow-sm shrink-0">{p.leito}</span>
                        <h3 className="font-bold text-slate-800 text-sm sm:text-base uppercase">{p.nome}</h3>
                        <span className="text-[10px] text-slate-500 flex items-center gap-1 ml-1"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg> {p.nascimento}</span>
                        {/* Badge PCP */}
                        {p.pcp === true && (
                          <span className="flex items-center gap-1 bg-teal-100 text-teal-700 border border-teal-300 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wide">
                            <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                            PCP
                          </span>
                        )}
                      </div>
                      <span className={`flex items-center gap-1 text-[10px] sm:text-[11px] ${p.diasInternado > 3 ? 'text-red-600 font-bold' : 'text-slate-500'}`}>
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        {p.diasInternado} dias internado
                      </span>
                    </div>

                    {/* Linha 2 e 3 Unidas: Especialidades e Ações de Gestão */}
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 w-full pt-2 border-t border-slate-100/70 mt-1">

                      {/* Lado Esquerdo: Especialidades */}
                      <button onClick={() => setModalEspecialidadePaciente(p)} className="flex flex-col items-start gap-0.5 group shrink-0">
                        <div className="flex items-center gap-1 font-bold text-[11px] text-sky-700 hover:text-sky-900 bg-sky-50 shadow-sm hover:shadow hover:bg-sky-100 px-2.5 py-1.5 rounded-lg transition-all group-hover:bg-sky-100">
                          <svg className="w-3.5 h-3.5 text-sky-500 group-hover:text-sky-700 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                          <span>Especialidade: {p.especialidade_gestao?.principal || p.especialidade || 'NÃO INFORMADA'}</span>
                          {p.especialidade_gestao?.adicionais?.length > 0 && (
                            <span className="font-normal opacity-80 ml-1">(+ {p.especialidade_gestao.adicionais.length} acompanham)</span>
                          )}
                        </div>
                        {p.especialidade_gestao?.atualizado_em && (
                          <span className="text-[10px] text-slate-400 font-medium ml-1">
                            Alterado em {p.especialidade_gestao.atualizado_em.toDate ? p.especialidade_gestao.atualizado_em.toDate().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recentemente'}
                          </span>
                        )}
                      </button>

                      {/* Lado Direito: Ações Clínicas */}
                      <div className="flex flex-wrap items-center justify-start lg:justify-end w-full lg:w-auto gap-1 sm:gap-2">

                        <button onClick={() => toggleClinicalTag(p.id, 'perfil_emad', !p.perfil_emad?.active)} className={`flex items-center justify-center gap-1 p-2 sm:px-2.5 sm:py-1.5 rounded-lg text-[9px] sm:text-[10px] font-black transition-all border shadow-sm ${p.perfil_emad?.active ? 'bg-sky-50 text-sky-700 border-sky-300 ring-1 ring-sky-100' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`} title="Perfil EMAD">
                          <svg className="w-4 h-4 sm:w-3.5 sm:h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                          <span className="hidden sm:inline">EMAD</span>
                        </button>

                        <button onClick={() => toggleClinicalTag(p.id, 'perfil_retaguarda', !p.perfil_retaguarda?.active)} className={`flex items-center justify-center gap-1 p-2 sm:px-2.5 sm:py-1.5 rounded-lg text-[9px] sm:text-[10px] font-black transition-all border shadow-sm ${p.perfil_retaguarda?.active ? 'bg-purple-50 text-purple-700 border-purple-300 ring-1 ring-purple-100' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`} title="Perfil Retaguarda">
                          <svg className="w-4 h-4 sm:w-3.5 sm:h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                          <span className="hidden sm:inline">RETAG.</span>
                        </button>

                        <button onClick={() => { p.provavel_alta?.active ? setModalDetalhesAlta(p) : setModalProvavelAlta(p) }} className={`flex items-center justify-center gap-1 p-2 sm:px-2.5 sm:py-1.5 rounded-lg text-[9px] sm:text-[10px] font-black transition-all border shadow-sm ${p.provavel_alta?.active ? 'bg-emerald-50 text-emerald-700 border-emerald-300 ring-1 ring-emerald-100' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`} title="Provável Alta">
                          <svg className="w-4 h-4 sm:w-3.5 sm:h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          <span className="hidden sm:inline">ALTA</span>
                        </button>

                        <button onClick={() => { p.fluxo_trauma?.active ? setModalDetalhesTrauma(p) : setModalFluxoTrauma(p) }} className={`flex items-center justify-center gap-1 p-2 sm:px-2.5 sm:py-1.5 rounded-lg text-[9px] sm:text-[10px] font-black transition-all border shadow-sm ${p.fluxo_trauma?.active ? 'bg-amber-50 text-amber-700 border-amber-300 ring-1 ring-amber-100' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`} title="Fluxo Trauma">
                          <svg className="w-4 h-4 sm:w-3.5 sm:h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                          <span className="hidden sm:inline">TRAUMA</span>
                        </button>

                        <button onClick={() => setModalMedicacoesPaciente(p)} className={`flex items-center justify-center gap-1 p-2 sm:px-2.5 sm:py-1.5 rounded-lg text-[9px] sm:text-[10px] font-black transition-all border shadow-sm relative group ${p.medicacoes_curso?.length > 0 ? (p.isAlertaMedicacao ? 'bg-red-50 text-red-700 border-red-300 ring-1 ring-red-100 animate-pulse' : 'bg-indigo-50 text-indigo-700 border-indigo-300 ring-1 ring-indigo-100') : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`} title="Medicações em Curso">
                          <svg className="w-4 h-4 sm:w-3.5 sm:h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.6 4.4a5 5 0 117.07 7.07l-6.26 6.26a5 5 0 11-7.07-7.07l6.26-6.26z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.5 15.5l7-7" />
                          </svg>
                          <span className="hidden sm:inline">MEDS</span>
                          {p.medicacoes_curso?.length > 0 && (
                            <span className={`absolute -top-1.5 -right-1.5 text-white text-[9px] w-4 h-4 flex items-center justify-center rounded-full shadow-sm ring-2 ${p.isAlertaMedicacao ? 'bg-red-600 ring-red-50' : 'bg-indigo-500 ring-indigo-50'}`}>{p.medicacoes_curso.length}</span>
                          )}
                        </button>

                        {(() => {
                          const statusSisregEfetivo = p.sisreg_status || (p.numeroSisreg ? 'PENDENTE' : 'SEM SISREG');
                          const showSisreg = p.exigeSisreg || ['PENDENTE', 'DEVOLVIDO'].includes(statusSisregEfetivo);
                          
                          if (!showSisreg) return null;

                          if(statusSisregEfetivo === 'SEM SISREG') {
                            return (
                                <button onClick={() => abrirModalSisregParaEdicao(p)} className="flex items-center justify-center gap-1 bg-rose-50 border border-red-200 text-red-600 hover:bg-rose-600 hover:text-white p-2 sm:px-2.5 sm:py-1.5 rounded-lg transition-all text-[9px] sm:text-[10px] font-black shadow-sm animate-pulse shrink-0">
                                  <svg className="w-4 h-4 sm:w-3.5 sm:h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                  <span className="hidden sm:inline">SEM SISREG</span>
                                </button>
                            );
                          }

                          const configCores = {
                            'PENDENTE': 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100 hover:border-amber-300',
                            'DEVOLVIDO': 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100 hover:border-rose-300',
                            'FINALIZADO': 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300'
                          };
                          const corAtual = configCores[statusSisregEfetivo] || configCores['PENDENTE'];

                          return (
                            <button onClick={() => abrirModalSisregParaEdicao(p)} className={`flex items-center justify-center gap-1 ${corAtual} p-2 sm:px-2.5 sm:py-1.5 rounded-lg text-[9px] sm:text-[10px] font-black transition-colors group shrink-0`} title={`Status: ${statusSisregEfetivo} | Nº ${p.numeroSisreg}`}>
                              <svg className="w-4 h-4 sm:w-3.5 sm:h-3.5 opacity-80 group-hover:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                              <svg className="w-4 h-4 sm:w-3.5 sm:h-3.5 hidden group-hover:block" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                              <span className="hidden sm:inline font-mono tracking-wider">SISREG {statusSisregEfetivo}</span>
                            </button>
                          );
                        })()}

                        <button onClick={() => setModalNotasPaciente(p)} className="flex items-center justify-center gap-1 bg-white hover:bg-sky-50 text-sky-600 p-2 sm:px-2.5 sm:py-1.5 rounded-lg transition-all text-[9px] sm:text-[10px] font-black shadow-sm relative border border-sky-200">
                          <svg className="w-4 h-4 sm:w-3.5 sm:h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          <span className="hidden sm:inline">NOTAS</span>
                          {p.temNotas && <span className="absolute -top-1.5 -right-1.5 bg-sky-600 text-white text-[9px] w-4 h-4 flex items-center justify-center rounded-full shadow-sm">{p.notasArray.length}</span>}
                        </button>

                        {/* Botão PCP: Visível apenas em setores elegíveis e para pacientes 18-60 anos */}
                        {(() => {
                          const SETORES_PCP = ['PS DECISÃO CIRURGICA', 'PS DECISÃO CLINICA'];
                          const setorLimpo = (p.setor || '').toUpperCase().trim();
                          const idadeOk = p.idadeCalculada !== null && p.idadeCalculada >= 18 && p.idadeCalculada <= 60;
                          const setorOk = SETORES_PCP.includes(setorLimpo);
                          if (!setorOk || !idadeOk) return null;

                          if (p.pcp === true) {
                            return (
                              <button
                                onClick={() => setModalPCPRemover(p)}
                                className="flex items-center justify-center gap-1 bg-teal-50 text-teal-700 border border-teal-300 ring-1 ring-teal-100 hover:bg-teal-100 p-2 sm:px-2.5 sm:py-1.5 rounded-lg text-[9px] sm:text-[10px] font-black transition-all shrink-0"
                                title="Remover sinalização PCP"
                              >
                                <svg className="w-4 h-4 sm:w-3.5 sm:h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                                <span className="hidden sm:inline">PCP ✓</span>
                              </button>
                            );
                          }

                          return (
                            <button
                              onClick={() => setModalPCPConfirmar(p)}
                              className="flex items-center justify-center gap-1 bg-white hover:bg-teal-50 text-teal-700 border border-teal-300 hover:border-teal-400 p-2 sm:px-2.5 sm:py-1.5 rounded-lg text-[9px] sm:text-[10px] font-black transition-all shrink-0"
                              title={`Sinalizar para leito PCP (${p.idadeCalculada} anos)`}
                            >
                              <svg className="w-4 h-4 sm:w-3.5 sm:h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                              <span className="hidden sm:inline">PCP</span>
                            </button>
                          );
                        })()}

                      </div>
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

      {/* Modal Incluir/Editar SISREG Avançado (Workflow Engine) */}
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
                  O paciente voltará para a fila de pendência de regulação e todo o histórico criado no SISREG será apagado deste cartão. Confirma a exclusão?
                </p>
                <div className="flex w-full gap-3">
                  <button onClick={() => setConfirmarApagarSisreg(false)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2.5 rounded-xl transition-colors">Cancelar</button>
                  <button onClick={apagarSisreg} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 rounded-xl transition-shadow shadow-md shadow-red-600/20">Excluir Registro</button>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] flex flex-col animate-[fadeIn_0.2s_ease-in-out]">
            {/* Header */}
            <div className="flex justify-between items-center bg-slate-50 p-5 rounded-t-2xl border-b border-slate-200 shrink-0">
              <div>
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  Gestão SISREG (Nº {formSisreg.numero || 'Novo'})
                  {modalSisregPaciente.sisreg_status && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                      modalSisregPaciente.sisreg_status === 'FINALIZADO' ? 'bg-emerald-100 text-emerald-700' :
                      modalSisregPaciente.sisreg_status === 'DEVOLVIDO' ? 'bg-red-100 text-red-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {modalSisregPaciente.sisreg_status}
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-500 mt-1">Paciente: <strong className="text-slate-800">{modalSisregPaciente.nome}</strong></p>
              </div>
              <div className="flex items-center gap-2">
                {formSisreg.numero && modalSisregPaciente.sisreg_status !== 'FINALIZADO' && (
                  <button onClick={() => setConfirmarApagarSisreg(true)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors" title="Apagar Registro SISREG">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                )}
                <button onClick={() => setModalSisregPaciente(null)} className="text-slate-400 hover:text-slate-700 bg-slate-200/50 hover:bg-slate-200 p-2 rounded-full transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white custom-scrollbar">

              {/* Informações Básicas (Oculta campos se já finalizado para ser apenas view read-only) */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Data da Solicitação</label>
                  <input type="date" value={formSisreg.data} disabled={modalSisregPaciente.sisreg_status === 'FINALIZADO'} onChange={e => setFormSisreg({ ...formSisreg, data: e.target.value })} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm bg-slate-50 disabled:opacity-60" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Número Base</label>
                  <input type="text" placeholder="Sem Número ID" disabled={modalSisregPaciente.sisreg_status === 'FINALIZADO'} value={formSisreg.numero} onChange={e => setFormSisreg({ ...formSisreg, numero: e.target.value.replace(/\D/g, '') })} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-mono tracking-widest bg-slate-50 disabled:opacity-60" />
                </div>
              </div>

              {/* Linha do Tempo */}
              {modalSisregPaciente.sisreg_historico?.length > 0 && (
                <div className="border-t border-slate-100 pt-6">
                  <h4 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                    <svg className="w-4 h-4 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Histórico da Regulação
                  </h4>
                  <div className="space-y-4">
                    {modalSisregPaciente.sisreg_historico.map((evt, idx) => (
                      <div key={idx} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className={`w-3 h-3 rounded-full shrink-0 ${evt.acao === 'Devolvido' ? 'bg-red-400' : evt.acao === 'Finalizado' ? 'bg-emerald-400' : 'bg-sky-400'}`}></div>
                          {idx !== modalSisregPaciente.sisreg_historico.length - 1 && <div className="w-0.5 h-full bg-slate-200 mt-1"></div>}
                        </div>
                        <div className="pb-4">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">
                            {new Date(evt.dataHora).toLocaleString('pt-BR')} &bull; {evt.usuario}
                          </p>
                          <p className="text-sm font-bold text-slate-700">{evt.acao}</p>
                          <p className="text-sm text-slate-600 mt-1 bg-slate-50 p-2.5 rounded-lg border border-slate-100 whitespace-pre-wrap">{evt.descricao}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Formulários dinâmicos de Estado */}
              {(() => {
                const statusEfetivoModal = modalSisregPaciente.sisreg_status || (modalSisregPaciente.numeroSisreg ? 'PENDENTE' : 'SEM SISREG');
                if (statusEfetivoModal === 'FINALIZADO') return null;

                return (
                  <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4">
                    {statusEfetivoModal === 'SEM SISREG' ? (
                      <div className="text-sm text-slate-600 font-medium">Insira a Data e o Número nos campos acima e clique no botão verde para iniciar a regulação SISREG deste paciente.</div>
                    ) : (
                      <>
                        {statusEfetivoModal === 'PENDENTE' && (
                          <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                              Devolutiva do SISREG <span className="text-emerald-500">*</span>
                            </label>
                            <textarea value={formSisreg.devolutiva} onChange={e => setFormSisreg({ ...formSisreg, devolutiva: e.target.value })} placeholder={`Copie e cole aqui a devolutiva dada pelo SISREG sobre a solicitação N° ${modalSisregPaciente.numero_sisreg || modalSisregPaciente.numeroSisreg || 'Não Informado'}.`} className="w-full p-3 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white resize-none h-20"></textarea>
                          </div>
                        )}
                        
                        {statusEfetivoModal === 'DEVOLVIDO' && (
                          <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                              Resposta para o SISREG <span className="text-amber-500">*</span>
                            </label>
                            <textarea value={formSisreg.resposta} onChange={e => setFormSisreg({ ...formSisreg, resposta: e.target.value })} placeholder="Copie e cole aqui (ou resuma) a resposta dada ao SISREG sobre essa devolutiva" className="w-full p-3 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-500 bg-white resize-none h-20"></textarea>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Footer / Ações */}
            <div className="p-5 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
              {(() => {
                const statusEfetivoModal = modalSisregPaciente.sisreg_status || (modalSisregPaciente.numeroSisreg ? 'PENDENTE' : 'SEM SISREG');
                if (statusEfetivoModal === 'FINALIZADO') {
                  return <button disabled className="w-full bg-slate-200 text-slate-500 font-bold py-3 rounded-xl cursor-not-allowed">Regulação Encerrada</button>;
                } else if (statusEfetivoModal === 'SEM SISREG') {
                  return <button onClick={() => salvarSisreg('PENDENTE')} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition-shadow shadow-md">Iniciar Regulação SISREG</button>;
                } else {
                  return (
                    <div className="flex gap-3 flex-wrap sm:flex-nowrap">
                      {statusEfetivoModal === 'PENDENTE' && (
                        <>
                          <button onClick={() => salvarSisreg('DEVOLVIDO')} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition-shadow shadow-md text-sm">Registrar Devolutiva</button>
                          <button onClick={() => salvarSisreg('FINALIZADO')} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition-shadow shadow-md text-sm whitespace-nowrap">Encerrar SISREG</button>
                        </>
                      )}
                      {statusEfetivoModal === 'DEVOLVIDO' && (
                        <button onClick={() => salvarSisreg('PENDENTE')} className="flex-1 bg-sky-600 hover:bg-sky-700 text-white font-bold py-3 rounded-xl transition-shadow shadow-md text-sm">Registrar Resposta</button>
                      )}
                    </div>
                  );
                }
              })()}
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
              <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-xl text-[11px] sm:text-xs font-medium mb-2 flex items-start gap-3 shadow-sm shrink-0">
                <span className="text-lg">⚠️</span>
                <p><strong>Atenção:</strong> Utilize este espaço <strong>apenas para observações únicas.</strong> Para Perfil EMAD, Retaguarda, Alta, Trauma, Especialidades, SISREG ou Medicações, utilize os botões estruturados específicos no card do paciente.</p>
              </div>

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

      {/* Modal Gestão de Especialidades */}
      {modalEspecialidadePaciente && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] animate-[fadeIn_0.2s_ease-in-out] relative">
            <div className="p-4 sm:p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-2xl">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-800 leading-tight">Gestão de Especialidades</h3>
                <p className="text-[10px] sm:text-xs text-slate-500">{modalEspecialidadePaciente.nome}</p>
              </div>
              <button onClick={() => setModalEspecialidadePaciente(null)} className="text-slate-400 hover:text-slate-700 bg-slate-200/50 hover:bg-slate-200 p-2 rounded-full transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto custom-scrollbar flex-1 bg-white space-y-5">

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">Especialidade Principal</label>
                <select
                  value={formEspecialidade.principal}
                  onChange={e => setFormEspecialidade({ ...formEspecialidade, principal: e.target.value })}
                  className="w-full p-2.5 sm:p-3 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-sky-500 bg-slate-50 font-bold text-slate-700"
                >
                  <option value="">Selecione a Principal...</option>
                  {PROFISSIONAL_ESPECIALIDADES.map(esp => (
                    <option key={esp} value={esp}>{esp}</option>
                  ))}
                  {/* Fallback caso a do censo não esteja na lista */}
                  {formEspecialidade.principal && !PROFISSIONAL_ESPECIALIDADES.includes(formEspecialidade.principal) && (
                    <option value={formEspecialidade.principal}>{formEspecialidade.principal}</option>
                  )}
                </select>
                <p className="text-[10px] text-slate-400 mt-1 italic">* Substitui a especialidade primária que é importada pelo relatório do MV.</p>
              </div>

              <div className="border-t border-slate-100 pt-5">
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">Acompanhamentos Secundários</label>

                <div className="flex gap-2 mb-3">
                  <select
                    value={selecaoAdicional}
                    onChange={e => setSelecaoAdicional(e.target.value)}
                    className="flex-1 p-2.5 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-sky-500 bg-slate-50 text-slate-600"
                  >
                    <option value="">Adicionar acompanhamento...</option>
                    {PROFISSIONAL_ESPECIALIDADES.map(esp => (
                      <option key={esp} value={esp}>{esp}</option>
                    ))}
                  </select>
                  <button onClick={addEspecialidadeAdicional} className="bg-slate-800 hover:bg-slate-900 text-white px-4 rounded-xl font-bold transition-colors shadow-sm">
                    +
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {formEspecialidade.adicionais.length === 0 ? (
                    <span className="text-[11px] text-slate-400 italic">Nenhuma especialidade adicional vinculada.</span>
                  ) : (
                    formEspecialidade.adicionais.map((esp, i) => (
                      <div key={i} className="flex items-center gap-1.5 bg-sky-50 text-sky-700 border border-sky-200 px-2.5 py-1.5 rounded-lg text-[10px] font-bold shadow-sm">
                        <span>{esp}</span>
                        <button onClick={() => removeEspecialidadeAdicional(esp)} className="text-sky-400 hover:text-red-500 bg-white hover:bg-red-50 rounded-full p-0.5 transition-colors border border-sky-100 hover:border-red-200">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Histórico de Alterações */}
              {(modalEspecialidadePaciente.especialidade_gestao?.historico?.length > 0 || modalEspecialidadePaciente.especialidade_gestao?.atualizado_em) && (
                <div className="border-t border-slate-100 pt-5 mt-5">
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-3">Histórico de Alterações</label>
                  <div className="space-y-3 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                    {modalEspecialidadePaciente.especialidade_gestao.historico?.map((h, idx) => (
                      <div key={idx} className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[9px] font-bold text-slate-400 uppercase">{new Date(h.dataHora).toLocaleString('pt-BR')}</span>
                          <span className="text-[9px] font-bold text-sky-600 uppercase">NIR</span>
                        </div>
                        <p className="text-[11px] text-slate-700">
                          <span className="text-slate-400 font-normal">{h.de}</span> ➔ <span className="font-bold">{h.para}</span>
                        </p>
                      </div>
                    ))}
                    {(!modalEspecialidadePaciente.especialidade_gestao.historico || modalEspecialidadePaciente.especialidade_gestao.historico.length === 0) && modalEspecialidadePaciente.especialidade_gestao.atualizado_em && (
                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <p className="text-[10px] text-slate-500 italic">Última alteração registrada em: {
                          modalEspecialidadePaciente.especialidade_gestao.atualizado_em.toDate 
                          ? modalEspecialidadePaciente.especialidade_gestao.atualizado_em.toDate().toLocaleString('pt-BR') 
                          : 'Recentemente'
                        }</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>

            <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
              <button onClick={salvarEspecialidades} className="w-full bg-sky-600 hover:bg-sky-700 text-white font-bold py-3 rounded-xl transition-shadow shadow-md flex justify-center items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                Salvar Especialidades
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
                  const passadosTotais = calcularDiasPassados(med.data_inicio);
                  const diasExibidos = Math.min(passadosTotais, med.duracao_dias);
                  const percent = Math.min(100, Math.round((passadosTotais / med.duracao_dias) * 100)) || 0;
                  const isCritico = passadosTotais >= med.duracao_dias;

                  return (
                    <div key={med.id || i} className={`p-3 sm:p-4 rounded-xl border-l-4 shadow-sm text-left relative group transition-colors ${formMedicacao.id === med.id ? 'bg-indigo-50 border-indigo-500' : 'bg-white border-indigo-400 hover:bg-slate-50'} ${isCritico && !formMedicacao.id ? '!border-red-400' : ''}`}>
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
                          {diasExibidos} de {med.duracao_dias} dias
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

      {/* MODAL TUTORIAL E HIGIENE */}
      {showTutorialModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/65 backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease-in-out]">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col relative overflow-hidden">
            <div className="bg-indigo-600 p-8 text-center relative overflow-hidden shrink-0">
              <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
              <h2 className="text-2xl font-black text-white relative z-10 font-sans flex justify-center items-center gap-3">
                <div className="bg-white/20 p-2 rounded-xl flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 14l9-5-9-5-9 5 9 5z" /><path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" /></svg>
                </div>
                Universidade Nexus: Gestão de Altas e Fluxos (NIR)
              </h2>
              <p className="text-indigo-100 mt-2 font-medium relative z-10 text-sm">Guia prático para gestores e assistentes do Kanban de Altas.</p>
              <button onClick={() => setShowTutorialModal(false)} className="absolute top-5 right-5 text-indigo-200 hover:text-white transition-colors bg-white/10 hover:bg-white/20 p-2 rounded-full z-20">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-8 overflow-y-auto bg-slate-50 space-y-8 flex-1">
              <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4 border-b pb-3">
                  <svg className="w-6 h-6 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                  Os Números no Topo (KPIs)
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed font-medium">As placas coloridas no topo do painel representam a contagem viva do hospital. Elas mostram a fotografia atual baseada nos <span className="text-sky-600 font-bold bg-sky-50 px-1 py-0.5 rounded">filtros que você acionou.</span> Se você filtrar por "Cirurgia Geral", todos os numerais vão se recalcular instantaneamente para refletir apenas os cirúrgicos.</p>
              </section>

              <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4 border-b pb-3">
                  <svg className="w-6 h-6 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  As Cores do Tempo (Protocolo Kanban)
                </h3>
                <ul className="flex flex-col gap-4 text-sm text-slate-600 font-medium">
                  <li className="flex items-start gap-3"><div className="w-5 h-5 rounded bg-emerald-500 shrink-0 shadow-inner mt-0.5"></div><span><strong>Verde:</strong> Recém chegado no leito (menos de 48h). Foco na emissão de laudos de exames iniciais.</span></li>
                  <li className="flex items-start gap-3"><div className="w-5 h-5 rounded bg-amber-500 shrink-0 shadow-inner mt-0.5"></div><span><strong>Amarelo:</strong> Tempo padrão (48 a 72h). Momento onde condutas cirúrgicas ou clínicas são fechadas.</span></li>
                  <li className="flex items-start gap-3"><div className="w-5 h-5 rounded bg-red-500 shrink-0 shadow-inner mt-0.5"></div><span><strong>Vermelho:</strong> Acima de 72h. O tempo regular de uma internação aguda expirou.</span></li>
                  <li className="flex items-start gap-3"><div className="w-5 h-5 rounded bg-orange-500 shrink-0 shadow-inner mt-0.5"></div><span><strong>Laranja:</strong> Acima de 7 dias. Entra na classificação de Média Permanência.</span></li>
                  <li className="flex items-start gap-3"><div className="w-5 h-5 rounded bg-purple-500 shrink-0 shadow-inner mt-0.5"></div><span><strong>Roxo:</strong> Acima de 15 dias. Limiar de Longa Permanência. Exige atuação forte do NIR, Serviço Social e CCIH para resolver os gargalos de desospitalização e prevenir infecções.</span></li>
                  <li className="flex items-start gap-3"><div className="w-5 h-5 rounded bg-slate-800 shrink-0 shadow-inner mt-0.5"></div><span><strong>Preto:</strong> Extrema Permanência (&gt; 30 dias). Históricos cronificados, sociais ou liminares judiciais.</span></li>
                </ul>
              </section>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4 border-b pb-3">
                    <svg className="w-6 h-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" /></svg>
                    Botões de Ação Clínica
                  </h3>
                  <ul className="space-y-4 text-sm text-slate-600 font-medium">
                    <li><strong>EMAD / Retaguarda:</strong> Sinaliza que o paciente possui perfil para desospitalização (domiciliar ou retaguarda clínica). Use esta tag para encontrar facilmente esses pacientes e agilizar os trâmites de transferência junto aos demais setores.</li>
                    <li><strong>Provável Alta 24/48h:</strong> Indica que o paciente tem previsão de saída. A equipe deve focar em resolver as pendências (ex: exames, transporte) para garantir que ele saia dentro do previsto. Se o tempo estourar, o sistema alerta para investigar o gargalo.</li>
                    <li><strong>Fluxo Trauma:</strong> Sinaliza os pacientes que deram entrada por trauma com fratura e que preenchem os critérios do Fluxo Trauma da Regulação Estadual (SES/SC).</li>
                    <li><strong>Botão de Medicação:</strong> Serve para monitorar ciclos de medicamentos com prazo definido (como antibióticos). O sistema conta os dias automaticamente e pisca em vermelho quando o tempo previsto acaba.</li>
                    <li><strong>Especialidades:</strong> O sistema importa a especialidade do relatório MV. Ao clicar na especialidade no card do paciente, você pode alterar quem assumiu o caso (Especialidade Principal) e incluir outras equipes acompanhantes. O Nexus protege sua alteração manual para que ela não seja apagada na próxima sincronização.</li>
                    <li><strong>Relatório de Rondas:</strong> Gera um relatório otimizado em PDF (ou impressão) com o cruzamento dos dados do paciente e suas pendências, ideal para ser levado fisicamente durante a ronda nos leitos.</li>
                  </ul>
                </section>

                <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4 border-b pb-3">
                    <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                    Sincronização Segura
                  </h3>
                  <p className="text-sm text-slate-600 font-medium leading-relaxed">
                    A Sincronização importa a planilha do MV. Todo e qualquer paciente que já tem Botões engatilhados (como Especialidades Manuais, Medicações e SISREG) fica <strong>Puro e Fechado</strong> dentro do Nexus.
                    O MV apenas atualiza os dados bio, leitos atuais e expurga os pacientes que receberam Alta oficial do hospital.
                  </p>
                </section>
              </div>

              <section className="bg-rose-50 p-6 rounded-2xl border border-rose-200 shadow-sm">
                <h3 className="text-lg font-bold text-rose-800 flex items-center gap-2 mb-3">
                  <svg className="w-6 h-6 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  O Que NÃO Fazer
                </h3>
                <p className="text-sm text-rose-700 font-bold leading-relaxed mb-2">Exclusivo: A Lei do Botão Próprio!</p>
                <div className="bg-white p-4 rounded-xl text-rose-600 text-[13px] font-medium leading-relaxed border border-rose-100 flex items-start gap-4">
                  <svg className="w-6 h-6 shrink-0 opacity-80 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                  <p>Evite usar o campo Livre de <strong>Notas da Equipe</strong> para transcrever dados operacionais que já possuem botões/modais próprios (como agendar antibiótico em andamento, marcar previsão temporal de alta médica, ou ditar especialidades). <strong>Utilize os botões originais no card!</strong> Isso mantém nossa infraestrutura analítica viva e nossos painéis 100% acurados.</p>
                </div>
              </section>

            </div>
          </div>
        </div>
      )}

      {/* ===== EASTER EGG MODAL: ENF. THIAGO ===== */}
      {modalThiagoAberto && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease-in-out]"
          onClick={(e) => { if (e.target === e.currentTarget) setModalThiagoAberto(false); }}
        >
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden">

            {/* Cabeçalho Kawaii */}
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-6 text-center relative overflow-hidden">
              <div className="absolute -top-6 -left-6 w-32 h-32 bg-white/10 rounded-full" />
              <div className="absolute -bottom-8 -right-4 w-28 h-28 bg-white/10 rounded-full" />
              <div className="text-4xl mb-2 relative z-10">📋✨</div>
              <h2 className="text-xl font-black text-white relative z-10">Oie, Enf. Thiago!</h2>
              <p className="text-indigo-100 text-xs mt-1 relative z-10">Aqui o seu resumo especial do censo 💜</p>
            </div>

            {/* Corpo do Modal */}
            <div className="p-5 flex flex-col gap-4">

              {/* Alerta Condicional de Desatualização */}
              {isDesatualizado && (
                <div className="bg-amber-50 border border-amber-300 rounded-2xl p-3.5 flex gap-3 items-start">
                  <span className="text-2xl shrink-0">⚠️</span>
                  <p className="text-amber-800 text-xs font-medium leading-relaxed">
                    <strong>Opa!</strong> Notei que o último censo foi importado há mais de 1 hora
                    {diferencaMinutos !== null && ` (${diferencaMinutos} min atrás)`}. Os dados abaixo
                    podem estar desatualizados. Que tal dar uma atualizada no relatório antes de
                    confiar nesses números? 😉
                  </p>
                </div>
              )}

              {/* Lista de Setores com Contagem */}
              <div className="flex flex-col gap-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Pacientes nos seus Setores-Foco</p>
                {SETORES_FOCO_THIAGO.map(setor => (
                  <div key={setor} className="flex items-center justify-between px-3 py-2.5 bg-slate-50 hover:bg-indigo-50 rounded-xl border border-slate-200 hover:border-indigo-200 transition-colors">
                    <span className="text-xs font-semibold text-slate-700 truncate pr-2">{setor}</span>
                    <span className={`text-sm font-black shrink-0 px-2.5 py-0.5 rounded-full ${
                      contagemThiago[setor] === 0
                        ? 'bg-slate-200 text-slate-500'
                        : 'bg-indigo-100 text-indigo-700'
                    }`}>
                      {contagemThiago[setor]}
                    </span>
                  </div>
                ))}
              </div>

              {/* Rodapé Brincalhão */}
              <div className="bg-purple-50 border border-purple-200 rounded-2xl p-3.5 flex gap-3 items-start">
                <span className="text-xl shrink-0">📞</span>
                <p className="text-purple-800 text-xs font-medium leading-relaxed">
                  Mas ó, os pacientes <strong>em observação</strong> eu ainda não consigo ver por
                  aqui, então pra esses você ainda vai ter que dar aquela ligadinha! 💖
                </p>
              </div>

              {/* Botão Fechar */}
              <button
                onClick={() => setModalThiagoAberto(false)}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl transition-colors shadow-md shadow-indigo-600/20"
              >
                Entendido! 👍
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ========================================= */}

      {/* ===== MODAL PCP: CONFIRMAÇÃO CLÍNICA ===== */}
      {modalPCPConfirmar && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/65 backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease-in-out]"
          onClick={(e) => { if (e.target === e.currentTarget) setModalPCPConfirmar(null); }}
        >
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">

            {/* Cabeçalho */}
            <div className="bg-gradient-to-br from-teal-500 to-emerald-600 p-6 relative overflow-hidden">
              <div className="absolute -top-6 -right-6 w-32 h-32 bg-white/10 rounded-full" />
              <div className="text-3xl mb-2 relative z-10">🏥</div>
              <h2 className="text-lg font-black text-white relative z-10">Protocolo de Capacidade Plena</h2>
              <p className="text-teal-100 text-xs mt-1 relative z-10">
                Sinalizando <strong className="text-white">{modalPCPConfirmar.nome}</strong> como apto para leito PCP.
              </p>
            </div>

            {/* Corpo */}
            <div className="p-5 flex flex-col gap-4">

              {/* Aviso */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2 items-start text-xs text-amber-800 font-medium">
                <span className="text-base shrink-0">⚠️</span>
                <span>Confirme <strong>visualmente</strong> com o paciente que <strong>todos</strong> os critérios abaixo são atendidos antes de sinalizar.</span>
              </div>

              {/* Checklist de Critérios */}
              <div className="flex flex-col gap-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Critérios Obrigatórios do PCP</p>
                {[
                  'Tem entre 18 e 60 anos.',
                  'Não tem acompanhante.',
                  'Não é obeso.',
                  'Não faz uso de dispositivos ligados à tomada.',
                  'Está lúcido, orientado, comunicativo, deambula sem auxílio, com alimentação via oral e faz necessidades e banho sozinho no banheiro.'
                ].map((criterio, i) => (
                  <div key={i} className="flex items-start gap-2.5 bg-teal-50 border border-teal-200 rounded-xl px-3 py-2.5">
                    <div className="w-5 h-5 rounded-full bg-teal-500 flex items-center justify-center shrink-0 mt-0.5">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <p className="text-xs text-teal-800 font-medium leading-snug">{criterio}</p>
                  </div>
                ))}
              </div>

              {/* Botões */}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setModalPCPConfirmar(null)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={async () => {
                    try {
                      await togglePCP(modalPCPConfirmar.id, true);
                      toast.success(`${modalPCPConfirmar.nome} sinalizado(a) como elegível para leito PCP.`);
                      setModalPCPConfirmar(null);
                    } catch { toast.error('Erro ao sinalizar PCP.'); }
                  }}
                  className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 rounded-xl transition-colors shadow-md shadow-teal-600/20"
                >
                  Confirmar Elegibilidade PCP
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ============================================ */}

      {/* ===== MODAL PCP: CONFIRMAÇÃO DE REMOÇÃO ===== */}
      {modalPCPRemover && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease-in-out]"
          onClick={(e) => { if (e.target === e.currentTarget) setModalPCPRemover(null); }}
        >
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">🏥</div>
              <h3 className="text-lg font-bold text-slate-800 mb-1">Remover PCP?</h3>
              <p className="text-slate-500 text-sm">
                Deseja remover a sinalização PCP de <strong className="text-slate-700">{modalPCPRemover.nome}</strong>?
              </p>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button
                onClick={() => setModalPCPRemover(null)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  try {
                    await togglePCP(modalPCPRemover.id, false);
                    toast.info(`Sinalização PCP removida de ${modalPCPRemover.nome}.`);
                    setModalPCPRemover(null);
                  } catch { toast.error('Erro ao remover PCP.'); }
                }}
                className="flex-1 bg-slate-700 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl transition-colors"
              >
                Remover PCP
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ============================================== */}

      {/* ===== MODAL: RELATÓRIO GERENCIAL SISREG ===== */}
      {showRelatorioSisreg && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/75 backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease-in-out]"
          onClick={(e) => { if (e.target === e.currentTarget) setShowRelatorioSisreg(false); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden border border-slate-200 max-h-[90vh]">

            {/* Header técnico */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <h2 className="text-base font-bold text-slate-800">Relatório Gerencial — SISREG</h2>
              </div>
              <button onClick={() => setShowRelatorioSisreg(false)} className="text-slate-400 hover:text-slate-600 transition-colors bg-slate-100 hover:bg-slate-200 p-1.5 rounded-lg">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* ESTÁGIO 1: Filtro de período */}
            {!relatorioGerado && (
              <div className="p-8 flex flex-col gap-6">
                <div>
                  <p className="text-xs text-blue-500 font-semibold mb-1">Selecione o período para análise das inserções diárias.</p>
                  <h3 className="text-lg font-bold text-slate-800">Parâmetros do Relatório</h3>
                  <p className="text-slate-500 text-sm mt-1">O retrato atual sempre reflete o censo em tempo real.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Data Inicial</label>
                    <input
                      type="date"
                      value={relatorioFiltro.dataInicial}
                      onChange={e => setRelatorioFiltro(prev => ({ ...prev, dataInicial: e.target.value }))}
                      className="w-full bg-white border border-slate-300 text-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Data Final</label>
                    <input
                      type="date"
                      value={relatorioFiltro.dataFinal}
                      onChange={e => setRelatorioFiltro(prev => ({ ...prev, dataFinal: e.target.value }))}
                      className="w-full bg-white border border-slate-300 text-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                    />
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (!relatorioFiltro.dataInicial || !relatorioFiltro.dataFinal) {
                      return toast.warning('Selecione os dois períodos antes de gerar o relatório.');
                    }
                    const dtInicio = new Date(relatorioFiltro.dataInicial + 'T00:00:00');
                    const dtFim = new Date(relatorioFiltro.dataFinal + 'T23:59:59');
                    if (dtInicio > dtFim) return toast.warning('A data inicial deve ser anterior à data final.');

                    // ── Motor de Agregação de Dados ──────────────────────────────────────
                    // 1. Inserções por dia: percorre sisreg_historico de todos os pacientes
                    const insercoesMap = {}; // { 'DD/MM/YYYY': count }

                    pacientes.forEach(p => {
                      const historico = p.sisreg_historico || [];
                      historico.forEach(evento => {
                        if (evento.acao !== 'SISREG Registrado') return;
                        const dtEvento = new Date(evento.dataHora);
                        if (dtEvento >= dtInicio && dtEvento <= dtFim) {
                          const chave = dtEvento.toLocaleDateString('pt-BR');
                          insercoesMap[chave] = (insercoesMap[chave] || 0) + 1;
                        }
                      });
                    });

                    // Ordena as chaves por data crescente
                    const insercoesOrdenadas = Object.entries(insercoesMap).sort((a, b) => {
                      const [dA, mA, yA] = a[0].split('/');
                      const [dB, mB, yB] = b[0].split('/');
                      return new Date(`${yA}-${mA}-${dA}`) - new Date(`${yB}-${mB}-${dB}`);
                    });

                    // 2. Retrato Atual do censo
                    let totalComSisreg = 0, totalPendente = 0, totalDevolvido = 0, totalFinalizado = 0;
                    pacientes.forEach(p => {
                      const status = p.sisreg_status || (p.numeroSisreg ? 'PENDENTE' : null);
                      if (!status || status === 'SEM SISREG') return;
                      totalComSisreg++;
                      if (status === 'PENDENTE') totalPendente++;
                      else if (status === 'DEVOLVIDO') totalDevolvido++;
                      else if (status === 'FINALIZADO') totalFinalizado++;
                    });

                    setRelatorioGerado({
                      periodo: { inicio: relatorioFiltro.dataInicial, fim: relatorioFiltro.dataFinal },
                      insercoesOrdenadas,
                      retrato: { totalComSisreg, totalPendente, totalDevolvido, totalFinalizado }
                    });
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  Gerar Relatório
                </button>
              </div>
            )}

            {/* ESTÁGIO 2: Visualização Técnica */}
            {relatorioGerado && (() => {
              const fmt = (isoDate) => {
                const [y, m, d] = isoDate.split('-');
                return `${d}/${m}/${y}`;
              };

              const gerarTextoWhatsApp = () => {
                const { periodo, insercoesOrdenadas, retrato } = relatorioGerado;
                const totalInsercoes = insercoesOrdenadas.reduce((acc, [, n]) => acc + n, 0);

                let texto = `*📊 RELATÓRIO GERENCIAL SISREG*\n`;
                texto += `_Período: ${fmt(periodo.inicio)} a ${fmt(periodo.fim)}_\n`;
                texto += `_Gerado em: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}_\n\n`;

                texto += `*📅 Inserções no período (${totalInsercoes} total):*\n`;
                if (insercoesOrdenadas.length === 0) {
                  texto += `_Nenhuma inserção registrada neste período._\n`;
                } else {
                  insercoesOrdenadas.forEach(([dia, qtd]) => {
                    texto += `› ${dia}: *${qtd}* solicitação${qtd !== 1 ? 'ões' : ''}\n`;
                  });
                }

                texto += `\n*🏥 Retrato Atual das Solicitações:*\n`;
                texto += `› Total de SISREGs Ativos: *${retrato.totalComSisreg}*\n`;
                texto += `› Aguardando Devolutiva (Pendentes): *${retrato.totalPendente}*\n`;
                texto += `› Aguardando Nossa Resposta (Devolvidos): *${retrato.totalDevolvido}*\n`;
                texto += `› Finalizados: *${retrato.totalFinalizado}*\n`;
                texto += `\n_Fonte: Nexus HMSJ — Kanban de Altas_`;

                return texto;
              };

              return (
                <div className="flex flex-col overflow-hidden">
                  {/* Sub-header de resultado */}
                  <div className="px-6 py-3 bg-blue-50 border-b border-slate-200 flex items-center justify-between gap-4">
                    <span className="text-xs text-blue-700 font-semibold">✓ Relatório gerado · Período: {fmt(relatorioGerado.periodo.inicio)} – {fmt(relatorioGerado.periodo.fim)}</span>
                    <button onClick={() => setRelatorioGerado(null)} className="text-xs text-slate-500 hover:text-slate-700 transition-colors">← Novo período</button>
                  </div>

                  <div className="p-6 overflow-y-auto flex flex-col gap-5">

                    {/* Card: Inserções por dia */}
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2 bg-slate-50">
                        <span className="text-blue-500 text-base">📅</span>
                        <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Inserções por Dia</span>
                        <span className="ml-auto text-xs text-slate-400">{relatorioGerado.insercoesOrdenadas.reduce((a, [, n]) => a + n, 0)} total</span>
                      </div>
                      <div className="p-4">
                        {relatorioGerado.insercoesOrdenadas.length === 0 ? (
                          <p className="text-xs text-slate-400 italic">Nenhuma inserção registrada neste período.</p>
                        ) : (
                          <div className="flex flex-col gap-2">
                            {relatorioGerado.insercoesOrdenadas.map(([dia, qtd]) => (
                              <div key={dia} className="flex items-center gap-3">
                                <span className="text-xs text-slate-500 w-24 shrink-0">{dia}</span>
                                <div className="flex-1 bg-slate-100 rounded-full h-2">
                                  <div
                                    className="bg-blue-400 h-2 rounded-full transition-all"
                                    style={{ width: `${Math.min(100, (qtd / Math.max(...relatorioGerado.insercoesOrdenadas.map(([, n]) => n))) * 100)}%` }}
                                  />
                                </div>
                                <span className="text-sm font-black text-blue-600 w-6 text-right shrink-0">{qtd}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card: Retrato Atual */}
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2 bg-slate-50">
                        <span className="text-blue-500 text-base">🏥</span>
                        <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Retrato Atual do Censo</span>
                        <span className="ml-auto text-[10px] text-slate-400 italic">tempo real</span>
                      </div>
                      <div className="p-4 grid grid-cols-2 gap-3">
                        {[
                          { label: 'Total com SISREG', valor: relatorioGerado.retrato.totalComSisreg, cor: 'bg-blue-50 border-blue-100 text-blue-800' },
                          { label: 'Pendentes', valor: relatorioGerado.retrato.totalPendente, cor: 'bg-amber-50 border-amber-100 text-amber-800' },
                          { label: 'Devolvidos', valor: relatorioGerado.retrato.totalDevolvido, cor: 'bg-rose-50 border-rose-100 text-rose-800' },
                          { label: 'Finalizados', valor: relatorioGerado.retrato.totalFinalizado, cor: 'bg-emerald-50 border-emerald-100 text-emerald-800' }
                        ].map(({ label, valor, cor }) => (
                          <div key={label} className={`border rounded-lg p-4 flex flex-col ${cor}`}>
                            <span className="text-3xl font-black">{valor}</span>
                            <span className="text-[10px] font-bold uppercase tracking-wide mt-1 leading-tight opacity-70">{label}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Botão Copiar para WhatsApp */}
                    <button
                      onClick={() => {
                        const texto = gerarTextoWhatsApp();
                        navigator.clipboard.writeText(texto)
                          .then(() => toast.success('✅ Copiado para a área de transferência! Cole diretamente no WhatsApp.', { autoClose: 4000 }))
                          .catch(() => toast.error('Falha ao copiar. Tente novamente.'));
                      }}
                      className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3.5 rounded-lg transition-colors flex items-center justify-center gap-3 text-sm shadow"
                    >
                      {/* Ícone WhatsApp */}
                      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                      Copiar Relatório para WhatsApp
                    </button>

                    <p className="text-center text-[10px] text-slate-400">Cole o texto copiado diretamente em qualquer conversa do WhatsApp.</p>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
      {/* ================================================= */}

    </div>
  );
}