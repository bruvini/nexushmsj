import { useState, useEffect, useRef } from 'react';
import {
  collection, query, getDocs, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, serverTimestamp, writeBatch, where, orderBy, limit
} from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { cidadesSC } from '../../../utils/cidadesSC';
import { calcularPrioridadeSigtap } from '../../../utils/prioridades';
import ImportacaoLote from './ImportacaoLote';
import DashboardKpis from './DashboardKpis';

// IMPORTAÇÕES DO TOASTIFY
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function CadastroSolicitacoes() {
  const [cnsBusca, setCnsBusca] = useState('');
  const [etapa, setEtapa] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pacientes, setPacientes] = useState([]);
  const [contagemSolicitacoes, setContagemSolicitacoes] = useState({});

  // ESTADOS DO MODAL DE DELEÇÃO
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [pacienteParaDeletar, setPacienteParaDeletar] = useState(null);

  const [filtroTabela, setFiltroTabela] = useState('');
  const [paginaAtual, setPaginaAtual] = useState(1);
  const itensPorPagina = 50;

  const [dbProcedimentos, setDbProcedimentos] = useState([]);
  const [dbMedicos, setDbMedicos] = useState([]);

  const [isEditingPaciente, setIsEditingPaciente] = useState(false);
  const [pacienteAtivo, setPacienteAtivo] = useState(null);
  const formPacienteRef = useRef(null);

  const [formDataPaciente, setFormDataPaciente] = useState({
    nome: '', cns: '', dataNascimento: '', cidade: '', sexo: '', nomeMae: '',
  });

  const [formDataSolicitacao, setFormDataSolicitacao] = useState({
    origem: '', dataSolicitacao: '', prontuario: '', consulta: '', cid: '',
    procedimento: '', especialidade: '', medico: '', prioridade: 'NÃO', numeroSisreg: '',
  });

  const [buscaProc, setBuscaProc] = useState('');
  const [mostrarDropdownProc, setMostrarDropdownProc] = useState(false);

  // --- UTILITÁRIOS DE DATA (Versão Blindada) ---
  const converterDataParaInput = (dataVal) => {
    if (!dataVal) return '';

    // Converte para string e limpa os espaços
    let dataStr = String(dataVal).trim();

    // Se a data já veio no formato ISO do banco (YYYY-MM-DD), devolve igual
    if (/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) return dataStr;

    // Remove as horas se o Excel mandou "29/10/1993 00:00:00" ou similar
    if (dataStr.includes(' ')) {
      dataStr = dataStr.split(' ')[0];
    }

    // Se estiver no formato Brasileiro (DD/MM/YYYY) ou (DD/MM/YY)
    if (dataStr.includes('/')) {
      let parts = dataStr.split('/');
      // Pega o ano (parts[2]), o mês (parts[1]) e o dia (parts[0])
      if (parts.length === 3) {
        // Ajusta anos com 2 digitos (Ex: "93" vira "1993", "05" vira "2005")
        let ano = parts[2];
        if (ano.length === 2) {
          ano = parseInt(ano, 10) > 30 ? `19${ano}` : `20${ano}`;
        }
        return `${ano}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }

    return dataStr; // Retorno de escape
  };

  const normalizeString = (val) => {
    if (!val) return '';
    return String(val).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
  };

  // --- EFEITOS DE CARREGAMENTO ---
  useEffect(() => {
    const qPacientes = query(
      collection(db, 'nexus_eletivas_pacientes'),
      orderBy('criadoEm', 'desc'),
      limit(20)
    );
    const unsubPacientes = onSnapshot(qPacientes, (snap) => {
      setPacientes(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    const unsubProc = onSnapshot(query(collection(db, 'nexus_eletivas_procedimentos')), (snap) => {
      setDbProcedimentos(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    const unsubMed = onSnapshot(query(collection(db, 'nexus_eletivas_medicos')), (snap) => {
      setDbMedicos(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    const unsubCounts = onSnapshot(query(collection(db, 'nexus_eletivas_solicitacoes')), (snap) => {
      const counts = {};
      snap.forEach((doc) => {
        const pId = doc.data().pacienteId;
        if (pId) counts[pId] = (counts[pId] || 0) + 1;
      });
      setContagemSolicitacoes(counts);
    });

    return () => { unsubPacientes(); unsubProc(); unsubMed(); unsubCounts(); };
  }, []);

  // --- IMPORTAÇÃO EM LOTE INTELIGENTE (SMART UPSERT) ---
  const handleImportarDados = async (resultadoExcel) => {
    if (!resultadoExcel || !resultadoExcel.dados || resultadoExcel.dados.length === 0) {
      toast.warning('Nenhum dado encontrado na planilha.');
      return;
    }

    setLoading(true);

    try {
      const { totalAmbulatorial, dados } = resultadoExcel;
      let batch = writeBatch(db);
      let operacoesBatchCount = 0;
      const dataHoraAtual = new Date().toLocaleString('pt-BR');

      let countPacientesNovos = 0;
      let countPacientesExistentes = 0;
      let countSolicsNovas = 0;
      let countSolicsAtualizadas = 0;
      let countSolicsIgnoradas = 0;
      let linhasDuplicadasNoExcel = 0;

      // 1. CARGA IN-MEMORY GLOBAL (Otimização de Leitura - Custo: 2 GETs)
      const pacientesSnap = await getDocs(collection(db, 'nexus_eletivas_pacientes'));
      const aihsSnap = await getDocs(collection(db, 'nexus_eletivas_solicitacoes'));

      const pacientesMemoria = pacientesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const aihsMemoria = aihsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // 2. PRÉ-PROCESSAMENTO: MANTER APENAS A SOLICITAÇÃO MAIS RECENTE DA PLANILHA PARA EVITAR DUPLICIDADE INTRA-ARQUIVO
      const dadosFiltrados = [];
      const mapUltimaDataExcel = new Map();

      for (const row of dados) {
        const codProc = String(row.cod_proc_solicitado || '');
        if (!codProc) continue; // Necessário ter procedimento

        // Chave temporária flexível (CNS ou Nome)
        const identificador = row.nr_cns ? String(row.nr_cns).trim() : normalizeString(row.nm_paciente);
        const chave = `${identificador}_${codProc}`;
        const dataRowStr = converterDataParaInput(row.dt_solicitacao);
        const dataRowTime = new Date(dataRowStr).getTime() || 0;

        const existente = mapUltimaDataExcel.get(chave);
        if (existente) {
          linhasDuplicadasNoExcel++;
          const dataExistenteTime = new Date(converterDataParaInput(existente.row.dt_solicitacao)).getTime() || 0;
          if (dataRowTime > dataExistenteTime) {
            mapUltimaDataExcel.set(chave, { row, dataTime: dataRowTime });
          }
        } else {
          mapUltimaDataExcel.set(chave, { row, dataTime: dataRowTime });
        }
      }

      mapUltimaDataExcel.forEach((item) => dadosFiltrados.push(item.row));

      // 3. PROCESSAMENTO E SMART UPSERT
      for (const row of dadosFiltrados) {
        const cnsRow = row.nr_cns ? String(row.nr_cns).trim() : '';
        const nomeRow = normalizeString(row.nm_paciente);
        const nascRow = converterDataParaInput(row.dt_nascimento);

        // --- 3.1 DEDUPLICAÇÃO DE PACIENTES ---
        let pacienteEncontrado = pacientesMemoria.find(p => p.nome === nomeRow && p.dataNascimento === nascRow);
        if (!pacienteEncontrado && cnsRow) {
          pacienteEncontrado = pacientesMemoria.find(p => p.cns === cnsRow);
        }

        let pacienteId = null;

        if (!pacienteEncontrado) {
          // CRIAR PACIENTE
          const refNovoPaciente = doc(collection(db, 'nexus_eletivas_pacientes'));
          pacienteId = refNovoPaciente.id;
          const novoPacienteData = {
            id: pacienteId,
            nome: nomeRow,
            cns: cnsRow,
            dataNascimento: nascRow,
            cidade: normalizeString(row.nm_cidade),
            sexo: normalizeString(row.tp_sexo),
            nomeMae: normalizeString(row.nm_mae),
            criadoEm: serverTimestamp(),
          };

          if (operacoesBatchCount >= 450) { await batch.commit(); batch = writeBatch(db); operacoesBatchCount = 0; }
          batch.set(refNovoPaciente, novoPacienteData);
          operacoesBatchCount++;

          pacientesMemoria.push(novoPacienteData); // Cache
          countPacientesNovos++;
        } else {
          // ATUALIZAR PACIENTE
          pacienteId = pacienteEncontrado.id;
          countPacientesExistentes++;

          let atualizouPac = false;
          const updatesPac = {};

          // Regra CNS do SUS (Substitui Provisório '8' por Definitivo '7')
          if (cnsRow.startsWith('7') && (pacienteEncontrado.cns || '').startsWith('8')) {
            updatesPac.cns = cnsRow;
            pacienteEncontrado.cns = cnsRow;
            atualizouPac = true;
          }

          // Atualizar campos vazios
          if (!pacienteEncontrado.prontuario && row.prontuario) {
            updatesPac.prontuario = String(row.prontuario);
            pacienteEncontrado.prontuario = String(row.prontuario);
            atualizouPac = true;
          }
          if (!pacienteEncontrado.atendimentoAmbulatorial && row.atendimentoAmbulatorial) {
            updatesPac.atendimentoAmbulatorial = String(row.atendimentoAmbulatorial);
            pacienteEncontrado.atendimentoAmbulatorial = String(row.atendimentoAmbulatorial);
            atualizouPac = true;
          }

          if (atualizouPac) {
            if (operacoesBatchCount >= 450) { await batch.commit(); batch = writeBatch(db); operacoesBatchCount = 0; }
            batch.update(doc(db, 'nexus_eletivas_pacientes', pacienteId), updatesPac);
            operacoesBatchCount++;
          }
        }

        // --- 3.2 PREPARAÇÃO DA AIH ---
        const codProcOriginal = String(row.cod_proc_solicitado || '');
        const codProcLimpo = codProcOriginal.replace(/^0+/, ''); // Tratamento Vista Grossa / Zeros
        const descProc = normalizeString(row.proc_solicitado);
        const dataSolicitacaoRow = converterDataParaInput(row.dt_solicitacao);
        const medicoRow = normalizeString(row.solicitante);
        const sisregRow = row.nu_internacao ? String(row.nu_internacao).replace(/\D/g, '') : '';
        const prontuarioRow = row.prontuario ? String(row.prontuario) : '';
        const consultaRow = row.nu_consulta ? String(row.nu_consulta) : '';
        const cidRow = normalizeString(row.cd_cid_principal);

        // Prioridade Inicial + Oncológica
        let prioridadeDefinida = 'NENHUMA';
        if (String(row.ds_cond_just_internacao || '').toUpperCase().includes('PRIORIDADE')) {
          prioridadeDefinida = 'CARTA DE PRIORIDADE';
        }
        prioridadeDefinida = calcularPrioridadeSigtap(codProcOriginal, prioridadeDefinida);

        // --- 3.3 DEDUPLICAÇÃO DE AIH (Match Exato) ---
        // Verifica se O MESMO paciente JÁ TEM esse mesmo procedimento, do mesmo médico, na mesma data.
        const aihEncontrada = aihsMemoria.find(aih =>
          aih.pacienteId === pacienteId &&
          String(aih.codigoProcedimento || '').replace(/^0+/, '') === codProcLimpo &&
          aih.dataSolicitacao === dataSolicitacaoRow &&
          aih.medico === medicoRow
        );

        if (!aihEncontrada) {
          // CRIAR NOVA AIH
          const refAih = doc(collection(db, 'nexus_eletivas_solicitacoes'));
          const statusLinha = sisregRow ? 'VALIDAÇÃO SISREG' : 'AGUARDA NÚMERO SISREG';

          const novaAihData = {
            id: refAih.id,
            pacienteId: pacienteId,
            cns: cnsRow || (pacienteEncontrado ? pacienteEncontrado.cns : ''),
            nomePaciente: nomeRow,
            origem: 'IMPORTAÇÃO (Smart Upsert)',
            numeroSisreg: sisregRow,
            dataSolicitacao: dataSolicitacaoRow,
            prioridade: prioridadeDefinida,
            prontuario: prontuarioRow,
            consulta: consultaRow,
            cid: cidRow,
            codigoProcedimento: codProcOriginal,
            descricaoProcedimento: descProc,
            procedimento: `${codProcOriginal} - ${descProc}`,
            especialidade: '',
            medico: medicoRow,
            situacao: 'ATIVA',
            status: statusLinha,
            criadoEm: serverTimestamp(),
            historico: [
              {
                dataHora: dataHoraAtual,
                de: 'IMPORTAÇÃO EM LOTE',
                para: statusLinha,
                usuario: 'Sistema (Smart Upsert)',
              },
            ]
          };

          if (operacoesBatchCount >= 450) { await batch.commit(); batch = writeBatch(db); operacoesBatchCount = 0; }
          batch.set(refAih, novaAihData);
          operacoesBatchCount++;

          aihsMemoria.push(novaAihData); // Cache
          countSolicsNovas++;

        } else {
          // ATUALIZAR AIH EXISTENTE
          let atualizouAih = false;
          const updatesAih = {};

          // Atualiza dados faltantes ou mais recentes
          if (!aihEncontrada.numeroSisreg && sisregRow) {
            updatesAih.numeroSisreg = sisregRow;
            aihEncontrada.numeroSisreg = sisregRow;
            atualizouAih = true;

            // TRANSIÇÃO AUTOMÁTICA DE STATUS
            if (aihEncontrada.status === 'AGUARDA NÚMERO SISREG') {
              updatesAih.status = 'VALIDAÇÃO SISREG';
              aihEncontrada.status = 'VALIDAÇÃO SISREG';
              updatesAih.dataInclusaoSisreg = dataHoraAtual;

              const historicoAnterior = aihEncontrada.historico || [];
              updatesAih.historico = [
                ...historicoAnterior,
                {
                  dataHora: dataHoraAtual,
                  de: 'AGUARDA NÚMERO SISREG',
                  para: 'VALIDAÇÃO SISREG',
                  usuario: 'Sistema (Smart Upsert)',
                  detalhes: 'Status alterado automaticamente para VALIDAÇÃO SISREG após inserção do número SISREG via importação em lote.'
                }
              ];
            }
          }

          if (!aihEncontrada.prontuario && prontuarioRow) { updatesAih.prontuario = prontuarioRow; aihEncontrada.prontuario = prontuarioRow; atualizouAih = true; }
          if (!aihEncontrada.consulta && consultaRow) { updatesAih.consulta = consultaRow; aihEncontrada.consulta = consultaRow; atualizouAih = true; }
          if (!aihEncontrada.cid && cidRow) { updatesAih.cid = cidRow; aihEncontrada.cid = cidRow; atualizouAih = true; }

          if (atualizouAih) {
            if (operacoesBatchCount >= 450) { await batch.commit(); batch = writeBatch(db); operacoesBatchCount = 0; }
            batch.update(doc(db, 'nexus_eletivas_solicitacoes', aihEncontrada.id), updatesAih);
            operacoesBatchCount++;
            countSolicsAtualizadas++;
          } else {
            countSolicsIgnoradas++;
          }
        }
      }

      // 4. COMMIT BATCH FINAL
      if (operacoesBatchCount > 0) {
        await batch.commit();
      }

      toast.success(
        <div className="flex flex-col gap-1">
          <strong className="text-sm">Importação Inteligente Concluída!</strong>
          <span className="text-sm">Linhas processadas: {dadosFiltrados.length}</span>
          <hr className="my-1 border-white/30" />
          <span className="text-sm"><strong className="text-emerald-100">+ {countPacientesNovos}</strong> pacientes novos</span>
          <span className="text-sm"><strong className="text-emerald-100">+ {countSolicsNovas}</strong> AIHs criadas</span>
          <span className="text-sm"><strong className="text-amber-200">~ {countPacientesExistentes}</strong> pacientes e <strong className="text-amber-200">{countSolicsAtualizadas}</strong> AIHs atualizados</span>
          <span className="text-sm"><strong className="text-slate-300">= {countSolicsIgnoradas}</strong> AIHs idênticas no banco</span>
          {linhasDuplicadasNoExcel > 0 && (
            <span className="text-[10px] text-red-200 leading-tight mt-1 border-t border-white/20 pt-1">
              * {linhasDuplicadasNoExcel} duplicidades no próprio Excel foram mescladas.
            </span>
          )}
        </div>,
        { autoClose: 9000 }
      );

      resetarFluxo();
    } catch (error) {
      console.error('Erro no Smart Upsert:', error);
      toast.error('Erro na importação inteligente. Verifique o console.');
    } finally {
      setLoading(false);
    }
  };

  // --- CASCATA DO SIGTAP ---
  const procedimentosFiltrados = buscaProc.trim() === '' ? [] : dbProcedimentos.filter((p) => {
    const termoBusca = buscaProc.replace(/^0+/, '');
    return (p.codigo && p.codigo.includes(termoBusca)) || (p.descricao && p.descricao.includes(buscaProc));
  }).slice(0, 50);

  const handleBuscaProcChange = (e) => {
    const val = e.target.value.toUpperCase();
    setBuscaProc(val);
    setMostrarDropdownProc(true);
    if (formDataSolicitacao.procedimento) setFormDataSolicitacao({ ...formDataSolicitacao, procedimento: '', especialidade: '', medico: '' });
  };

  const selecionarProcedimento = (proc) => {
    setFormDataSolicitacao({ ...formDataSolicitacao, procedimento: `${proc.codigo} - ${proc.descricao}`, especialidade: '', medico: '' });
    setBuscaProc(`${proc.codigo} - ${proc.descricao}`);
    setMostrarDropdownProc(false);
  };

  const procSelecionado = dbProcedimentos.find((p) => `${p.codigo} - ${p.descricao}` === formDataSolicitacao.procedimento);
  const especialidadesDisponiveis = procSelecionado ? procSelecionado.especialidades || [] : [];
  const medicosDisponiveis = formDataSolicitacao.especialidade ? dbMedicos.filter((m) => m.especialidades && m.especialidades.includes(formDataSolicitacao.especialidade)) : [];

  const handlePesquisarCNS = async (e) => {
    e.preventDefault();
    if (cnsBusca.length === 15) {
      setLoading(true);
      try {
        const qCns = query(collection(db, 'nexus_eletivas_pacientes'), where('cns', '==', cnsBusca));
        const snap = await getDocs(qCns);
        if (!snap.empty) {
          const docSnap = snap.docs[0];
          const p = { id: docSnap.id, ...docSnap.data() };
          setPacienteAtivo(p);
          setEtapa(2);
          setBuscaProc('');
        } else {
          setFormDataPaciente({ nome: '', cns: cnsBusca, dataNascimento: '', cidade: '', sexo: '', nomeMae: '' });
          setPacienteAtivo(null);
          setIsEditingPaciente(false);
          setEtapa(1);
        }
      } catch (error) {
        toast.error('Erro ao buscar paciente pelo CNS no Firestore.');
      } finally {
        setLoading(false);
      }
    } else {
      toast.warning('O CNS deve conter exatamente 15 dígitos.');
    }
  };

  const handleAcaoPaciente = async (prosseguir) => {
    if (!formPacienteRef.current.reportValidity()) return;
    setLoading(true);
    try {
      const pData = {
        nome: formDataPaciente.nome.toUpperCase(),
        cns: formDataPaciente.cns,
        dataNascimento: formDataPaciente.dataNascimento,
        cidade: formDataPaciente.cidade,
        sexo: formDataPaciente.sexo,
        nomeMae: formDataPaciente.nomeMae.toUpperCase(),
      };
      let pId;
      if (isEditingPaciente && pacienteAtivo) {
        await updateDoc(doc(db, 'nexus_eletivas_pacientes', pacienteAtivo.id), pData);
        pId = pacienteAtivo.id;
      } else {
        const docRef = await addDoc(collection(db, 'nexus_eletivas_pacientes'), { ...pData, criadoEm: serverTimestamp() });
        pId = docRef.id;
      }
      setPacienteAtivo({ id: pId, ...pData });
      prosseguir ? setEtapa(2) : resetarFluxo();
      setIsEditingPaciente(false);

      if (!prosseguir) toast.success('Dados do paciente salvos!');
    } catch (e) {
      toast.error('Erro ao salvar paciente.');
    } finally {
      setLoading(false);
    }
  };

  const handleSalvarSolicitacao = async (e) => {
    e.preventDefault();
    if (!procSelecionado) return toast.warning('Selecione um procedimento válido na lista.');
    setLoading(true);
    try {
      const dataHoraAtual = new Date().toLocaleString('pt-BR');
      const numeroSisregStr = formDataSolicitacao.numeroSisreg.trim();
      const statusDefinido = numeroSisregStr ? 'VALIDAÇÃO SISREG' : 'AGUARDA NÚMERO SISREG';

      const prioridadeProcessada = calcularPrioridadeSigtap(
        procSelecionado.codigo,
        formDataSolicitacao.prioridade
      );

      const payload = {
        ...formDataSolicitacao,
        prioridade: prioridadeProcessada,
        cid: formDataSolicitacao.cid.toUpperCase(),
        codigoProcedimento: procSelecionado.codigo,
        descricaoProcedimento: procSelecionado.descricao,
        pacienteId: pacienteAtivo.id,
        cns: pacienteAtivo.cns,
        nomePaciente: pacienteAtivo.nome,
        situacao: 'ATIVA',
        status: statusDefinido,
        criadoEm: serverTimestamp(),
        historico: [{ dataHora: dataHoraAtual, de: 'NOVA SOLICITAÇÃO', para: statusDefinido, usuario: 'Sistema' }],
      };

      if (numeroSisregStr) {
        payload.numeroSisreg = numeroSisregStr;
        payload.dataInclusaoSisreg = dataHoraAtual;
      }

      await addDoc(collection(db, 'nexus_eletivas_solicitacoes'), payload);
      toast.success('Solicitação cadastrada com sucesso!');
      resetarFluxo();
    } catch (e) {
      toast.error('Erro ao salvar a solicitação.');
    } finally {
      setLoading(false);
    }
  };

  // --- FUNÇÕES DO MODAL DE DELEÇÃO ---
  const handleClickDeletar = (p) => {
    setPacienteParaDeletar(p);
    setShowDeleteModal(true);
  };

  const cancelarDelecao = () => {
    setShowDeleteModal(false);
    setPacienteParaDeletar(null);
  };

  const confirmarDelecao = async () => {
    if (!pacienteParaDeletar) return;

    setShowDeleteModal(false);
    setLoading(true);

    try {
      const p = pacienteParaDeletar;
      await deleteDoc(doc(db, 'nexus_eletivas_pacientes', p.id));
      const qSols = query(collection(db, 'nexus_eletivas_solicitacoes'), where('pacienteId', '==', p.id));
      const snap = await getDocs(qSols);
      const batch = writeBatch(db);
      snap.forEach((d) => batch.delete(doc(db, 'nexus_eletivas_solicitacoes', d.id)));
      await batch.commit();

      toast.success('Paciente e solicitações excluídos.');
      if (pacienteAtivo?.id === p.id) resetarFluxo();
    } catch (e) {
      toast.error('Erro ao excluir do banco de dados.');
    } finally {
      setLoading(false);
      setPacienteParaDeletar(null);
    }
  };

  const handleEditarPaciente = (p) => {
    setCnsBusca(p.cns);
    setPacienteAtivo(p);
    setIsEditingPaciente(true);
    setFormDataPaciente({
      nome: p.nome,
      cns: p.cns,
      dataNascimento: converterDataParaInput(p.dataNascimento), // Força a conversão na hora de editar
      cidade: p.cidade,
      sexo: p.sexo,
      nomeMae: p.nomeMae,
    });
    setEtapa(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNovaSolicitacaoDireta = (p) => {
    setCnsBusca(p.cns);
    setPacienteAtivo(p);
    setFormDataSolicitacao({
      origem: '', dataSolicitacao: '', prontuario: '', consulta: '', cid: '',
      procedimento: '', especialidade: '', medico: '', prioridade: 'NÃO', numeroSisreg: ''
    });
    setBuscaProc('');
    setEtapa(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetarFluxo = () => {
    setEtapa(0);
    setCnsBusca('');
    setPacienteAtivo(null);
    setIsEditingPaciente(false);
    setBuscaProc('');
    setFormDataPaciente({ nome: '', cns: '', dataNascimento: '', cidade: '', sexo: '', nomeMae: '' });
    setFormDataSolicitacao({ origem: '', dataSolicitacao: '', prontuario: '', consulta: '', cid: '', procedimento: '', especialidade: '', medico: '', prioridade: 'NÃO', numeroSisreg: '' });
  };

  // --- FILTRAGEM SEGURA PARA A TABELA ---
  const isPamBoaVista = formDataSolicitacao.origem === 'PAM Boa Vista';
  const pacientesFiltradosSorted = pacientes
    .filter((p) => {
      const nomeSafe = p.nome || '';
      const cnsSafe = p.cns || '';
      const filtroSafe = filtroTabela.toLowerCase();
      return (nomeSafe.toLowerCase().includes(filtroSafe) || cnsSafe.includes(filtroSafe));
    })
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

  const buscarPacienteTabelaCNS = async () => {
    if (filtroTabela.length !== 15) return;
    setLoading(true);
    try {
      const qCns = query(collection(db, 'nexus_eletivas_pacientes'), where('cns', '==', filtroTabela));
      const snap = await getDocs(qCns);
      if (!snap.empty) {
        const p = { id: snap.docs[0].id, ...snap.docs[0].data() };
        // Atualiza a listagem de pacientes localmente para incluir o paciente buscado,
        // no topo da lista se ele já não existir.
        setPacientes(prev => {
          const withoutP = prev.filter(x => x.cns !== p.cns);
          return [p, ...withoutP];
        });
      } else {
        toast.info('Nenhum paciente encontrado com este CNS.');
      }
    } catch (error) {
      console.error(error);
      toast.error('Erro na busca de paciente pelo CNS.');
    } finally {
      setLoading(false);
    }
  };

  const totalPaginas = Math.ceil(pacientesFiltradosSorted.length / itensPorPagina);
  const pacientesPaginados = pacientesFiltradosSorted.slice((paginaAtual - 1) * itensPorPagina, paginaAtual * itensPorPagina);

  return (
    <div className="flex flex-col gap-6 w-full max-w-5xl mx-auto pb-12 relative">
      <ToastContainer position="top-right" theme="colored" />

      {/* DASHBOARD DE KPIS DE AGREGAÇÃO FIREBASE */}
      <DashboardKpis />

      {/* OVERLAY DE CARREGAMENTO GLOBAL */}
      {loading && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-nexus-bg/70 backdrop-blur-sm transition-opacity">
          <div className="bg-nexus-card p-8 rounded-2xl shadow-2xl flex flex-col items-center max-w-sm w-full mx-4 animate-[fadeIn_0.2s_ease-in-out]">
            <div className="w-14 h-14 border-4 border-nexus-border border-t-nexus-primary rounded-full animate-spin mb-4"></div>
            <h3 className="text-lg font-bold text-nexus-text mb-1">Processando Dados...</h3>
            <p className="text-base text-nexus-text/70 text-center">
              Isso pode levar alguns instantes. Por favor, aguarde e não feche a página.
            </p>
          </div>
        </div>
      )}

      {/* MODAL DE DELEÇÃO CUSTOMIZADO */}
      {showDeleteModal && pacienteParaDeletar && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-nexus-bg/70 backdrop-blur-sm transition-opacity">
          <div className="bg-nexus-card border border-nexus-border rounded-2xl shadow-2xl max-w-md w-full p-6 mx-4 animate-[fadeIn_0.2s_ease-in-out]">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-nexus-text mb-2">Excluir Paciente?</h3>
              <p className="text-nexus-text/80 text-base mb-6">
                Tem certeza que deseja excluir <span className="font-bold text-nexus-text uppercase">{pacienteParaDeletar.nome}</span>? Essa ação é permanente e <strong>apagará todas as solicitações</strong> vinculadas a este cadastro.
              </p>
              <div className="flex w-full gap-3">
                <button onClick={cancelarDelecao} className="flex-1 bg-slate-100 hover:bg-slate-200 text-nexus-text font-medium py-2.5 rounded-xl transition-colors">
                  Cancelar
                </button>
                <button onClick={confirmarDelecao} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 rounded-xl transition-shadow shadow-md shadow-red-600/20">
                  Excluir Definitivamente
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ImportacaoLote onImport={handleImportarDados} />

      {/* BLOCO DE BUSCA CNS */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-medium text-slate-700 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          Buscar Paciente
        </h2>
        <form onSubmit={handlePesquisarCNS} className="flex gap-4">
          <input
            type="text"
            placeholder="Digite o CNS para nova solicitação..."
            className="flex-1 bg-slate-50 border border-slate-300 text-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-500/50 uppercase font-mono"
            value={cnsBusca}
            onChange={(e) => setCnsBusca(e.target.value.replace(/\D/g, ''))}
            disabled={etapa !== 0 || loading}
            required
          />
          {etapa === 0 ? (
            <button type="submit" disabled={loading} className="bg-sky-600 hover:bg-sky-700 text-white font-medium rounded-xl px-8 py-3 transition-colors disabled:opacity-50">Pesquisar</button>
          ) : (
            <button type="button" onClick={resetarFluxo} disabled={loading} className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium rounded-xl px-6 py-3 transition-colors">Nova Busca / Cancelar</button>
          )}
        </form>
      </div>

      {/* ETAPA 1: PACIENTE */}
      {etapa === 1 && (
        <div className="bg-white border border-sky-200 rounded-2xl p-6 shadow-md border-l-4 border-l-sky-500 animate-[fadeIn_0.3s_ease-in-out]">
          <h3 className="text-lg font-semibold text-slate-800 mb-6 border-b pb-4">
            {isEditingPaciente ? 'Atualizar Dados do Paciente' : 'Cadastro de Paciente'}
          </h3>
          <form ref={formPacienteRef} className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-500 mb-1">Nome Completo</label>
              <input type="text" required onInvalid={(e) => e.target.setCustomValidity('Por favor, digite o nome completo do paciente.')} onInput={(e) => { e.target.setCustomValidity(''); setFormDataPaciente({ ...formDataPaciente, nome: e.target.value }); }} value={formDataPaciente.nome} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 uppercase focus:ring-2 focus:ring-sky-500/50" disabled={loading} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">CNS</label>
              <input type="text" required readOnly value={formDataPaciente.cns} className="w-full bg-slate-100 border px-3 py-2 rounded-lg cursor-not-allowed font-mono text-slate-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">Nascimento</label>
              <input type="date" required onInvalid={(e) => e.target.setCustomValidity('Informe a data exata de nascimento do paciente.')} onInput={(e) => { e.target.setCustomValidity(''); setFormDataPaciente({ ...formDataPaciente, dataNascimento: e.target.value }); }} value={formDataPaciente.dataNascimento} className="w-full border px-3 py-2 rounded-lg focus:ring-2 focus:ring-sky-500/50" disabled={loading} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">Cidade</label>
              <select required onInvalid={(e) => e.target.setCustomValidity('Você precisa selecionar a cidade do paciente.')} onInput={(e) => { e.target.setCustomValidity(''); setFormDataPaciente({ ...formDataPaciente, cidade: e.target.value }); }} value={formDataPaciente.cidade} className="w-full border px-3 py-2 rounded-lg uppercase focus:ring-2 focus:ring-sky-500/50" disabled={loading}>
                <option value="">SELECIONE...</option>
                {cidadesSC.map((c) => (<option key={c} value={c}>{c}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">Sexo</label>
              <select required onInvalid={(e) => e.target.setCustomValidity('Selecione o sexo do paciente.')} onInput={(e) => { e.target.setCustomValidity(''); setFormDataPaciente({ ...formDataPaciente, sexo: e.target.value }); }} value={formDataPaciente.sexo} className="w-full border px-3 py-2 rounded-lg focus:ring-2 focus:ring-sky-500/50" disabled={loading}>
                <option value="">Selecione...</option><option value="M">Masculino</option><option value="F">Feminino</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-500 mb-1">Nome da Mãe</label>
              <input type="text" required onInvalid={(e) => e.target.setCustomValidity('Por favor, digite o nome completo da mãe.')} onInput={(e) => { e.target.setCustomValidity(''); setFormDataPaciente({ ...formDataPaciente, nomeMae: e.target.value }); }} value={formDataPaciente.nomeMae} className="w-full border px-3 py-2 rounded-lg uppercase focus:ring-2 focus:ring-sky-500/50" disabled={loading} />
            </div>
            <div className="md:col-span-2 flex justify-end gap-3 mt-4">
              {isEditingPaciente && (
                <button type="button" onClick={() => handleAcaoPaciente(false)} disabled={loading} className="bg-slate-200 px-6 py-2 rounded-xl hover:bg-slate-300 transition-colors">Apenas Salvar</button>
              )}
              <button type="button" onClick={() => handleAcaoPaciente(true)} disabled={loading} className="bg-sky-600 text-white px-6 py-2 rounded-xl hover:bg-sky-700 transition-colors">
                {isEditingPaciente ? 'Atualizar e Avançar' : 'Salvar e Avançar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ETAPA 2: SOLICITAÇÃO */}
      {etapa === 2 && pacienteAtivo && (
        <div className="bg-white border border-emerald-200 rounded-2xl p-6 shadow-md border-t-4 border-t-emerald-500 animate-[fadeIn_0.3s_ease-in-out]">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 border-b pb-4">
            Etapa 2: Nova Solicitação para <span className="text-emerald-600">{pacienteAtivo.nome}</span>
          </h3>
          <form onSubmit={handleSalvarSolicitacao} className="grid grid-cols-1 md:grid-cols-4 gap-5">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-500 mb-1">Origem da Solicitação</label>
              <select required onInvalid={(e) => e.target.setCustomValidity('Por favor, clique aqui e selecione de onde vem essa solicitação.')} onInput={(e) => { e.target.setCustomValidity(''); setFormDataSolicitacao({ ...formDataSolicitacao, origem: e.target.value }); }} value={formDataSolicitacao.origem} className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500/50" disabled={loading}>
                <option value="">Selecione...</option>
                <option value="Ambulatório de Especialidades">Ambulatório de Especialidades</option>
                <option value="Ambulatório de Oncologia">Ambulatório de Oncologia</option>
                <option value="PAM Boa Vista">PAM Boa Vista</option>
              </select>
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-slate-500 mb-1">Data da Solicitação</label>
              <input type="date" required onInvalid={(e) => e.target.setCustomValidity('Informe a data exata em que o pedido foi feito pelo médico.')} onInput={(e) => { e.target.setCustomValidity(''); setFormDataSolicitacao({ ...formDataSolicitacao, dataSolicitacao: e.target.value }); }} value={formDataSolicitacao.dataSolicitacao} className="w-full border px-3 py-2 rounded-lg focus:ring-2 focus:ring-emerald-500/50" disabled={loading} />
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-slate-500 mb-1">Prioridade Urgente?</label>
              <select required onInvalid={(e) => e.target.setCustomValidity('Selecione uma prioridade válida.')} onInput={(e) => { e.target.setCustomValidity(''); setFormDataSolicitacao({ ...formDataSolicitacao, prioridade: e.target.value }); }} value={formDataSolicitacao.prioridade} className="w-full border px-3 py-2 rounded-lg focus:ring-2 focus:ring-emerald-500/50" disabled={loading}>
                <option value="NÃO">Não</option><option value="SIM">Sim</option><option value="Oncologia">Oncologia</option><option value="Carta de Prioridade">Carta de Prioridade</option>
              </select>
            </div>
            {!isPamBoaVista && (
              <>
                <div className="md:col-span-1">
                  <label className="block text-sm font-medium text-slate-500 mb-1">Prontuário MV PEP</label>
                  <input type="text" required onInvalid={(e) => e.target.setCustomValidity('Digite o número do prontuário do paciente no MV PEP.')} onInput={(e) => { e.target.setCustomValidity(''); setFormDataSolicitacao({ ...formDataSolicitacao, prontuario: e.target.value }); }} value={formDataSolicitacao.prontuario} className="w-full border px-3 py-2 rounded-lg" disabled={loading} />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-sm font-medium text-slate-500 mb-1">Nº Consulta Ambulatorial</label>
                  <input type="text" required onInvalid={(e) => e.target.setCustomValidity('Informe o número da respectiva consulta no Ambulatório.')} onInput={(e) => { e.target.setCustomValidity(''); setFormDataSolicitacao({ ...formDataSolicitacao, consulta: e.target.value }); }} value={formDataSolicitacao.consulta} className="w-full border px-3 py-2 rounded-lg" disabled={loading} />
                </div>
              </>
            )}
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-slate-500 mb-1">CID 10</label>
              <input type="text" required onInvalid={(e) => e.target.setCustomValidity('Informe o código CID principal do diagnóstico.')} onInput={(e) => { e.target.setCustomValidity(''); setFormDataSolicitacao({ ...formDataSolicitacao, cid: e.target.value.toUpperCase() }); }} value={formDataSolicitacao.cid} className="w-full border px-3 py-2 rounded-lg uppercase" placeholder="M17" disabled={loading} />
            </div>
            <div className="md:col-span-3 relative">
              <label className="block text-sm font-medium text-slate-500 mb-1">Procedimento (SIGTAP)</label>
              <input type="text" required onInvalid={(e) => e.target.setCustomValidity('Você precisa pesquisar e selecionar um procedimento da lista para continuar.')} onInput={(e) => { e.target.setCustomValidity(''); handleBuscaProcChange(e); }} placeholder="Buscar código ou nome..." value={buscaProc} onFocus={() => setMostrarDropdownProc(true)} onBlur={() => setTimeout(() => setMostrarDropdownProc(false), 200)} className="w-full border px-3 py-2 rounded-lg uppercase focus:ring-2 focus:ring-emerald-500/50" disabled={loading} />
              {mostrarDropdownProc && buscaProc && (
                <ul className="absolute z-20 w-full bg-white border shadow-xl rounded-lg mt-1 max-h-60 overflow-y-auto custom-scrollbar">
                  {procedimentosFiltrados.map((p) => (
                    <li key={p.id} onMouseDown={(e) => { e.preventDefault(); selecionarProcedimento(p); }} className="px-4 py-2 hover:bg-emerald-50 cursor-pointer text-sm border-b last:border-0">
                      <span className="font-bold text-emerald-600 mr-2 font-mono">{p.codigo}</span>{p.descricao}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-500 mb-1">Especialidade Médica</label>
              <select required onInvalid={(e) => e.target.setCustomValidity('Selecione uma especialidade referenciada para o procedimento.')} onInput={(e) => { e.target.setCustomValidity(''); setFormDataSolicitacao({ ...formDataSolicitacao, especialidade: e.target.value, medico: '' }); }} value={formDataSolicitacao.especialidade} disabled={especialidadesDisponiveis.length === 0 || loading} className="w-full border px-3 py-2 rounded-lg disabled:bg-slate-50">
                <option value="">SELECIONE...</option>
                {especialidadesDisponiveis.map((esp) => (<option key={esp} value={esp}>{esp}</option>))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-500 mb-1">Médico Solicitante</label>
              <select required onInvalid={(e) => e.target.setCustomValidity('Selecione o médico responsável na lista.')} onInput={(e) => { e.target.setCustomValidity(''); setFormDataSolicitacao({ ...formDataSolicitacao, medico: e.target.value }); }} value={formDataSolicitacao.medico} disabled={medicosDisponiveis.length === 0 || loading} className="w-full border px-3 py-2 rounded-lg disabled:bg-slate-50">
                <option value="">SELECIONE...</option>
                {medicosDisponiveis.map((m) => (<option key={m.id} value={m.nome}>{m.nome}</option>))}
              </select>
            </div>
            <div className="md:col-span-4 bg-slate-50 border border-slate-200 rounded-xl p-4 mt-2">
              <label className="block text-sm font-bold text-slate-600 mb-1">Número do SISREG (Opcional)</label>
              <p className="text-[10px] text-slate-400 mb-2 leading-tight">Se preenchido, o paciente cairá direto em Validação. Do contrário, ficará retido aguardando o número.</p>
              <input type="text" value={formDataSolicitacao.numeroSisreg} onChange={(e) => setFormDataSolicitacao({ ...formDataSolicitacao, numeroSisreg: e.target.value.replace(/\D/g, '') })} className="w-full md:w-1/3 border px-3 py-2 rounded-lg font-mono placeholder:text-slate-300 focus:ring-2 focus:ring-slate-400" placeholder="Apenas números..." disabled={loading} />
            </div>
            <div className="md:col-span-4 flex justify-end mt-4">
              <button type="submit" disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-2.5 rounded-xl font-bold transition-shadow shadow-md disabled:opacity-50">
                Salvar Solicitação
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TABELA DE PACIENTES */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden mt-4">
        <div className="px-6 py-4 border-b bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h3 className="text-base font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-sky-500"></span> Últimos Pacientes Cadastrados
          </h3>
          <div className="relative w-full md:w-96 flex gap-2">
            <input
              type="text"
              placeholder="Filtro (Nome/CNS) ou Buscar Remoto (CNS 15 dig)..."
              value={filtroTabela}
              onChange={(e) => {
                setFiltroTabela(e.target.value);
                setPaginaAtual(1);
              }}
              className="w-full border border-slate-300 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-sky-500/50 outline-none"
              disabled={loading}
            />
            <button
              onClick={buscarPacienteTabelaCNS}
              disabled={loading || filtroTabela.length !== 15 || isNaN(Number(filtroTabela))}
              className="bg-sky-100 hover:bg-sky-200 text-sky-700 rounded-xl px-3 py-2 transition-colors disabled:opacity-50 border border-sky-300"
              title="Buscar Remotamente (Exige CNS com 15 dígitos)"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 whitespace-nowrap">
            <thead className="bg-slate-50 text-sm text-slate-500 font-medium border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-center">Ações</th><th className="px-6 py-3">CNS / Nome Completo</th><th className="px-6 py-3">Cidade</th><th className="px-6 py-3 text-center">AIHs Ativas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pacientesPaginados.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-3 flex items-center justify-center gap-3">
                    <button onClick={() => handleEditarPaciente(p)} disabled={loading} className="p-1.5 text-amber-500 hover:bg-amber-100 rounded-lg transition-colors disabled:opacity-50" title="Editar Cadastro">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button onClick={() => handleNovaSolicitacaoDireta(p)} disabled={loading} className="p-1.5 text-sky-500 hover:bg-sky-100 rounded-lg transition-colors disabled:opacity-50" title="Nova Solicitação">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    </button>
                    <button onClick={() => handleClickDeletar(p)} disabled={loading} className="p-1.5 text-red-400 hover:bg-red-100 hover:text-red-600 rounded-lg transition-colors disabled:opacity-50" title="Excluir Definitivamente">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </td>
                  <td className="px-6 py-3">
                    <div className="font-bold text-slate-700 uppercase leading-tight">{p.nome}</div>
                    <div className="text-[10px] font-mono text-slate-400 mt-0.5">CNS: {p.cns}</div>
                  </td>
                  <td className="px-6 py-3 text-sm uppercase">{p.cidade}</td>
                  <td className="px-6 py-3 text-center">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${contagemSolicitacoes[p.id] > 0 ? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                      {contagemSolicitacoes[p.id] || 0}
                    </span>
                  </td>
                </tr>
              ))}
              {pacientesPaginados.length === 0 && (
                <tr>
                  <td colSpan="4" className="px-6 py-12 text-center text-slate-400 italic">
                    Nenhum paciente encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {totalPaginas > 1 && (
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <span className="text-sm text-slate-500 font-medium">
              Página {paginaAtual} de {totalPaginas} — Total: {pacientesFiltradosSorted.length} registros
            </span>
            <div className="flex gap-2">
              <button disabled={paginaAtual === 1 || loading} onClick={() => { setPaginaAtual((p) => p - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="px-4 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-30 transition-all">Anterior</button>
              <button disabled={paginaAtual === totalPaginas || loading} onClick={() => { setPaginaAtual((p) => p + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="px-4 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-30 transition-all">Próxima</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}