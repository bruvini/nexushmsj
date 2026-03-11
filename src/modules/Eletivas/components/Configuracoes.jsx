import { useState, useEffect } from 'react'
import { collection, query, getDocs, addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp, orderBy, writeBatch } from 'firebase/firestore'
import { db } from '../../../services/firebase'
import Papa from 'papaparse'

// IMPORTAÇÕES DO TOASTIFY
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function Configuracoes() {
  const [subAba, setSubAba] = useState('especialidades')
  const [loading, setLoading] = useState(false)
  const [importStatus, setImportStatus] = useState('')

  // Estados das listas (Dados do Banco)
  const [especialidades, setEspecialidades] = useState([])
  const [medicos, setMedicos] = useState([])
  const [procedimentos, setProcedimentos] = useState([])

  // Estados de Busca (Search)
  const [buscaEspecialidade, setBuscaEspecialidade] = useState('')
  const [buscaMedico, setBuscaMedico] = useState('')
  const [buscaProcedimento, setBuscaProcedimento] = useState('')

  // Estados dos formulários (com 'id' para Edição)
  const [formEspecialidade, setFormEspecialidade] = useState({ id: null, nome: '' })
  const [formMedico, setFormMedico] = useState({ id: null, nome: '', especialidades: [] })
  const [formProcedimento, setFormProcedimento] = useState({ id: null, codigo: '', descricao: '', especialidades: [] })

  // ESTADOS DOS MODAIS DE DELEÇÃO E RESOLUTION
  const [deleteModalEspecialidade, setDeleteModalEspecialidade] = useState(null);
  const [deleteModalMedico, setDeleteModalMedico] = useState(null);
  const [deleteModalProcedimento, setDeleteModalProcedimento] = useState(null);

  // Estados de Entity Resolution (Limpeza)
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [operacoesLimpeza, setOperacoesLimpeza] = useState(null);
  const [modalLimpeza, setModalLimpeza] = useState(false);

  // Buscar dados em tempo real
  useEffect(() => {
    const unsubEspec = onSnapshot(query(collection(db, 'nexus_eletivas_especialidades'), orderBy('nome')), (snap) => {
      setEspecialidades(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))
    })
    const unsubMedicos = onSnapshot(query(collection(db, 'nexus_eletivas_medicos'), orderBy('nome')), (snap) => {
      setMedicos(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))
    })
    const unsubProc = onSnapshot(query(collection(db, 'nexus_eletivas_procedimentos'), orderBy('descricao')), (snap) => {
      setProcedimentos(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))
    })

    return () => { unsubEspec(); unsubMedicos(); unsubProc(); }
  }, [])

  // =========================================================================
  // CRUD: ESPECIALIDADES
  // =========================================================================
  const salvarEspecialidade = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (formEspecialidade.id) {
        await updateDoc(doc(db, 'nexus_eletivas_especialidades', formEspecialidade.id), { nome: formEspecialidade.nome.toUpperCase() })
        toast.success("Especialidade atualizada com sucesso!");
      } else {
        await addDoc(collection(db, 'nexus_eletivas_especialidades'), { nome: formEspecialidade.nome.toUpperCase(), criadoEm: serverTimestamp() })
        toast.success("Especialidade adicionada com sucesso!");
      }
      setFormEspecialidade({ id: null, nome: '' })
    } catch (error) { console.error(error); toast.error("Erro ao salvar especialidade.") }
    finally { setLoading(false) }
  }

  const confirmarDeletarEspecialidade = async () => {
    if (!deleteModalEspecialidade) return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'nexus_eletivas_especialidades', deleteModalEspecialidade.id));
      toast.success("Especialidade excluída.");
    } catch (error) { console.error(error); toast.error("Erro ao excluir especialidade.") }
    finally {
      setDeleteModalEspecialidade(null);
      setLoading(false);
    }
  }

  // =========================================================================
  // CRUD: MÉDICOS
  // =========================================================================
  const salvarMedico = async (e) => {
    e.preventDefault()
    if (formMedico.especialidades.length === 0) return toast.warning("Selecione ao menos uma especialidade.")
    setLoading(true)
    try {
      if (formMedico.id) {
        await updateDoc(doc(db, 'nexus_eletivas_medicos', formMedico.id), { nome: formMedico.nome.toUpperCase(), especialidades: formMedico.especialidades })
        toast.success("Médico atualizado com sucesso!");
      } else {
        await addDoc(collection(db, 'nexus_eletivas_medicos'), { nome: formMedico.nome.toUpperCase(), especialidades: formMedico.especialidades, criadoEm: serverTimestamp() })
        toast.success("Médico cadastrado com sucesso!");
      }
      setFormMedico({ id: null, nome: '', especialidades: [] })
    } catch (error) { console.error(error); toast.error("Erro ao salvar médico.") }
    finally { setLoading(false) }
  }

  const confirmarDeletarMedico = async () => {
    if (!deleteModalMedico) return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'nexus_eletivas_medicos', deleteModalMedico.id));
      toast.success("Médico excluído.");
    } catch (error) { console.error(error); toast.error("Erro ao excluir médico.") }
    finally {
      setDeleteModalMedico(null);
      setLoading(false);
    }
  }

  // =========================================================================
  // CRUD: PROCEDIMENTOS
  // =========================================================================
  const salvarProcedimento = async (e) => {
    e.preventDefault()
    if (formProcedimento.especialidades.length === 0) return toast.warning("Selecione ao menos uma especialidade.")
    setLoading(true)
    try {
      if (formProcedimento.id) {
        await updateDoc(doc(db, 'nexus_eletivas_procedimentos', formProcedimento.id), {
          codigo: formProcedimento.codigo, descricao: formProcedimento.descricao.toUpperCase(), especialidades: formProcedimento.especialidades
        })
        toast.success("Procedimento atualizado com sucesso!");
      } else {
        await addDoc(collection(db, 'nexus_eletivas_procedimentos'), {
          codigo: formProcedimento.codigo, descricao: formProcedimento.descricao.toUpperCase(), especialidades: formProcedimento.especialidades, criadoEm: serverTimestamp()
        })
        toast.success("Procedimento cadastrado com sucesso!");
      }
      setFormProcedimento({ id: null, codigo: '', descricao: '', especialidades: [] })
    } catch (error) { console.error(error); toast.error("Erro ao salvar procedimento.") }
    finally { setLoading(false) }
  }

  const confirmarDeletarProcedimento = async () => {
    if (!deleteModalProcedimento) return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'nexus_eletivas_procedimentos', deleteModalProcedimento.id));
      toast.success("Procedimento excluído.");
    } catch (error) { console.error(error); toast.error("Erro ao excluir procedimento.") }
    finally {
      setDeleteModalProcedimento(null);
      setLoading(false);
    }
  }

  const handleCheckEspecialidade = (estadoAtual, setEstado, especialidadeNome) => {
    const arr = estadoAtual.especialidades
    if (arr.includes(especialidadeNome)) {
      setEstado({ ...estadoAtual, especialidades: arr.filter(e => e !== especialidadeNome) })
    } else {
      setEstado({ ...estadoAtual, especialidades: [...arr, especialidadeNome] })
    }
  }

  // =========================================================================
  // FUNÇÕES DE IMPORTAÇÃO EM LOTE 
  // =========================================================================
  const processarEmLotes = async (dataArray, collectionName, processRow) => {
    const CHUNK_SIZE = 400; let totalImportados = 0;
    for (let i = 0; i < dataArray.length; i += CHUNK_SIZE) {
      const chunk = dataArray.slice(i, i + CHUNK_SIZE); const batch = writeBatch(db);
      chunk.forEach(row => {
        const docRef = doc(collection(db, collectionName)); const dataToSave = processRow(row);
        if (dataToSave) { batch.set(docRef, { ...dataToSave, criadoEm: serverTimestamp() }); totalImportados++; }
      });
      await batch.commit();
    }
    return totalImportados;
  }

  const handleImportEspecialidades = (e) => {
    const file = e.target.files[0]; if (!file) return;
    setLoading(true); setImportStatus('Lendo CSV de Especialidades...');
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: async (results) => {
        try {
          setImportStatus('Salvando no banco de dados...');
          const total = await processarEmLotes(results.data, 'nexus_eletivas_especialidades', (row) => {
            if (row.NOME_ESPECIALIDADE) return { nome: row.NOME_ESPECIALIDADE.trim().toUpperCase() }; return null;
          });
          toast.success(`Sucesso! ${total} especialidades importadas.`);
        } catch (err) { toast.error('Erro na importação: ' + err.message); }
        finally { setLoading(false); setImportStatus(''); e.target.value = null; }
      }
    });
  }

  const handleImportMedicos = (e) => {
    const file = e.target.files[0]; if (!file) return;
    setLoading(true); setImportStatus('Lendo CSV de Médicos...');
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: async (results) => {
        try {
          setImportStatus('Salvando no banco de dados...');
          const total = await processarEmLotes(results.data, 'nexus_eletivas_medicos', (row) => {
            if (row.NOME_MEDICO && row.ESPECIALIDADES_VINCULADAS) {
              const espArray = row.ESPECIALIDADES_VINCULADAS.split(',').map(esp => esp.trim().toUpperCase());
              return { nome: row.NOME_MEDICO.trim().toUpperCase(), especialidades: espArray };
            } return null;
          });
          toast.success(`Sucesso! ${total} médicos importados.`);
        } catch (err) { toast.error('Erro na importação: ' + err.message); }
        finally { setLoading(false); setImportStatus(''); e.target.value = null; }
      }
    });
  }

  const handleImportProcedimentos = (e) => {
    const file = e.target.files[0]; if (!file) return;
    setLoading(true); setImportStatus('Lendo CSV de Procedimentos...');
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: async (results) => {
        try {
          setImportStatus('Salvando no banco de dados...');
          const total = await processarEmLotes(results.data, 'nexus_eletivas_procedimentos', (row) => {
            if (row.CODIGO_SIGTAP && row.NOME_PROCEDIMENTO && row.ESPECIALIDADES_VINCULADAS) {
              const espArray = row.ESPECIALIDADES_VINCULADAS.split(',').map(esp => esp.trim().toUpperCase());
              return { codigo: String(row.CODIGO_SIGTAP).trim(), descricao: row.NOME_PROCEDIMENTO.trim().toUpperCase(), especialidades: espArray };
            } return null;
          });
          toast.success(`Sucesso! ${total} procedimentos importados.`);
        } catch (err) { toast.error('Erro na importação: ' + err.message); }
        finally { setLoading(false); setImportStatus(''); e.target.value = null; }
      }
    });
  }

  // =========================================================================
  // ENTITY RESOLUTION: MOTOR DE DEDUPLICAÇÃO (DRY RUN OTIMIZADO)
  // =========================================================================
  const analisarDuplicatas = async () => {
    setIsScanning(true);
    setScanResult(null);
    setOperacoesLimpeza(null);

    const normalizarString = (str) => {
      if (!str) return '';
      return String(str).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
    };

    try {
      // 1. CARGA IN-MEMORY GLOBAL
      const pacientesSnap = await getDocs(query(collection(db, 'nexus_eletivas_pacientes')));
      const aihsSnap = await getDocs(query(collection(db, 'nexus_eletivas_solicitacoes')));

      const pacientes = pacientesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const aihs = aihsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Mapa auxiliar para contagem de AIHs por paciente
      const aihsPorPacienteCount = {};
      aihs.forEach(aih => {
        if (aih.pacienteId) {
          aihsPorPacienteCount[aih.pacienteId] = (aihsPorPacienteCount[aih.pacienteId] || 0) + 1;
        }
      });

      // -------------------------------------------------------------
      // 2. AGRUPAMENTO E DEDUPLICAÇÃO DE PACIENTES
      // -------------------------------------------------------------
      const pacientesAgrupados = new Map(); // Chave -> Array de Pacientes

      pacientes.forEach(p => {
        const cns = String(p.cns || '').trim();
        const nome = normalizarString(p.nome);
        const nasc = String(p.dataNascimento || '').trim();

        let chave = null;
        if (nome && nasc) chave = `nomeNasc_${nome}_${nasc}`;
        else if (cns) chave = `cns_${cns}`;

        if (chave) {
          if (!pacientesAgrupados.has(chave)) pacientesAgrupados.set(chave, []);
          pacientesAgrupados.get(chave).push(p);
        }
      });

      const instrucoesUpdatePacienteId = []; // { idAih, novoPacienteId }
      const instrucoesDeletePaciente = []; // [IDs...]
      const mapaSobreviventes = new Map(); // idMorto -> idSobrevivente
      const instrucoesUpdateCnsSobrevivente = []; // { idPaciente, novoCns }

      let countPacientesUnificados = 0;

      pacientesAgrupados.forEach((grupo) => {
        if (grupo.length > 1) {
          // Desempate: 
          // 1. CNS começa com '7' (Definitivo)
          // 2. Quem tem mais AIHs atreladas
          // 3. ID mais ANTIGO (Criado primeiro) (timestamp de criadoEm ou order do id local)
          grupo.sort((a, b) => {
            const aTem7 = (a.cns || '').startsWith('7') ? 1 : 0;
            const bTem7 = (b.cns || '').startsWith('7') ? 1 : 0;
            if (aTem7 !== bTem7) return bTem7 - aTem7;

            const aCount = aihsPorPacienteCount[a.id] || 0;
            const bCount = aihsPorPacienteCount[b.id] || 0;
            if (aCount !== bCount) return bCount - aCount;

            const aCriado = a.criadoEm?.toMillis ? a.criadoEm.toMillis() : 0;
            const bCriado = b.criadoEm?.toMillis ? b.criadoEm.toMillis() : 0;
            return aCriado - bCriado; // Mais antigo (menor data) primeiro
          });

          const sobrevivente = grupo[0];
          const vitimas = grupo.slice(1);

          countPacientesUnificados += vitimas.length;

          // Mesclar CNS definitivo para o sobrevivente se ele não tiver e alguma vítima tiver
          if (!(sobrevivente.cns || '').startsWith('7')) {
            const vitimaCom7 = vitimas.find(v => (v.cns || '').startsWith('7'));
            if (vitimaCom7) {
              instrucoesUpdateCnsSobrevivente.push({ idPaciente: sobrevivente.id, novoCns: vitimaCom7.cns });
            }
          }

          vitimas.forEach(v => {
            mapaSobreviventes.set(v.id, sobrevivente.id);
            instrucoesDeletePaciente.push(v.id);
          });
        }
      });

      // -------------------------------------------------------------
      // 3. APLICAÇÃO EM MEMÓRIA DO MERGE DE PACIENTES PARA AS AIHS
      // -------------------------------------------------------------
      const aihsLimpo = aihs.map(aih => {
        if (aih.pacienteId && mapaSobreviventes.has(aih.pacienteId)) {
          const novoPid = mapaSobreviventes.get(aih.pacienteId);
          // Marca instrução de update real pro batch
          instrucoesUpdatePacienteId.push({ idAih: aih.id, novoPacienteId: novoPid });
          // Atualiza em memória pra deduplicação na etapa 4
          return { ...aih, pacienteId: novoPid };
        }
        return aih;
      });

      // -------------------------------------------------------------
      // 4. AGRUPAMENTO E DEDUPLICAÇÃO DE AIHS
      // -------------------------------------------------------------
      const aihsAgrupadas = new Map();

      aihsLimpo.forEach(aih => {
        const codSigtap = String(aih.codigoProcedimento || '').replace(/^0+/, '').trim();
        const medico = normalizarString(aih.medico);
        const dataSol = String(aih.dataSolicitacao || '').trim();
        const pId = String(aih.pacienteId || '');

        if (codSigtap && dataSol && pId) {
          const chaveAih = `${pId}_${codSigtap}_${dataSol}_${medico}`;
          if (!aihsAgrupadas.has(chaveAih)) aihsAgrupadas.set(chaveAih, []);
          aihsAgrupadas.get(chaveAih).push(aih);
        }
      });

      const instrucoesDeleteAih = [];
      let countAihsEliminadas = 0;

      aihsAgrupadas.forEach((grupo) => {
        if (grupo.length > 1) {
          // Desempate de AIH:
          // 1. Número SISREG Válido
          // 2. Registro mais RECENTE (Criado/importado por último)
          grupo.sort((a, b) => {
            const aTemSisreg = (a.numeroSisreg && a.numeroSisreg.trim() !== '') ? 1 : 0;
            const bTemSisreg = (b.numeroSisreg && b.numeroSisreg.trim() !== '') ? 1 : 0;
            if (aTemSisreg !== bTemSisreg) return bTemSisreg - aTemSisreg;

            const aCriado = a.criadoEm?.toMillis ? a.criadoEm.toMillis() : 0;
            const bCriado = b.criadoEm?.toMillis ? b.criadoEm.toMillis() : 0;
            return bCriado - aCriado; // Mais recente (maior data) primeiro
          });

          // O primeiro é o sobrevivente
          const vitimasAih = grupo.slice(1);
          countAihsEliminadas += vitimasAih.length;

          vitimasAih.forEach(v => instrucoesDeleteAih.push(v.id));
        }
      });

      // -------------------------------------------------------------
      // 5. SUMÁRIO DA RESOLUTION
      // -------------------------------------------------------------
      setScanResult({
        pacientesAnalisados: pacientes.length,
        pacientesAExcluir: countPacientesUnificados,
        aihsAnalisadas: aihs.length,
        aihsAExcluir: countAihsEliminadas,
        aihsAtualizadas: instrucoesUpdatePacienteId.length,
      });

      setOperacoesLimpeza({
        instrucoesUpdatePacienteId,
        instrucoesUpdateCnsSobrevivente,
        instrucoesDeleteAih,
        instrucoesDeletePaciente
      });

      setModalLimpeza(true);

    } catch (error) {
      console.error(error);
      toast.error('Ocorreu um erro durante a varredura da base de dados.');
    } finally {
      setIsScanning(false);
    }
  };

  const confirmarLimpezaBatch = async () => {
    if (!operacoesLimpeza) return;
    setLoading(true);
    setModalLimpeza(false);

    try {
      const {
        instrucoesUpdatePacienteId,
        instrucoesUpdateCnsSobrevivente,
        instrucoesDeleteAih,
        instrucoesDeletePaciente
      } = operacoesLimpeza;

      let batch = writeBatch(db);
      let operationsCount = 0;

      const safelyCommitBatch = async () => {
        if (operationsCount >= 450) {
          await batch.commit();
          batch = writeBatch(db);
          operationsCount = 0;
        }
      };

      // PASSO 1: Updates (AIHs orfãs para novo paciente e merges de CNS)
      for (const update of instrucoesUpdatePacienteId) {
        // Evita deletar e fazer update do mesmo doc
        if (!instrucoesDeleteAih.includes(update.idAih)) {
          batch.update(doc(db, 'nexus_eletivas_solicitacoes', update.idAih), { pacienteId: update.novoPacienteId });
          operationsCount++;
          await safelyCommitBatch();
        }
      }

      for (const update of instrucoesUpdateCnsSobrevivente) {
        batch.update(doc(db, 'nexus_eletivas_pacientes', update.idPaciente), { cns: update.novoCns });
        operationsCount++;
        await safelyCommitBatch();
      }

      // PASSO 2: Deletes AIHs duplicadas
      for (const idAih of instrucoesDeleteAih) {
        batch.delete(doc(db, 'nexus_eletivas_solicitacoes', idAih));
        operationsCount++;
        await safelyCommitBatch();
      }

      // PASSO 3: Deletes Pacientes Duplicados
      for (const idPac of instrucoesDeletePaciente) {
        batch.delete(doc(db, 'nexus_eletivas_pacientes', idPac));
        operationsCount++;
        await safelyCommitBatch();
      }

      if (operationsCount > 0) {
        await batch.commit();
      }

      toast.success('Base de dados higienizada com sucesso!');
      setScanResult(null);
      setOperacoesLimpeza(null);

    } catch (error) {
      console.error(error);
      toast.error('Falha crítica ao executar a limpeza no banco!');
    } finally {
      setLoading(false);
    }
  }

  // =========================================================================
  // LISTAS FILTRADAS PELA BUSCA
  // =========================================================================
  const especialidadesFiltradas = especialidades.filter(e => e.nome.includes(buscaEspecialidade.toUpperCase()))
  const medicosFiltrados = medicos.filter(m => m.nome.includes(buscaMedico.toUpperCase()))
  const procedimentosFiltrados = procedimentos.filter(p =>
    p.descricao.includes(buscaProcedimento.toUpperCase()) || p.codigo.includes(buscaProcedimento)
  )

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col md:flex-row gap-6 pb-12 relative text-nexus-text">
      <ToastContainer position="top-right" theme="colored" />

      {/* OVERLAY DE CARREGAMENTO GLOBAL */}
      {loading && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-nexus-bg/70 backdrop-blur-sm transition-opacity">
          <div className="bg-nexus-card p-8 rounded-2xl shadow-2xl flex flex-col items-center max-w-sm w-full mx-4 animate-[fadeIn_0.2s_ease-in-out]">
            <div className="w-14 h-14 border-4 border-nexus-border border-t-nexus-primary rounded-full animate-spin mb-4"></div>
            <h3 className="text-lg font-bold text-nexus-text mb-1">Processando...</h3>
            <p className="text-sm text-nexus-text/70 text-center">
              {importStatus || 'Aguarde um instante.'}
            </p>
          </div>
        </div>
      )}

      {/* MODAL: EXCLUIR ESPECIALIDADE */}
      {deleteModalEspecialidade && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-nexus-bg/70 backdrop-blur-sm transition-opacity">
          <div className="bg-nexus-card border border-nexus-border rounded-2xl shadow-2xl max-w-md w-full p-6 mx-4 animate-[fadeIn_0.2s_ease-in-out]">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <h3 className="text-xl font-bold text-nexus-text mb-2">Excluir Especialidade?</h3>
              <p className="text-nexus-text/80 text-sm mb-6">
                Tem certeza que deseja excluir <strong>{deleteModalEspecialidade.nome}</strong>?
              </p>
              <div className="flex w-full gap-3">
                <button onClick={() => setDeleteModalEspecialidade(null)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-nexus-text font-medium py-2.5 rounded-xl transition-colors">Cancelar</button>
                <button onClick={confirmarDeletarEspecialidade} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 rounded-xl transition-shadow shadow-md">Excluir</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EXCLUIR MÉDICO */}
      {deleteModalMedico && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-nexus-bg/70 backdrop-blur-sm transition-opacity">
          <div className="bg-nexus-card border border-nexus-border rounded-2xl shadow-2xl max-w-md w-full p-6 mx-4 animate-[fadeIn_0.2s_ease-in-out]">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <h3 className="text-xl font-bold text-nexus-text mb-2">Excluir Médico?</h3>
              <p className="text-nexus-text/80 text-sm mb-6">
                Tem certeza que deseja excluir o cadastro de <strong>{deleteModalMedico.nome}</strong>?
              </p>
              <div className="flex w-full gap-3">
                <button onClick={() => setDeleteModalMedico(null)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-nexus-text font-medium py-2.5 rounded-xl transition-colors">Cancelar</button>
                <button onClick={confirmarDeletarMedico} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 rounded-xl transition-shadow shadow-md">Excluir</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EXCLUIR PROCEDIMENTO */}
      {deleteModalProcedimento && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-nexus-bg/70 backdrop-blur-sm transition-opacity">
          <div className="bg-nexus-card border border-nexus-border rounded-2xl shadow-2xl max-w-md w-full p-6 mx-4 animate-[fadeIn_0.2s_ease-in-out]">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <h3 className="text-xl font-bold text-nexus-text mb-2">Excluir Procedimento?</h3>
              <p className="text-nexus-text/80 text-sm mb-6">
                Tem certeza que deseja excluir o procedimento <strong>{deleteModalProcedimento.codigo} - {deleteModalProcedimento.descricao}</strong>?
              </p>
              <div className="flex w-full gap-3">
                <button onClick={() => setDeleteModalProcedimento(null)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-nexus-text font-medium py-2.5 rounded-xl transition-colors">Cancelar</button>
                <button onClick={confirmarDeletarProcedimento} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 rounded-xl transition-shadow shadow-md">Excluir</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ENTITY RESOLUTION CONFIRMAÇÃO */}
      {modalLimpeza && scanResult && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-nexus-bg/80 backdrop-blur-sm transition-opacity">
          <div className="bg-white border-2 border-amber-400 rounded-2xl shadow-2xl max-w-lg w-full p-8 mx-4 animate-[fadeIn_0.3s_ease-in-out]">
            <div className="flex flex-col text-center items-center">
              <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-4">
                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <h3 className="text-2xl font-black text-slate-800 mb-2">Atenção Crítica!</h3>
              <p className="text-slate-600 font-medium mb-6">
                A varredura in-memory detectou anomalias na base de dados (Produção). Leia o resumo da operação irreversível a seguir:
              </p>

              <div className="bg-slate-50 border border-slate-200 w-full rounded-xl p-4 text-left mb-8 flex flex-col gap-2 shadow-inner">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600 font-medium">Pacientes Analisados</span>
                  <span className="font-bold text-slate-800">{scanResult.pacientesAnalisados}</span>
                </div>
                <div className="flex justify-between items-center text-sm border-b border-rose-100 pb-2">
                  <span className="text-rose-600 font-semibold">Duplicatas Eliminadas (Pacientes)</span>
                  <span className="font-bold text-rose-600">-{scanResult.pacientesAExcluir}</span>
                </div>

                <div className="flex justify-between items-center text-sm mt-2">
                  <span className="text-slate-600 font-medium">Solicitações (AIHs) Analisadas</span>
                  <span className="font-bold text-slate-800">{scanResult.aihsAnalisadas}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-amber-600 font-semibold">Históricos Transferidos (AIHs)</span>
                  <span className="font-bold text-amber-600">~{scanResult.aihsAtualizadas}</span>
                </div>
                <div className="flex justify-between items-center text-sm pt-1">
                  <span className="text-rose-600 font-semibold">Sinais Espelhados (AIHs Excluídas)</span>
                  <span className="font-bold text-rose-600">-{scanResult.aihsAExcluir}</span>
                </div>
              </div>

              <div className="flex flex-col w-full gap-3">
                <button onClick={confirmarLimpezaBatch} className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-xl transition-all uppercase tracking-wide">
                  Confirmar e Limpar Banco de Dados
                </button>
                <button onClick={() => setModalLimpeza(false)} className="w-full bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium py-3 rounded-xl transition-colors">
                  Cancelar Operação
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Menu Lateral de Configurações */}
      <div className="w-full md:w-64 shrink-0 flex flex-col gap-2">
        <button onClick={() => setSubAba('especialidades')} className={`p-4 rounded-xl text-left font-medium transition-all ${subAba === 'especialidades' ? 'bg-sky-600 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}`}>
          Especialidades Médicas
        </button>
        <button onClick={() => setSubAba('medicos')} className={`p-4 rounded-xl text-left font-medium transition-all ${subAba === 'medicos' ? 'bg-sky-600 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}`}>
          Corpo Clínico (Médicos)
        </button>
        <button onClick={() => setSubAba('procedimentos')} className={`p-4 rounded-xl text-left font-medium transition-all ${subAba === 'procedimentos' ? 'bg-sky-600 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}`}>
          Procedimentos SIGTAP
        </button>
        <div className="mt-4 pt-4 border-t border-slate-200">
          <button onClick={() => setSubAba('importacao')} className={`w-full p-4 rounded-xl text-left font-bold transition-all flex items-center justify-between ${subAba === 'importacao' ? 'bg-indigo-600 text-white shadow-md' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'}`}>
            Importar Lotes (CSV)
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
          </button>
        </div>
        <div className="mt-1">
          <button onClick={() => setSubAba('limpeza')} className={`w-full p-4 rounded-xl text-left font-bold transition-all flex items-center justify-between ${subAba === 'limpeza' ? 'bg-rose-600 text-white shadow-md' : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'}`}>
            Limpeza de Duplicatas
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        </div>
      </div>

      {/* Área de Conteúdo das Configurações */}
      <div className="flex-1 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm min-h-[500px]">

        {/* ABA: IMPORTAÇÃO */}
        {subAba === 'importacao' && (
          <div className="animate-[fadeIn_0.3s_ease-in-out]">
            <div className="mb-8">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <span className="bg-indigo-100 text-indigo-600 p-2 rounded-lg">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                </span>
                Importação em Massa
              </h2>
              <p className="text-slate-500 text-sm mt-2">Selecione os arquivos CSV corretos para popular o banco de dados do Nexus rapidamente.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border border-slate-200 rounded-xl p-5 hover:border-sky-300 transition-colors">
                <h3 className="font-bold text-slate-700 mb-1">1. Especialidades</h3>
                <p className="text-xs text-slate-500 mb-4">Requer coluna: NOME_ESPECIALIDADE</p>
                <input type="file" accept=".csv" disabled={loading} onChange={handleImportEspecialidades} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100 disabled:opacity-50 cursor-pointer" />
              </div>
              <div className="border border-slate-200 rounded-xl p-5 hover:border-sky-300 transition-colors">
                <h3 className="font-bold text-slate-700 mb-1">2. Corpo Clínico (Médicos)</h3>
                <p className="text-xs text-slate-500 mb-4">Requer colunas: NOME_MEDICO e ESPECIALIDADES_VINCULADAS</p>
                <input type="file" accept=".csv" disabled={loading} onChange={handleImportMedicos} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100 disabled:opacity-50 cursor-pointer" />
              </div>
              <div className="md:col-span-2 border border-slate-200 rounded-xl p-5 hover:border-sky-300 transition-colors">
                <h3 className="font-bold text-slate-700 mb-1">3. Procedimentos SIGTAP</h3>
                <p className="text-xs text-slate-500 mb-4">Requer colunas: CODIGO_SIGTAP, NOME_PROCEDIMENTO e ESPECIALIDADES_VINCULADAS</p>
                <input type="file" accept=".csv" disabled={loading} onChange={handleImportProcedimentos} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 disabled:opacity-50 cursor-pointer" />
              </div>
            </div>
          </div>
        )}

        {/* ABA: DEDUPLICAÇÃO E LIMPEZA (ENTITY RESOLUTION) */}
        {subAba === 'limpeza' && (
          <div className="animate-[fadeIn_0.3s_ease-in-out]">
            <div className="mb-6 flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <span className="bg-rose-100 text-rose-600 p-2 rounded-lg">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </span>
                  Deduplicação e Unificação Segura (Limpeza de Duplicatas)
                </h2>
                <p className="text-slate-500 text-sm mt-2 max-w-2xl">
                  Esta ferramenta cruza todos os prontuários e AIHs cadastradas procurando por duplas entradas. Diferente do Smart Upsert de importação, ela varre o banco local do zero.
                </p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-2xl p-6 sm:p-10 text-center">
              <svg className="w-16 h-16 text-rose-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Higienização em Banco de Produção</h3>
              <p className="text-slate-600 mb-8 max-w-lg mx-auto">
                Ao iniciar, o sistema realizará uma etapa não-destrutiva de cálculo preliminar em memória. O cruzamento prioriza Pacientes criados primeiro (preservando o ID original) e AIHs mais completas (com SISREG).
              </p>
              <button
                onClick={analisarDuplicatas}
                disabled={isScanning}
                className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mx-auto"
              >
                {isScanning ? (
                  <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Calculando Matrizes...</>
                ) : (
                  <><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg> Varrer e Identificar Duplicatas</>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ABA: ESPECIALIDADES */}
        {subAba === 'especialidades' && (
          <div className="animate-[fadeIn_0.3s_ease-in-out]">
            <h2 className="text-xl font-bold text-slate-800 mb-4">{formEspecialidade.id ? 'Editar Especialidade' : 'Nova Especialidade'}</h2>
            <form onSubmit={salvarEspecialidade} className="flex gap-4 mb-6">
              <input type="text" placeholder="Nome da Especialidade (Ex: ORTOPEDIA)" required value={formEspecialidade.nome} onChange={e => setFormEspecialidade({ ...formEspecialidade, nome: e.target.value })} className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-4 py-2 uppercase focus:ring-2 focus:ring-sky-500/50" disabled={loading} />
              <button type="submit" disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-6 py-2 rounded-lg disabled:opacity-50">
                {formEspecialidade.id ? 'Atualizar' : 'Adicionar'}
              </button>
              {formEspecialidade.id && (
                <button type="button" disabled={loading} onClick={() => setFormEspecialidade({ id: null, nome: '' })} className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium px-4 py-2 rounded-lg">Cancelar</button>
              )}
            </form>

            <div className="flex items-center justify-between mb-3 mt-8">
              <h3 className="text-sm font-bold text-slate-500 uppercase">Especialidades Cadastradas ({especialidadesFiltradas.length})</h3>
              <input type="text" placeholder="Buscar especialidade..." value={buscaEspecialidade} onChange={(e) => setBuscaEspecialidade(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-sky-500/50 w-64" disabled={loading} />
            </div>

            <div className="flex flex-col gap-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {especialidadesFiltradas.map(esp => (
                <div key={esp.id} className="bg-slate-50 border border-slate-200 p-3 rounded-lg flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">{esp.nome}</span>
                  <div className="flex gap-2">
                    <button onClick={() => { setFormEspecialidade(esp); window.scrollTo(0, 0) }} disabled={loading} className="text-amber-500 hover:bg-amber-50 p-1.5 rounded transition-colors disabled:opacity-50" title="Editar"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                    <button onClick={() => setDeleteModalEspecialidade(esp)} disabled={loading} className="text-red-500 hover:bg-red-50 p-1.5 rounded transition-colors disabled:opacity-50" title="Excluir"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                  </div>
                </div>
              ))}
              {especialidadesFiltradas.length === 0 && <p className="text-sm text-slate-400 text-center py-4">Nenhuma especialidade encontrada.</p>}
            </div>
          </div>
        )}

        {/* ABA: MÉDICOS */}
        {subAba === 'medicos' && (
          <div className="animate-[fadeIn_0.3s_ease-in-out]">
            <h2 className="text-xl font-bold text-slate-800 mb-4">{formMedico.id ? 'Editar Médico' : 'Vincular Médicos às Especialidades'}</h2>
            <form onSubmit={salvarMedico} className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-6 relative">
              <div className="mb-4 flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Nome do Médico</label>
                  <input type="text" required placeholder="Dr(a). Nome" value={formMedico.nome} onChange={e => setFormMedico({ ...formMedico, nome: e.target.value })} className="w-full border border-slate-300 rounded-lg px-4 py-2 uppercase focus:ring-2 focus:ring-sky-500/50" disabled={loading} />
                </div>
              </div>
              <label className="block text-xs font-medium text-slate-500 mb-2">Especialidades Atendidas</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4 max-h-40 overflow-y-auto p-2 border border-slate-200 bg-white rounded-lg custom-scrollbar">
                {especialidades.map(esp => (
                  <label key={esp.id} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <input type="checkbox" disabled={loading} checked={formMedico.especialidades.includes(esp.nome)} onChange={() => handleCheckEspecialidade(formMedico, setFormMedico, esp.nome)} className="rounded text-sky-500 focus:ring-sky-500" />
                    {esp.nome}
                  </label>
                ))}
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={loading} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-6 py-2.5 rounded-lg disabled:opacity-50">
                  {formMedico.id ? 'Atualizar Médico' : 'Salvar Médico'}
                </button>
                {formMedico.id && (
                  <button type="button" disabled={loading} onClick={() => setFormMedico({ id: null, nome: '', especialidades: [] })} className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium px-6 py-2.5 rounded-lg">Cancelar</button>
                )}
              </div>
            </form>

            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-500 uppercase">Médicos Cadastrados ({medicosFiltrados.length})</h3>
              <input type="text" placeholder="Buscar médico..." value={buscaMedico} onChange={(e) => setBuscaMedico(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-sky-500/50 w-64" disabled={loading} />
            </div>

            <div className="flex flex-col gap-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {medicosFiltrados.map(med => (
                <div key={med.id} className="bg-white border border-slate-200 p-4 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="font-bold text-slate-700 mb-1">{med.nome}</div>
                    <div className="flex flex-wrap gap-1">
                      {med.especialidades.map(e => <span key={e} className="bg-sky-50 text-sky-700 text-[10px] font-bold px-2 py-0.5 rounded-md border border-sky-100">{e}</span>)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setFormMedico(med); window.scrollTo(0, 0) }} disabled={loading} className="text-amber-500 hover:bg-amber-50 p-2 rounded transition-colors disabled:opacity-50"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                    <button onClick={() => setDeleteModalMedico(med)} disabled={loading} className="text-red-500 hover:bg-red-50 p-2 rounded transition-colors disabled:opacity-50"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                  </div>
                </div>
              ))}
              {medicosFiltrados.length === 0 && <p className="text-sm text-slate-400 text-center py-4">Nenhum médico encontrado.</p>}
            </div>
          </div>
        )}

        {/* ABA: PROCEDIMENTOS */}
        {subAba === 'procedimentos' && (
          <div className="animate-[fadeIn_0.3s_ease-in-out]">
            <h2 className="text-xl font-bold text-slate-800 mb-4">{formProcedimento.id ? 'Editar Procedimento' : 'Vincular Procedimentos (SIGTAP) às Especialidades'}</h2>
            <form onSubmit={salvarProcedimento} className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="md:col-span-1">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Código SIGTAP</label>
                  <input type="text" required placeholder="Apenas números" maxLength="10" value={formProcedimento.codigo} onChange={e => setFormProcedimento({ ...formProcedimento, codigo: e.target.value.replace(/\D/g, '') })} className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-sky-500/50" disabled={loading} />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Descrição do Procedimento</label>
                  <input type="text" required placeholder="Ex: ARTROPLASTIA TOTAL DE JOELHO" value={formProcedimento.descricao} onChange={e => setFormProcedimento({ ...formProcedimento, descricao: e.target.value })} className="w-full border border-slate-300 rounded-lg px-4 py-2 uppercase focus:ring-2 focus:ring-sky-500/50" disabled={loading} />
                </div>
              </div>
              <label className="block text-xs font-medium text-slate-500 mb-2">Especialidades Vinculadas</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4 max-h-40 overflow-y-auto p-2 border border-slate-200 bg-white rounded-lg custom-scrollbar">
                {especialidades.map(esp => (
                  <label key={esp.id} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <input type="checkbox" disabled={loading} checked={formProcedimento.especialidades.includes(esp.nome)} onChange={() => handleCheckEspecialidade(formProcedimento, setFormProcedimento, esp.nome)} className="rounded text-sky-500 focus:ring-sky-500" />
                    {esp.nome}
                  </label>
                ))}
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={loading} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-6 py-2.5 rounded-lg disabled:opacity-50">
                  {formProcedimento.id ? 'Atualizar Procedimento' : 'Salvar Procedimento'}
                </button>
                {formProcedimento.id && (
                  <button type="button" disabled={loading} onClick={() => setFormProcedimento({ id: null, codigo: '', descricao: '', especialidades: [] })} className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium px-6 py-2.5 rounded-lg">Cancelar</button>
                )}
              </div>
            </form>

            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-500 uppercase">Procedimentos Cadastrados ({procedimentosFiltrados.length})</h3>
              <input type="text" placeholder="Buscar por código ou nome..." value={buscaProcedimento} onChange={(e) => setBuscaProcedimento(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-sky-500/50 w-64" disabled={loading} />
            </div>

            <div className="flex flex-col gap-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {procedimentosFiltrados.map(proc => (
                <div key={proc.id} className="bg-white border border-slate-200 p-4 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="mb-1">
                      <span className="font-mono text-sky-600 font-bold mr-2">{proc.codigo}</span>
                      <span className="font-medium text-slate-700">{proc.descricao}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {proc.especialidades.map(e => <span key={e} className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-md border border-slate-200">{e}</span>)}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => { setFormProcedimento(proc); window.scrollTo(0, 0) }} disabled={loading} className="text-amber-500 hover:bg-amber-50 p-2 rounded transition-colors disabled:opacity-50"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                    <button onClick={() => setDeleteModalProcedimento(proc)} disabled={loading} className="text-red-500 hover:bg-red-50 p-2 rounded transition-colors disabled:opacity-50"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                  </div>
                </div>
              ))}
              {procedimentosFiltrados.length === 0 && <p className="text-sm text-slate-400 text-center py-4">Nenhum procedimento encontrado.</p>}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}