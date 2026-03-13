import { useState, useEffect } from 'react';
import {
  collection,
  query,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
  writeBatch
} from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { ubsfJoinville } from '../../../utils/UBSFJoinville';
import { calcularPrioridadeSigtap } from '../../../utils/prioridades';

// IMPORTAÇÕES DO TOASTIFY
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function GestaoAihs() {
  const [todasSolicitacoes, setTodasSolicitacoes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState('');

  // ESTADOS DO MODAL DE DELEÇÃO
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [solicitacaoParaDeletar, setSolicitacaoParaDeletar] = useState(null);

  // Estados do Modal de Prioridade
  const [modalPrioridadeAberto, setModalPrioridadeAberto] = useState(false);
  const [pacientePrioridadeAlvo, setPacientePrioridadeAlvo] = useState(null);
  const [prioridadeSelecionada, setPrioridadeSelecionada] = useState('NENHUMA');

  // Controle dos Acordeões
  const [grupoAberto, setGrupoAberto] = useState('');

  // Estados do Sidebar
  const [sidebarAberto, setSidebarAberto] = useState(false);
  const [solicitacaoAtiva, setSolicitacaoAtiva] = useState(null);
  const [dadosPacienteAtivo, setDadosPacienteAtivo] = useState(null);

  // Estados para o Parecer
  const [numeroSisreg, setNumeroSisreg] = useState('');
  const [decisao, setDecisao] = useState('');

  // Campos dinâmicos dependendo da decisão
  const [motivoDivergencia, setMotivoDivergencia] = useState('');
  const [sisregOriginal, setSisregOriginal] = useState('');
  const [dataSisregOriginal, setDataSisregOriginal] = useState('');
  const [contraReferencia, setContraReferencia] = useState('');
  const [unidadeReferencia, setUnidadeReferencia] = useState('');

  // NOVOS CAMPOS PARA DECISÃO DA SES/SC
  const [motivoNegativaSes, setMotivoNegativaSes] = useState('');

  // 1. Busca TODAS as solicitações em Tempo Real (Ativas, Concluídas e Negadas)
  useEffect(() => {
    setBusca('');
    const q = query(collection(db, 'nexus_eletivas_solicitacoes'));
    const unsubscribe = onSnapshot(q, async (querySnapshot) => {
      const lista = [];
      const batch = writeBatch(db);
      let batchCount = 0;

      querySnapshot.forEach((docSnap) => {
        const sol = { id: docSnap.id, ...docSnap.data() };
        lista.push(sol);

        // Higienização Reativa e Econômica (Evita Writes Desnecessários)
        const codigoReferencia = sol.codigoProcedimento || sol.procedimento;
        const novaPrioridade = calcularPrioridadeSigtap(codigoReferencia, sol.prioridade);

        if (novaPrioridade !== (sol.prioridade || 'NENHUMA')) {
          batch.update(docSnap.ref, { prioridade: novaPrioridade });
          batchCount++;
          // Atualiza em memória para a listagem imediata
          sol.prioridade = novaPrioridade;
        }
      });

      if (batchCount > 0) {
        try {
          await batch.commit();
          console.log(`[HIGIENIZAÇÃO NEXUS] ${batchCount} AIHs priorizadas automaticamente (SIGTAP Oncológico).`);
        } catch (error) {
          console.error('[HIGIENIZAÇÃO NEXUS] Erro ao atualizar prioridades:', error);
        }
      }

      lista.sort(
        (a, b) => new Date(a.dataSolicitacao) - new Date(b.dataSolicitacao)
      );
      setTodasSolicitacoes(lista);
    });
    return () => unsubscribe();
  }, []);

  const solicitacoesFiltradas = todasSolicitacoes.filter((sol) => {
    if (busca.trim() === '') return true;
    const termo = busca.toLowerCase();
    return (
      sol.nomePaciente?.toLowerCase().includes(termo) ||
      sol.cns?.includes(termo) ||
      sol.numeroSisreg?.includes(termo)
    );
  });

  const grupos = [
    {
      titulo: 'Aguarda Número do SISREG',
      statusOriginais: ['AGUARDA NÚMERO SISREG'],
      cor: 'orange',
      descricao: 'AIHs cadastradas no sistema mas que não possuem ainda um número de SISREG registrado, aguarda inclusão manual ou pelo robôzinho',
    },
    {
      titulo: 'Validação SISREG (Fila de Entrada)',
      statusOriginais: ['VALIDAÇÃO SISREG'],
      cor: 'amber',
      descricao: 'Pacientes que já possuem numero de SISREG, mas que aguardam um desfecho. Monitore o SISREG com frequência para ver se não há devolutivas.',
    },
    {
      titulo: 'Devoluções por Divergência / Duplicidade',
      statusOriginais: ['DIVERGENCIA ENCONTRADA', 'DUPLICIDADE'],
      cor: 'red',
      descricao: 'AIHs devolvidas pelo SISREG com alguma divergência. Devolva as solicitações para o ambulatório para correção da divergência.',
    },
    {
      titulo: 'Deliberação 66/CIB/2018',
      statusOriginais: ['DELIBERAÇÃO 66/CIB/2018'],
      cor: 'purple',
      descricao: 'Pacientes que não possuem atendimento ambulatorial. Realizar a contrarreferência dessas solicitações no Sistema Olostech, registrando o número da contrarreferência e a UBSF direcionada (apenas para pacientes de Joinville)',
    },
    {
      titulo: 'Continuidade de Atendimento',
      statusOriginais: ['CONTINUIDADE DE ATENDIMENTO'],
      cor: 'purple',
      descricao: 'Pacientes que se encaixam nas regras de continuidade de atendimento e devem seguir o fluxo orientado pela SES/SC no anexo 5 da Deliberação 66/CIB/2018',
    },
    {
      titulo: 'Trauma-Fratura',
      statusOriginais: ['TRAUMA-FRATURA'],
      cor: 'purple',
      descricao: 'Pacientes deram entrada por trauma fratura e devem seguir o fluxo 4 da Deliberação 66/CIB/2018',
    },
    {
      titulo: 'Autorizadas (Mapa Cirúrgico Estadual)',
      statusOriginais: ['AUTORIZADO MAPA CIRURGICO'],
      cor: 'blue',
      descricao: 'Solicitações que foram aprovadas no mapa cirurgico do Estado e estão aptas para agendamento cirúrgico. Direcionar para equipe de marcação cirurgica das respectivas pastas',
    },
    {
      titulo: 'Negadas (SES/SC)',
      statusOriginais: ['NEGADO SES/SC'],
      cor: 'slate',
      descricao: 'Solicitações negadas por algum motivo pelo Estado, não seguem para agendamento da cirurgia.',
    },
  ];

  const abrirDetalhes = async (solicitacao) => {
    setSolicitacaoAtiva(solicitacao);
    setNumeroSisreg(solicitacao.numeroSisreg || '');
    setDecisao(solicitacao.status);

    setMotivoDivergencia(solicitacao.motivoDivergencia || '');
    setSisregOriginal(solicitacao.sisregOriginal || '');
    setDataSisregOriginal(solicitacao.dataSisregOriginal || '');
    setContraReferencia(solicitacao.contraReferencia || '');
    setUnidadeReferencia(solicitacao.unidadeReferencia || '');
    setMotivoNegativaSes(solicitacao.motivoNegativaSes || '');

    setSidebarAberto(true);

    try {
      const pacRef = doc(
        db,
        'nexus_eletivas_pacientes',
        solicitacao.pacienteId
      );
      const pacSnap = await getDoc(pacRef);
      if (pacSnap.exists()) setDadosPacienteAtivo(pacSnap.data());
    } catch (error) {
      console.error('Erro:', error);
    }
  };

  const fecharSidebar = () => {
    setSidebarAberto(false);
    setTimeout(() => {
      setSolicitacaoAtiva(null);
      setDadosPacienteAtivo(null);
    }, 300);
  };

  // --- FUNÇÕES DO MODAL DE DELEÇÃO ---
  const handleClickDeletar = (e, sol) => {
    e.stopPropagation(); // Impede que o clique na lixeira abra o sidebar
    setSolicitacaoParaDeletar(sol);
    setShowDeleteModal(true);
  };

  const cancelarDelecao = () => {
    setShowDeleteModal(false);
    setSolicitacaoParaDeletar(null);
  };

  const confirmarDelecao = async () => {
    if (!solicitacaoParaDeletar) return;

    setShowDeleteModal(false);
    setLoading(true);

    try {
      await deleteDoc(
        doc(db, 'nexus_eletivas_solicitacoes', solicitacaoParaDeletar.id)
      );
      if (solicitacaoAtiva?.id === solicitacaoParaDeletar.id) fecharSidebar();
      toast.success('Solicitação excluída permanentemente.');
    } catch (error) {
      console.error('Erro ao excluir:', error);
      toast.error('Erro ao excluir solicitação do banco de dados.');
    } finally {
      setLoading(false);
      setSolicitacaoParaDeletar(null);
    }
  };

  const fecharModalPrioridade = () => {
    setModalPrioridadeAberto(false);
    setPacientePrioridadeAlvo(null);
    setPrioridadeSelecionada('NENHUMA');
  };

  const handleSalvarPrioridade = async () => {
    if (!pacientePrioridadeAlvo) return;

    setLoading(true);
    try {
      const solRef = doc(db, 'nexus_eletivas_solicitacoes', pacientePrioridadeAlvo.id);
      const dataHoraAtual = new Date().toLocaleString('pt-BR');

      const historicoAntigo = pacientePrioridadeAlvo.historico || [];
      const novaLinhaHistorico = {
        dataHora: dataHoraAtual,
        de: pacientePrioridadeAlvo.prioridade || 'NENHUMA',
        para: prioridadeSelecionada,
        usuario: 'Regulador',
        detalhes: `Prioridade alterada para: ${prioridadeSelecionada}`
      };

      await updateDoc(solRef, {
        prioridade: prioridadeSelecionada,
        historico: [...historicoAntigo, novaLinhaHistorico]
      });

      toast.success('Prioridade atualizada com sucesso!');
      fecharModalPrioridade();
    } catch (error) {
      console.error('Erro ao atualizar prioridade:', error);
      toast.error('Erro ao atualizar a prioridade do paciente.');
    } finally {
      setLoading(false);
    }
  };

  const salvarParecerRegulacao = async (e) => {
    e.preventDefault();

    if (decisao === 'DIVERGENCIA ENCONTRADA' && !motivoDivergencia)
      return toast.warning('Descreva a divergência encontrada.');
    if (decisao === 'DUPLICIDADE' && (!sisregOriginal || !dataSisregOriginal))
      return toast.warning('Informe o número do SISREG original e a data.');
    if (
      decisao === 'DELIBERAÇÃO 66/CIB/2018' &&
      (!contraReferencia || !unidadeReferencia)
    )
      return toast.warning('Informe a contrarreferência e a unidade.');
    if (decisao === 'NEGADO SES/SC' && !motivoNegativaSes)
      return toast.warning('Informe o motivo da negativa da SES.');

    setLoading(true);
    try {
      const dataHoraAtual = new Date().toLocaleString('pt-BR');
      const solRef = doc(
        db,
        'nexus_eletivas_solicitacoes',
        solicitacaoAtiva.id
      );

      // Define a 'situacao' macro baseada no status escolhido
      let decisaoFinal = decisao;
      let alteracaoAutomaticaStatus = false;

      // REGRAS DE TRANSIÇÃO AUTOMÁTICA
      if (
        solicitacaoAtiva.status === 'AGUARDA NÚMERO SISREG' &&
        decisao === 'AGUARDA NÚMERO SISREG' &&
        numeroSisreg.trim() !== ''
      ) {
        decisaoFinal = 'VALIDAÇÃO SISREG';
        alteracaoAutomaticaStatus = true;
      }

      let novaSituacao = 'ATIVA';
      if (decisaoFinal === 'AUTORIZADO MAPA CIRURGICO') novaSituacao = 'CONCLUÍDA';
      if (decisaoFinal === 'NEGADO SES/SC') novaSituacao = 'NEGADO';

      const payloadAtualizacao = {
        numeroSisreg: numeroSisreg.trim(),
        status: decisaoFinal,
        situacao: novaSituacao,
      };

      if (!solicitacaoAtiva.numeroSisreg && numeroSisreg.trim() !== '') {
        payloadAtualizacao.dataInclusaoSisreg = dataHoraAtual;
      }

      // Adiciona os campos específicos da decisão
      if (decisaoFinal === 'DIVERGENCIA ENCONTRADA')
        payloadAtualizacao.motivoDivergencia = motivoDivergencia.trim();
      if (decisaoFinal === 'DUPLICIDADE') {
        payloadAtualizacao.sisregOriginal = sisregOriginal.trim();
        payloadAtualizacao.dataSisregOriginal = dataSisregOriginal;
      }
      if (decisaoFinal === 'DELIBERAÇÃO 66/CIB/2018') {
        payloadAtualizacao.contraReferencia = contraReferencia.trim();
        payloadAtualizacao.unidadeReferencia = unidadeReferencia.trim();
      }
      if (decisaoFinal === 'NEGADO SES/SC')
        payloadAtualizacao.motivoNegativaSes = motivoNegativaSes.trim();

      if (alteracaoAutomaticaStatus || solicitacaoAtiva.status !== decisaoFinal) {
        const historicoAntigo = solicitacaoAtiva.historico || [];

        let novaLinhaHistorico = {
          dataHora: dataHoraAtual,
          de: solicitacaoAtiva.status,
          para: decisaoFinal,
          usuario: alteracaoAutomaticaStatus ? 'Sistema (Auto)' : 'Regulador',
          detalhes: '',
        };

        if (alteracaoAutomaticaStatus) {
          novaLinhaHistorico.detalhes = 'Status alterado automaticamente para VALIDAÇÃO SISREG após inserção do número SISREG.';
        } else {
          let detalhesExtra = '';
          if (decisaoFinal === 'DIVERGENCIA ENCONTRADA')
            detalhesExtra = `Motivo: ${motivoDivergencia.trim()}`;
          if (decisaoFinal === 'DUPLICIDADE')
            detalhesExtra = `SISREG Original: ${sisregOriginal}`;
          if (decisaoFinal === 'DELIBERAÇÃO 66/CIB/2018')
            detalhesExtra = `Olostech: ${contraReferencia} / Unid: ${unidadeReferencia}`;
          if (decisaoFinal === 'AUTORIZADO MAPA CIRURGICO')
            detalhesExtra = `Autorizado no Mapa Estadual`;
          if (decisaoFinal === 'NEGADO SES/SC')
            detalhesExtra = `Motivo SES: ${motivoNegativaSes.trim()}`;

          novaLinhaHistorico.detalhes = detalhesExtra;
        }

        payloadAtualizacao.historico = [...historicoAntigo, novaLinhaHistorico];
      }

      await updateDoc(solRef, payloadAtualizacao);
      toast.success(
        'Parecer salvo com sucesso! O paciente foi movido de fila.'
      );
      fecharSidebar();
    } catch (error) {
      console.error('Erro ao salvar parecer:', error);
      toast.error('Erro ao salvar o parecer no banco de dados.');
    } finally {
      setLoading(false);
    }
  };

  const formatarData = (d) => {
    if (!d) return '';
    try {
      if (typeof d === 'string' && d.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [ano, mes, dia] = d.split('-');
        return `${dia}/${mes}/${ano}`;
      }
      if (d.seconds) {
        const dataDt = new Date(d.seconds * 1000);
        return dataDt.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
      }
      const dataDt = new Date(d);
      return dataDt.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
    } catch (e) {
      console.error('Erro na conversão de data:', e);
      return d;
    }
  };

  return (
    <div className="flex flex-col h-full relative pb-4 text-nexus-text">
      <ToastContainer position="top-right" theme="colored" />

      {/* OVERLAY DE CARREGAMENTO GLOBAL */}
      {loading && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-nexus-bg/70 backdrop-blur-sm transition-opacity">
          <div className="bg-nexus-card p-8 rounded-2xl shadow-2xl flex flex-col items-center max-w-sm w-full mx-4 animate-[fadeIn_0.2s_ease-in-out]">
            <div className="w-14 h-14 border-4 border-nexus-border border-t-nexus-primary rounded-full animate-spin mb-4"></div>
            <h3 className="text-lg font-bold text-nexus-text mb-1">
              Processando...
            </h3>
            <p className="text-base text-nexus-text/70 text-center">
              Atualizando os dados no sistema, aguarde.
            </p>
          </div>
        </div>
      )}

      {/* MODAL DE DELEÇÃO CUSTOMIZADO */}
      {showDeleteModal && solicitacaoParaDeletar && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-nexus-bg/70 backdrop-blur-sm transition-opacity">
          <div className="bg-nexus-card border border-nexus-border rounded-2xl shadow-2xl max-w-md w-full p-6 mx-4 animate-[fadeIn_0.2s_ease-in-out]">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mb-4">
                <svg
                  className="w-8 h-8"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-nexus-text mb-2">
                Excluir Solicitação?
              </h3>
              <p className="text-nexus-text/80 text-base mb-6">
                Tem certeza que deseja excluir a solicitação de{' '}
                <span className="font-bold text-nexus-text uppercase">
                  {solicitacaoParaDeletar.nomePaciente}
                </span>
                ? Essa ação não apaga o cadastro do paciente, mas a{' '}
                <strong>solicitação será removida permanentemente</strong>.
              </p>
              <div className="flex w-full gap-3">
                <button
                  onClick={cancelarDelecao}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-nexus-text font-medium py-2.5 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmarDelecao}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 rounded-xl transition-shadow shadow-md shadow-red-600/20"
                >
                  Excluir Definitivamente
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE PRIORIDADE */}
      {modalPrioridadeAberto && pacientePrioridadeAlvo && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-nexus-bg/70 backdrop-blur-sm transition-opacity">
          <div className="bg-nexus-card border border-nexus-border rounded-2xl shadow-2xl max-w-sm w-full p-6 mx-4 animate-[fadeIn_0.2s_ease-in-out]">
            <div className="flex flex-col text-left">
              <h3 className="text-xl font-bold text-nexus-text mb-1 border-b pb-2">
                Alterar Prioridade
              </h3>
              <p className="text-nexus-text/80 text-base mb-4">
                Paciente: <span className="font-bold">{pacientePrioridadeAlvo.nomePaciente}</span>
              </p>

              <div className="flex flex-col gap-3 py-2">
                <label className="flex items-center gap-3 cursor-pointer p-3 border rounded-xl hover:bg-slate-50 transition-colors">
                  <input
                    type="radio"
                    name="prioridade"
                    value="NENHUMA"
                    checked={prioridadeSelecionada === 'NENHUMA'}
                    onChange={(e) => setPrioridadeSelecionada(e.target.value)}
                    className="w-4 h-4 text-nexus-primary focus:ring-nexus-primary"
                  />
                  <span className="font-medium text-base text-nexus-text">NENHUMA</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer p-3 border rounded-xl hover:bg-amber-50 transition-colors border-amber-200">
                  <input
                    type="radio"
                    name="prioridade"
                    value="CARTA DE PRIORIDADE"
                    checked={prioridadeSelecionada === 'CARTA DE PRIORIDADE'}
                    onChange={(e) => setPrioridadeSelecionada(e.target.value)}
                    className="w-4 h-4 text-amber-600 focus:ring-amber-500"
                  />
                  <span className="font-bold text-base text-amber-700">CARTA DE PRIORIDADE</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer p-3 border rounded-xl hover:bg-red-50 transition-colors border-red-200">
                  <input
                    type="radio"
                    name="prioridade"
                    value="ONCOLOGIA"
                    checked={prioridadeSelecionada === 'ONCOLOGIA'}
                    onChange={(e) => setPrioridadeSelecionada(e.target.value)}
                    className="w-4 h-4 text-red-600 focus:ring-red-500"
                  />
                  <span className="font-bold text-base text-red-700">ONCOLOGIA</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer p-3 border rounded-xl hover:bg-red-50 transition-colors border-red-200">
                  <input
                    type="radio"
                    name="prioridade"
                    value="JUDICIAL"
                    checked={prioridadeSelecionada === 'JUDICIAL'}
                    onChange={(e) => setPrioridadeSelecionada(e.target.value)}
                    className="w-4 h-4 text-red-600 focus:ring-red-500"
                  />
                  <span className="font-bold text-base text-red-700">JUDICIAL</span>
                </label>
              </div>

              <div className="flex w-full gap-3 mt-6">
                <button
                  onClick={fecharModalPrioridade}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-nexus-text font-medium py-2.5 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSalvarPrioridade}
                  disabled={loading}
                  className="flex-1 bg-nexus-primary hover:opacity-90 text-white font-bold py-2.5 rounded-xl transition-all shadow-md"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-nexus-text">
            Painel de Gestão e Pareceres
          </h2>
          <p className="text-base text-nexus-text/70">
            Listagem de solicitações ativas, concluídas e negadas agrupadas por
            status.
          </p>
        </div>

        <div className="relative w-full md:w-96 shrink-0">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg
              className="h-5 w-5 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Buscar Nome, CNS ou SISREG..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full bg-nexus-card border border-nexus-border text-nexus-text rounded-xl pl-10 pr-10 py-2.5 focus:outline-none focus:ring-2 focus:ring-nexus-primary/50 shadow-sm transition-shadow"
          />
          {busca && (
            <button
              onClick={() => setBusca('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-red-500 transition-colors"
              title="Limpar Busca"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 max-w-6xl mx-auto w-full">
        {grupos.map((grupo, index) => {
          const solicitacoesDoGrupo = solicitacoesFiltradas.filter((sol) => {
            if (grupo.titulo === 'Aguarda Número do SISREG') {
              return sol.status === 'AGUARDA NÚMERO SISREG' || (sol.status === 'VALIDAÇÃO SISREG' && !sol.numeroSisreg);
            }
            if (grupo.titulo === 'Validação SISREG (Fila de Entrada)') {
              return sol.status === 'VALIDAÇÃO SISREG' && !!sol.numeroSisreg;
            }
            return grupo.statusOriginais.includes(sol.status);
          });
          const isOpen = grupoAberto === grupo.titulo;

          // As cores semânticas foram mantidas pois são essenciais para indicar a urgência/status do acordeão
          const bgColors = {
            amber:
              'bg-amber-100/50 hover:bg-amber-100 text-amber-800 border-amber-200',
            orange:
              'bg-orange-100/50 hover:bg-orange-100 text-orange-800 border-orange-200',
            emerald:
              'bg-emerald-100/50 hover:bg-emerald-100 text-emerald-800 border-emerald-200',
            red: 'bg-red-100/50 hover:bg-red-100 text-red-800 border-red-200',
            purple:
              'bg-purple-100/50 hover:bg-purple-100 text-purple-800 border-purple-200',
            blue: 'bg-blue-100/50 hover:bg-blue-100 text-blue-800 border-blue-200',
            slate:
              'bg-slate-100/50 hover:bg-slate-100 text-slate-800 border-slate-200',
          };
          const dotColors = {
            amber: 'bg-amber-500',
            orange: 'bg-orange-500',
            emerald: 'bg-emerald-500',
            red: 'bg-red-500',
            purple: 'bg-purple-500',
            blue: 'bg-blue-500',
            slate: 'bg-slate-500',
          };

          return (
            <div
              key={index}
              className="bg-nexus-card border border-nexus-border rounded-2xl overflow-hidden shadow-sm transition-all"
            >
              <button
                onClick={() => setGrupoAberto(isOpen ? '' : grupo.titulo)}
                className={`w-full px-6 py-4 flex items-center justify-between border-b transition-colors ${bgColors[grupo.cor]
                  } ${!isOpen && 'border-transparent'}`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-3 h-3 rounded-full shrink-0 ${dotColors[grupo.cor]} shadow-sm`}
                  ></span>
                  <div className="flex flex-col text-left">
                    <h3 className="font-bold text-base uppercase tracking-wide">
                      {grupo.titulo}
                    </h3>
                    {grupo.descricao && (
                      <span className="text-base text-inherit/70 italic normal-case tracking-normal mt-0.5">
                        {grupo.descricao}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="bg-white/60 font-bold px-3 py-1 rounded-full text-base backdrop-blur-sm">
                    {solicitacoesDoGrupo.length}
                  </span>
                  <svg
                    className={`w-5 h-5 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''
                      }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </button>

              {isOpen && (
                <div>
                  <table className="w-full table-fixed text-left text-sm text-nexus-text">
                    <thead className="bg-slate-50 text-sm text-nexus-text/70 font-medium border-b border-nexus-border">
                      <tr>
                        <th className="px-6 py-3 w-[35%] lg:w-[40%]">Nome Completo / CNS</th>
                        {grupo.titulo !== 'Aguarda Número do SISREG' && (
                          <th className="px-6 py-3 w-[15%]">SISREG</th>
                        )}
                        <th className="px-6 py-3 text-center w-[15%]">Prioridade</th>
                        <th className="px-6 py-3 w-[15%]">Solicitado Em</th>
                        <th className="px-6 py-3 w-[25%] lg:w-[20%]">Especialidade / Médico</th>
                        <th className="px-6 py-3 text-center w-28">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-nexus-border/50">
                      {solicitacoesDoGrupo.length === 0 ? (
                        <tr>
                          <td
                            colSpan="6"
                            className="px-6 py-8 text-center text-nexus-text/50"
                          >
                            Nenhuma solicitação nesta etapa.
                          </td>
                        </tr>
                      ) : (
                        solicitacoesDoGrupo.map((sol) => (
                          <tr
                            key={sol.id}
                            className="hover:bg-slate-50 transition-colors group"
                          >
                            <td className="px-6 py-3 break-words whitespace-normal">
                              <div
                                className="font-bold text-nexus-text flex items-center gap-2 cursor-pointer hover:text-nexus-primary transition-colors inline-block break-words"
                                title="Copiar Nome"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(sol.nomePaciente);
                                  toast.success('Nome copiado para a área de transferência!');
                                }}
                              >
                                {sol.nomePaciente}
                                {sol.prioridade === 'SIM' && (
                                  <span className="bg-red-100 text-red-700 text-[9px] px-1.5 py-0.5 rounded animate-pulse inline-block align-middle ml-1">
                                    URGENTE
                                  </span>
                                )}
                              </div>
                              <div
                                className="text-[11px] text-nexus-text/50 font-mono mt-0.5 cursor-pointer hover:text-nexus-primary transition-colors block"
                                title="Copiar CNS"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(sol.cns || '');
                                  toast.success('CNS copiado para a área de transferência!');
                                }}
                              >
                                {sol.cns}
                              </div>
                              {/* Novo campo de Procedimento (SIGTAP) */}
                              {(() => {
                                let cod = sol.codigoProcedimento;
                                let desc = sol.descricaoProcedimento;

                                // Fallback caso os dados estejam numa única string 'procedimento'
                                if (!cod && !desc && sol.procedimento) {
                                  const parts = sol.procedimento.split(' - ');
                                  if (parts.length >= 2) {
                                    cod = parts[0];
                                    desc = parts.slice(1).join(' - ');
                                  } else {
                                    desc = sol.procedimento;
                                  }
                                }

                                if (!cod && !desc) return null;

                                return (
                                  <div className="flex items-center gap-2 mt-1.5">
                                    {cod && (
                                      <span className="bg-slate-100 text-slate-600 text-[10px] px-2.5 py-0.5 rounded-full font-mono border border-slate-200 shrink-0 shadow-sm leading-tight">
                                        {cod}
                                      </span>
                                    )}
                                    {desc && (
                                      <span
                                        className="text-[11px] text-slate-500 truncate max-w-[140px] md:max-w-[200px]"
                                        title={desc}
                                      >
                                        {desc}
                                      </span>
                                    )}
                                  </div>
                                );
                              })()}
                            </td>
                            {grupo.titulo !== 'Aguarda Número do SISREG' && (
                              <td className="px-6 py-3 font-mono font-bold text-nexus-text">
                                {sol.numeroSisreg || (
                                  <span className="text-nexus-text/40 font-medium italic text-sm">
                                    Pendente
                                  </span>
                                )}
                              </td>
                            )}
                            <td className="px-6 py-3 text-center align-middle">
                              {(() => {
                                const prio = sol.prioridade || 'NENHUMA';
                                let corBadge = 'bg-slate-100 text-slate-500 border-slate-200';

                                if (prio === 'ONCOLOGIA' || prio === 'JUDICIAL') {
                                  corBadge = 'bg-red-100 text-red-700 border-red-200 animate-pulse font-bold';
                                } else if (prio === 'CARTA DE PRIORIDADE') {
                                  corBadge = 'bg-amber-100 text-amber-700 border-amber-200 font-bold';
                                }

                                return (
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${corBadge} shrink-0 whitespace-nowrap`}>
                                    {prio === 'CARTA DE PRIORIDADE' ? 'CARTA' : prio}
                                  </span>
                                );
                              })()}
                            </td>
                            <td className="px-6 py-3 break-words whitespace-normal text-nexus-text/70">
                              {formatarData(sol.dataSolicitacao)}
                            </td>
                            <td className="px-6 py-3 break-words whitespace-normal">
                              <div className="font-medium text-nexus-text line-clamp-2">
                                {sol.especialidade}
                              </div>
                              <div className="text-[11px] text-nexus-text/60 line-clamp-2 mt-0.5">
                                {sol.medico}
                              </div>
                            </td>
                            <td className="px-6 py-3">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    abrirDetalhes(sol);
                                  }}
                                  className="text-blue-500 hover:text-blue-700 p-1.5 transition-colors bg-blue-50 hover:bg-blue-100 rounded-lg shrink-0"
                                  title="Visualizar Detalhes"
                                >
                                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPacientePrioridadeAlvo(sol);
                                    setPrioridadeSelecionada(sol.prioridade || 'NENHUMA');
                                    setModalPrioridadeAberto(true);
                                  }}
                                  className="text-amber-400 hover:text-amber-600 p-1.5 transition-colors bg-amber-50 hover:bg-amber-100 rounded-lg"
                                  title="Alterar Prioridade"
                                >
                                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={(e) => handleClickDeletar(e, sol)}
                                  className="text-slate-300 hover:text-red-500 p-1.5 transition-colors bg-slate-50 hover:bg-red-50 rounded-lg"
                                  title="Excluir Solicitação"
                                >
                                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {sidebarAberto && (
        <div
          className="fixed inset-0 bg-nexus-bg/50 backdrop-blur-sm z-40 transition-opacity"
          onClick={fecharSidebar}
        ></div>
      )}

      <div
        className={`fixed top-0 right-0 h-full w-full max-w-[480px] bg-nexus-card shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${sidebarAberto ? 'translate-x-0' : 'translate-x-full'
          }`}
      >
        {solicitacaoAtiva && (
          <>
            <div className="px-6 py-4 border-b border-nexus-border flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-nexus-text text-lg flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-nexus-primary"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Auditoria de AIH
              </h3>
              <button
                onClick={fecharSidebar}
                className="p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 rounded-full transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8 custom-scrollbar pb-8">
              <section>
                <h4 className="text-sm font-bold text-nexus-primary uppercase tracking-widest mb-3 border-b border-slate-100 pb-1 flex items-center gap-2">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                  Informações do Paciente
                </h4>
                {dadosPacienteAtivo ? (
                  <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="col-span-2">
                      <p className="text-[10px] text-slate-500 uppercase">
                        Nome Completo
                      </p>
                      <p className="font-bold text-nexus-text text-base">
                        {dadosPacienteAtivo.nome}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase">
                        Cartão SUS (CNS)
                      </p>
                      <p className="font-mono text-nexus-text text-base">
                        {dadosPacienteAtivo.cns}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase">
                        Nascimento
                      </p>
                      <p className="text-nexus-text text-base">
                        {formatarData(dadosPacienteAtivo.dataNascimento)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase">
                        Município
                      </p>
                      <p className="text-nexus-text text-base">
                        {dadosPacienteAtivo.cidade}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase">
                        Sexo
                      </p>
                      <p className="text-nexus-text text-base">
                        {dadosPacienteAtivo.sexo === 'M'
                          ? 'MASCULINO'
                          : 'FEMININO'}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-[10px] text-slate-500 uppercase">
                        Nome da Mãe
                      </p>
                      <p className="text-nexus-text text-base truncate">
                        {dadosPacienteAtivo.nomeMae}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 text-slate-400 text-base">
                    Carregando paciente...
                  </div>
                )}
              </section>

              <section>
                <h4 className="text-sm font-bold text-nexus-primary uppercase tracking-widest mb-3 border-b border-slate-100 pb-1 flex items-center gap-2">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  Detalhes da Solicitação
                </h4>
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 relative overflow-hidden">
                  {solicitacaoAtiva.prioridade === 'SIM' && (
                    <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg">
                      URGENTE
                    </div>
                  )}
                  <div className="col-span-2 mt-2">
                    <p className="text-[10px] text-slate-500 uppercase">
                      Procedimento (SIGTAP)
                    </p>
                    <p className="font-bold text-nexus-text text-base leading-tight">
                      {solicitacaoAtiva.codigoProcedimento} -{' '}
                      {solicitacaoAtiva.descricaoProcedimento}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase">
                      Prioridade Atual
                    </p>
                    <p className="font-bold text-nexus-primary text-base">
                      {solicitacaoAtiva.prioridade || 'NENHUMA'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase">
                      CID 10
                    </p>
                    <p className="font-mono text-nexus-text text-base">
                      {solicitacaoAtiva.cid}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase">
                      Data do Pedido
                    </p>
                    <p className="text-nexus-text text-base">
                      {formatarData(solicitacaoAtiva.dataSolicitacao)}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[10px] text-slate-500 uppercase">
                      Origem
                    </p>
                    <p className="text-nexus-text text-base">
                      {solicitacaoAtiva.origem}
                    </p>
                  </div>
                  {solicitacaoAtiva.origem !== 'PAM Boa Vista' && (
                    <>
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase">
                          Prontuário
                        </p>
                        <p className="text-nexus-text text-base">
                          {solicitacaoAtiva.prontuario}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase">
                          Nº Consulta
                        </p>
                        <p className="text-nexus-text text-base">
                          {solicitacaoAtiva.consulta}
                        </p>
                      </div>
                    </>
                  )}
                  <div className="col-span-2 pt-2 border-t border-slate-200">
                    <p className="text-[10px] text-slate-500 uppercase">
                      Médico e Especialidade
                    </p>
                    <p className="text-nexus-text text-base font-medium">
                      {solicitacaoAtiva.medico}{' '}
                      <span className="text-slate-400 font-normal">
                        | {solicitacaoAtiva.especialidade}
                      </span>
                    </p>
                  </div>

                  {/* Informações pós-decisão mostradas na leitura */}
                  {solicitacaoAtiva.motivoNegativaSes && (
                    <div className="col-span-2 pt-2 border-t border-slate-200">
                      <p className="text-[10px] text-slate-500 uppercase">
                        Motivo Negativa SES
                      </p>
                      <p className="text-red-600 font-medium text-base">
                        {solicitacaoAtiva.motivoNegativaSes}
                      </p>
                    </div>
                  )}
                </div>
              </section>

              <section>
                <h4 className="text-sm font-bold text-nexus-primary uppercase tracking-widest mb-3 flex items-center gap-2 border-b border-slate-100 pb-1">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Linha do Tempo
                </h4>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-col gap-3">
                  {solicitacaoAtiva.historico &&
                    solicitacaoAtiva.historico.length > 0 ? (
                    solicitacaoAtiva.historico.map((hist, idx) => (
                      <div
                        key={idx}
                        className="relative pl-4 border-l-2 border-slate-300"
                      >
                        <div className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-slate-400"></div>
                        <p className="text-[10px] text-slate-400 font-mono">
                          {hist.dataHora} • {hist.usuario}
                        </p>
                        <p className="text-sm font-medium text-nexus-text mt-0.5">
                          <span className="text-slate-400 line-through mr-1">
                            {hist.de}
                          </span>{' '}
                          ➔{' '}
                          <span className="text-nexus-primary font-bold ml-1">
                            {hist.para}
                          </span>
                        </p>
                        {hist.detalhes && (
                          <p className="text-[11px] text-red-600 mt-1 italic border-l-2 border-red-200 pl-2">
                            {hist.detalhes}
                          </p>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-400 italic">
                      Nenhum histórico registrado.
                    </p>
                  )}
                </div>
              </section>

              <section className="mt-auto">
                <h4 className="text-sm font-bold text-amber-600 uppercase tracking-widest mb-3 flex items-center gap-2 border-b border-amber-100 pb-1">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                  Ação / Parecer da Regulação
                </h4>
                <form
                  onSubmit={salvarParecerRegulacao}
                  className="bg-amber-50 p-5 rounded-xl border border-amber-200 flex flex-col gap-4 shadow-sm"
                >
                  <div>
                    <label className="block text-sm font-bold text-amber-800 mb-1">
                      Número do SISREG
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: 123456789"
                      value={numeroSisreg}
                      onChange={(e) =>
                        setNumeroSisreg(e.target.value.replace(/\D/g, ''))
                      }
                      className="w-full bg-white border border-amber-300 text-nexus-text rounded-lg px-4 py-2 font-mono focus:ring-2 focus:ring-amber-500"
                    />
                    {solicitacaoAtiva.dataInclusaoSisreg && (
                      <p className="text-[10px] text-amber-600 mt-1">
                        Lançado em: {solicitacaoAtiva.dataInclusaoSisreg}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-amber-800 mb-1">
                      Alterar Status do Pedido
                    </label>
                    <select
                      value={decisao}
                      onChange={(e) => setDecisao(e.target.value)}
                      className="w-full bg-white border border-amber-300 rounded-lg px-3 py-2.5 text-sm font-medium text-nexus-text focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="AGUARDA NÚMERO SISREG">
                        PENDENTE - Aguarda Número do SISREG
                      </option>
                      <option value="VALIDAÇÃO SISREG">
                        PENDENTE - Validação SISREG
                      </option>
                      <option value="AUTORIZADO MAPA CIRURGICO">
                        CONCLUÍDA - Autorizado Mapa SES/SC
                      </option>
                      <option value="NEGADO SES/SC">
                        NEGADA - Rejeitada pela SES/SC
                      </option>
                      <option value="DUPLICIDADE">
                        DEVOLVER - Duplicidade identificada
                      </option>
                      <option value="DIVERGENCIA ENCONTRADA">
                        DEVOLVER - Divergência CID/Procedimento
                      </option>
                      <option value="DELIBERAÇÃO 66/CIB/2018">
                        RETER - Deliberação 66/CIB/2018 (Anexo 1)
                      </option>
                      <option value="CONTINUIDADE DE ATENDIMENTO">
                        RETER - Continuidade Atend. (Anexo 5)
                      </option>
                      <option value="TRAUMA-FRATURA">
                        RETER - Trauma/Fratura (Anexo 4)
                      </option>
                    </select>
                  </div>

                  {decisao === 'DIVERGENCIA ENCONTRADA' && (
                    <div className="animate-[fadeIn_0.2s_ease-in-out]">
                      <label className="block text-sm font-bold text-red-700 mb-1">
                        Detalhes da Divergência (Obrigatório)
                      </label>
                      <textarea
                        required
                        rows="2"
                        placeholder="Descreva a divergência encontrada..."
                        value={motivoDivergencia}
                        onChange={(e) => setMotivoDivergencia(e.target.value)}
                        className="w-full bg-white border border-red-300 text-nexus-text rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 resize-none"
                      ></textarea>
                    </div>
                  )}

                  {decisao === 'DUPLICIDADE' && (
                    <div className="animate-[fadeIn_0.2s_ease-in-out] grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-bold text-red-700 mb-1">
                          SISREG Original
                        </label>
                        <input
                          type="text"
                          required
                          value={sisregOriginal}
                          onChange={(e) =>
                            setSisregOriginal(e.target.value.replace(/\D/g, ''))
                          }
                          className="w-full bg-white border border-red-300 text-nexus-text rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500"
                          placeholder="Nº Antigo"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-red-700 mb-1">
                          Data Original
                        </label>
                        <input
                          type="date"
                          required
                          value={dataSisregOriginal}
                          onChange={(e) =>
                            setDataSisregOriginal(e.target.value)
                          }
                          className="w-full bg-white border border-red-300 text-nexus-text rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500"
                        />
                      </div>
                    </div>
                  )}

                  {decisao === 'DELIBERAÇÃO 66/CIB/2018' && (() => {
                    // Regra de negócio: verifica se o paciente reside em Joinville
                    // para determinar o fluxo de contrarreferência adequado.
                    const isJoinville = dadosPacienteAtivo?.cidade?.toUpperCase().trim() === 'JOINVILLE';

                    if (isJoinville) {
                      // Paciente de Joinville: fluxo padrão via sistema Olostech
                      return (
                        <div className="animate-[fadeIn_0.2s_ease-in-out] grid grid-cols-1 gap-3">
                          <div>
                            <label className="block text-sm font-bold text-purple-700 mb-1">
                              Nº Contrarreferência (Olostech)
                            </label>
                            <input
                              type="text"
                              required
                              value={contraReferencia}
                              onChange={(e) => setContraReferencia(e.target.value)}
                              className="w-full bg-white border border-purple-300 text-nexus-text rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 uppercase"
                              placeholder="Ex: 12345"
                            />
                          </div>
                          <div>
                            <label className="block text-base font-bold text-purple-700 mb-1">
                              Unidade de Referência
                            </label>
                            <input
                              type="text"
                              required
                              list="lista-ubsf"
                              placeholder="Digite para buscar a unidade..."
                              value={unidadeReferencia}
                              onChange={(e) => setUnidadeReferencia(e.target.value)}
                              className="w-full bg-white border border-purple-300 text-nexus-text rounded-lg px-3 py-2 text-base focus:ring-2 focus:ring-purple-500 uppercase"
                            />
                            <datalist id="lista-ubsf">
                              {ubsfJoinville.map((ubsf) => (
                                <option key={ubsf} value={ubsf}>{ubsf}</option>
                              ))}
                            </datalist>
                          </div>
                        </div>
                      );
                    }

                    // Paciente de outro município: fluxo via malote/e-mail institucional
                    const nomeCidade = dadosPacienteAtivo?.cidade || 'informado no cadastro';
                    return (
                      <div className="animate-[fadeIn_0.2s_ease-in-out] bg-blue-50 border-l-4 border-blue-500 p-4 rounded text-blue-800">
                        <div className="flex items-start gap-3">
                          <svg className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p className="text-sm font-medium leading-relaxed">
                            Para realizar a contrarreferência deste paciente para o município de origem (<span className="font-bold uppercase">{nomeCidade}</span>), faça a devolução via <span className="font-bold">e-mail ou malote institucional</span>.
                          </p>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Campos Dinâmicos: Mapa SES/SC */}
                  {decisao === 'NEGADO SES/SC' && (
                    <div className="animate-[fadeIn_0.2s_ease-in-out]">
                      <label className="block text-sm font-bold text-slate-700 mb-1">
                        Motivo da Negativa SES
                      </label>
                      <textarea
                        required
                        rows="2"
                        placeholder="Descreva o motivo informado pela SES..."
                        value={motivoNegativaSes}
                        onChange={(e) => setMotivoNegativaSes(e.target.value)}
                        className="w-full bg-white border border-slate-300 text-nexus-text rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-slate-500 resize-none"
                      ></textarea>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={
                      loading ||
                      (decisao === solicitacaoAtiva.status &&
                        numeroSisreg === (solicitacaoAtiva.numeroSisreg || ''))
                    }
                    className="w-full bg-nexus-primary hover:bg-opacity-90 text-white font-bold py-3 mt-2 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading
                      ? 'Salvando...'
                      : decisao === solicitacaoAtiva.status
                        ? 'Atualizar Número do SISREG'
                        : 'Gravar Parecer e Mover Paciente'}
                  </button>
                </form>
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
