import { collection, addDoc, getDocs, doc, setDoc, updateDoc, query, where, orderBy, serverTimestamp, getDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../../../services/firebase';

const PACIENTES_COLLECTION = 'nexus_avc_pacientes';
const LOGS_COLLECTION = 'nexus_avc_logs';
const CONFIG_COLLECTION = 'nexus_avc_config';
const EXAMES_COLLECTION = 'nexus_avc_exames';

/**
 * Registra um log operacional de qualquer ação de salvamento
 */
const logOperation = async (action, details, user = "Sistema") => {
    try {
        await addDoc(collection(db, LOGS_COLLECTION), {
            action,
            details,
            user,
            timestamp: serverTimestamp()
        });
    } catch (error) {
        console.error("Falha ao registrar log:", error);
    }
};

/**
 * Busca listas de exames e medicações (Configurações Iniciais unificadas)
 */
export const getInitialConfigs = async () => {
    try {
        const docRef = doc(db, CONFIG_COLLECTION, 'settings');
        const docSnap = await getDoc(docRef);

        let examesList = [];
        if (docSnap.exists()) {
            examesList = docSnap.data().exames || [];
        } else {
            const defaultData = {
                exames: [
                    "RAIO-X", "ECOCARDIOGRAMA TRANSTORACICO", "ECOCARDIOGRAMA TRANSESOFÁGICO",
                    "ELETROCARDIOGRAMA", "HOLTER 24H", "DOPPLER DE CARÓTIDAS", "DOPPLER TRANSTORÁCICO",
                    "LABORATORIAIS", "ANGIORNM DE CRÂNIO", "ANGIORNM CERVICAL", "ANGIOTC",
                    "RNM CRANIO", "A PEDIDO MÉDICO", "ANTICOAGULAÇÃO", "TOMOGRAFIA DE CRANIO",
                    "RNM CERVICAL"
                ],
                medicacoes: [
                    "ENOXAPARINA", "RIVAROXABANA", "APIXABANA", "MAREVAN", "VARFARINA", "AAS",
                    "CLOPIDROGREL", "EDOXABANA", "DABIGATRANA", "ACENOCUMAROL", "HEPARINA NÃO FRACIONADA",
                    "HEPARINA DE BAIXO PESO MOLECULAR", "FONDAPARINUX", "ELIQUIS"
                ],
                emails: [
                    "alice.torres@joinville.sc.gov.br", "antonia.silva@joinville.sc.gov.br",
                    "jucelena.holtz@joinville.sc.gov.br", "karin.bar@joinville.sc.gov.br",
                    "simone.josino@joinville.sc.gov.br"
                ]
            };
            await setDoc(docRef, defaultData);
            examesList = defaultData.exames;
        }

        return { success: true, configs: { exames: examesList } };
    } catch (error) {
        console.error("Erro ao buscar configurações iniciais:", error);
        return { success: false, error };
    }
}

/**
 * Checa se já existe um paciente com mesmo Nome e Data de Nascimento no Censo AVC
 * Retorna os registros encontrados
 */
export const checkPatientDuplicity = async (nome, dataNascimento) => {
    try {
        const q = query(
            collection(db, PACIENTES_COLLECTION),
            where("nome", "==", nome),
            where("dataNascimento", "==", dataNascimento)
        );
        const querySnapshot = await getDocs(q);
        const pacientes = [];
        querySnapshot.forEach((doc) => {
            pacientes.push({ id: doc.id, ...doc.data() });
        });
        return { success: true, data: pacientes, isDuplicate: pacientes.length > 0 };
    } catch (error) {
        console.error("Erro ao checar duplicidade de paciente:", error);
        return { success: false, error, isDuplicate: false };
    }
};

/**
 * Salva um novo paciente ou lida com uma reinternação
 */
export const savePatient = async (pacienteData, type = 'new', oldPatientId = null) => {
    try {
        let oldRegistrationUpdated = false;

        // Se for uma reinternação, fecha a passagem anterior
        if (type === 'reinternacao' && oldPatientId) {
            const oldRef = doc(db, PACIENTES_COLLECTION, oldPatientId);
            await updateDoc(oldRef, {
                statusLinhaCuidado: 'ENCERRADO - REINTERNAÇÃO',
                updatedAt: serverTimestamp()
            });
            oldRegistrationUpdated = true;
        }

        // Salva o novo registro no Firestore
        const docRef = await addDoc(collection(db, PACIENTES_COLLECTION), {
            ...pacienteData,
            statusLinhaCuidado: 'ATIVO', // Toda nova inclusão começa como ativa
            status_monitoramento_atual: 'REALIZAR ACOLHIMENTO', // Status pendente para a próxima etapa
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });

        // Registra Log
        await logOperation('CADASTRO_PACIENTE', {
            pacienteId: docRef.id,
            nome: pacienteData.nome,
            tipo: type,
            oldPatientId: oldPatientId || null
        }, pacienteData.profissionalResponsavel);

        return { success: true, id: docRef.id, oldRegistrationUpdated };
    } catch (error) {
        console.error("Erro ao salvar paciente AVC:", error);
        return { success: false, error };
    }
};

export const getPacientes = async () => {
    try {
        const q = query(collection(db, PACIENTES_COLLECTION), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        const pacientes = [];
        querySnapshot.forEach((doc) => {
            pacientes.push({ id: doc.id, ...doc.data() });
        });
        return { success: true, data: pacientes };
    } catch (error) {
        console.error("Erro ao buscar pacientes AVC:", error);
        return { success: false, error };
    }
};

/**
 * Busca pacientes aguardando Acolhimento
 */
export const getPendingAcolhimento = async () => {
    try {
        const q = query(
            collection(db, PACIENTES_COLLECTION),
            where("status_monitoramento_atual", "==", "REALIZAR ACOLHIMENTO"),
            orderBy("createdAt", "asc")
        );
        const querySnapshot = await getDocs(q);
        const pacientes = [];
        querySnapshot.forEach((doc) => {
            pacientes.push({ id: doc.id, ...doc.data() });
        });
        return { success: true, data: pacientes };
    } catch (error) {
        console.error("Erro ao buscar pacientes para acolhimento:", error);
        return { success: false, error };
    }
};

/**
 * Salva os dados do Acolhimento e atualiza o status do monitoramento
 */
export const saveAcolhimento = async (patientId, acolhimentoData) => {
    try {
        const docRef = doc(db, PACIENTES_COLLECTION, patientId);

        const novoStatus = acolhimentoData.elegivel_monitoramento === "SIM"
            ? 'VERIFICAR EXAMES'
            : 'NÃO ELEGÍVEL';

        await updateDoc(docRef, {
            ...acolhimentoData,
            status_monitoramento_atual: novoStatus,
            dh_reg_acolhimento: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        await logOperation('REALIZAR_ACOLHIMENTO', {
            pacienteId: patientId,
            novoStatus
        });

        return { success: true };
    } catch (error) {
        console.error("Erro ao salvar acolhimento:", error);
        return { success: false, error };
    }
};

/**
 * Lê o documento de configurações (settings) inteiro e injeta mocks default se vazio
 */
export const getAVCConfigs = async () => {
    try {
        const docRef = doc(db, CONFIG_COLLECTION, 'settings');
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return { success: true, data: docSnap.data() };
        } else {
            // Seed de Dados (Configurações Iniciais)
            const defaultData = {
                exames: [
                    "RAIO-X", "ECOCARDIOGRAMA TRANSTORACICO", "ECOCARDIOGRAMA TRANSESOFÁGICO",
                    "ELETROCARDIOGRAMA", "HOLTER 24H", "DOPPLER DE CARÓTIDAS", "DOPPLER TRANSTORÁCICO",
                    "LABORATORIAIS", "ANGIORNM DE CRÂNIO", "ANGIORNM CERVICAL", "ANGIOTC",
                    "RNM CRANIO", "A PEDIDO MÉDICO", "ANTICOAGULAÇÃO", "TOMOGRAFIA DE CRANIO",
                    "RNM CERVICAL"
                ],
                medicacoes: [
                    "ENOXAPARINA", "RIVAROXABANA", "APIXABANA", "MAREVAN", "VARFARINA", "AAS",
                    "CLOPIDROGREL", "EDOXABANA", "DABIGATRANA", "ACENOCUMAROL", "HEPARINA NÃO FRACIONADA",
                    "HEPARINA DE BAIXO PESO MOLECULAR", "FONDAPARINUX", "ELIQUIS"
                ],
                emails: [
                    "alice.torres@joinville.sc.gov.br", "antonia.silva@joinville.sc.gov.br",
                    "jucelena.holtz@joinville.sc.gov.br", "karin.bar@joinville.sc.gov.br",
                    "simone.josino@joinville.sc.gov.br"
                ]
            };
            await setDoc(docRef, defaultData);
            return { success: true, data: defaultData };
        }
    } catch (error) {
        console.error("Erro ao buscar configurações do AVC:", error);
        return { success: false, error };
    }
};

/**
 * Atualiza listas de arrays no documento de configuração
 * @param {string} tipo - 'exames', 'medicacoes', ou 'emails'
 * @param {string} acao - 'add' ou 'remove'
 * @param {string} valor - o item a ser adicionado ou removido
 */
export const updateConfigList = async (tipo, acao, valor) => {
    try {
        const docRef = doc(db, CONFIG_COLLECTION, 'settings');

        if (acao === 'add') {
            await updateDoc(docRef, {
                [tipo]: arrayUnion(valor)
            });
        } else if (acao === 'remove') {
            await updateDoc(docRef, {
                [tipo]: arrayRemove(valor)
            });
        }

        await logOperation('ATUALIZAR_CONFIG', { tipo, acao, valor });
        return { success: true };
    } catch (error) {
        console.error(`Erro ao atualizar ${tipo}:`, error);
        return { success: false, error };
    }
};

const CONSULTAS_COLLECTION = 'nexus_avc_consultas';

/**
 * Busca pacientes para a tela de Agendamento
 */
export const getAgendamentoPatients = async () => {
    try {
        const q = query(
            collection(db, PACIENTES_COLLECTION),
            where("status_monitoramento_atual", "in", ["VERIFICAR EXAMES", "AGENDAR CONSULTA", "AGUARDANDO CONSULTA", "VERIFICAR DESFECHO"]),
            orderBy("createdAt", "asc")
        );
        const querySnapshot = await getDocs(q);
        const pacientes = [];
        querySnapshot.forEach((doc) => {
            pacientes.push({ id: doc.id, ...doc.data() });
        });
        return { success: true, data: pacientes };
    } catch (error) {
        console.error("Erro ao buscar pacientes para agendamento:", error);
        return { success: false, error };
    }
};

/**
 * Buscar a consulta ativa mais recente do paciente
 */
export const getAppointmentByPatient = async (patientId) => {
    try {
        const q = query(
            collection(db, CONSULTAS_COLLECTION),
            where("id_paciente", "==", patientId),
            orderBy("createdAt", "desc")
        );
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            // Retorna a mais recente
            const docSnap = querySnapshot.docs[0];
            return { success: true, data: { id: docSnap.id, ...docSnap.data() } };
        }
        return { success: true, data: null };
    } catch (error) {
        console.error("Erro ao buscar consulta do paciente:", error);
        return { success: false, error };
    }
};

/**
 * Conta quantos profissionais/pacientes estão agendados para a data
 */
export const countDailyAppointments = async (date) => {
    try {
        const q = query(
            collection(db, CONSULTAS_COLLECTION),
            where("data_agendamento", "==", date),
            where("status", "in", ["PRE_AGENDADO", "CONFIRMADO"])
        );
        const querySnapshot = await getDocs(q);
        return { success: true, count: querySnapshot.size };
    } catch (error) {
        console.error("Erro ao contar agendamentos do dia:", error);
        return { success: false, error };
    }
};

/**
 * Salva ou atualiza a consulta
 */
export const saveAppointment = async (appointmentData, action, timerSeconds = 0) => {
    try {
        const patientRef = doc(db, PACIENTES_COLLECTION, appointmentData.id_paciente);
        let novoStatusPaciente = appointmentData.status_monitoramento_atual;

        if (action === "PRE_AGENDAR") {
            if (novoStatusPaciente !== "VERIFICAR EXAMES") {
                novoStatusPaciente = "AGUARDANDO CONSULTA";
            }
        } else if (action === "CONFIRMAR") {
            novoStatusPaciente = "VERIFICAR DESFECHO";
        } else if (action === "CANCELAR") {
            novoStatusPaciente = "AGENDAR CONSULTA";
        }

        const dataToSave = {
            ...appointmentData,
            status: action === "CANCELAR" ? "CANCELADO" : (action === "CONFIRMAR" ? "CONFIRMADO" : "PRE_AGENDADO"),
            updatedAt: serverTimestamp()
        };

        if (appointmentData.id) {
            const docRef = doc(db, CONSULTAS_COLLECTION, appointmentData.id);
            await updateDoc(docRef, dataToSave);
        } else {
            dataToSave.createdAt = serverTimestamp();
            const docRef = await addDoc(collection(db, CONSULTAS_COLLECTION), dataToSave);
            appointmentData.id = docRef.id;
        }

        // Atualiza paciente
        await updateDoc(patientRef, {
            status_monitoramento_atual: novoStatusPaciente,
            updatedAt: serverTimestamp()
        });

        await logOperation('AGENDAMENTO_CONSULTA', {
            pacienteId: appointmentData.id_paciente,
            acao: action,
            novaFase: novoStatusPaciente,
            tempo_gasto_segundos: timerSeconds
        });

        return { success: true, novoStatusPaciente };
    } catch (error) {
        console.error("Erro ao salvar agendamento:", error);
        return { success: false, error };
    }
};

/**
 * Busca pacientes aguardando Checagem de Exames
 */
export const getPendingExamesPatients = async () => {
    try {
        const q = query(
            collection(db, PACIENTES_COLLECTION),
            where("status_monitoramento_atual", "==", "VERIFICAR EXAMES"),
            orderBy("createdAt", "asc")
        );
        const querySnapshot = await getDocs(q);
        const pacientes = [];
        querySnapshot.forEach((doc) => {
            pacientes.push({ id: doc.id, ...doc.data() });
        });
        return { success: true, data: pacientes };
    } catch (error) {
        console.error("Erro ao buscar pacientes para exames:", error);
        return { success: false, error };
    }
};

/**
 * Inicializa exames se não existirem
 */
const initializeExamsFromPatient = async (patientId) => {
    try {
        const patientRef = doc(db, PACIENTES_COLLECTION, patientId);
        const patientSnap = await getDoc(patientRef);

        if (!patientSnap.exists()) return [];

        const patientData = patientSnap.data();
        const examesIniciais = patientData.examesMarcados || [];

        const initializedExams = [];

        // Garante que mesmo vazio, não trave a fila. Mas se tem na base, cria
        for (const exameNome of examesIniciais) {
            const newExam = {
                id_paciente: patientId,
                nome: exameNome,
                status: 'PENDENTE',
                origem: 'Alta Hospitalar',
                createdAt: serverTimestamp(),
                data_checagem: null
            };
            const docRef = await addDoc(collection(db, EXAMES_COLLECTION), newExam);
            initializedExams.push({ id: docRef.id, ...newExam });
        }

        return initializedExams;
    } catch (error) {
        console.error("Erro ao inicializar exames a partir da triagem:", error);
        return [];
    }
};

/**
 * Busca exames de um paciente. Se vazio na subcoleção, inicializa a partir do cadastro do paciente.
 */
export const getExamsByPatient = async (patientId) => {
    try {
        const q = query(
            collection(db, EXAMES_COLLECTION),
            where("id_paciente", "==", patientId),
            orderBy("createdAt", "asc")
        );
        const querySnapshot = await getDocs(q);

        let exames = [];
        querySnapshot.forEach((doc) => {
            exames.push({ id: doc.id, ...doc.data() });
        });

        if (exames.length === 0) {
            exames = await initializeExamsFromPatient(patientId);
        }

        return { success: true, data: exames };
    } catch (error) {
        console.error("Erro ao buscar exames do paciente:", error);
        return { success: false, error };
    }
};

/**
 * Adiciona um exame manualmente
 */
export const addExamManually = async (patientId, exameNome) => {
    try {
        const newExam = {
            id_paciente: patientId,
            nome: exameNome,
            status: 'PENDENTE',
            origem: 'Adicionado Manualmente',
            createdAt: serverTimestamp(),
            data_checagem: null
        };
        const docRef = await addDoc(collection(db, EXAMES_COLLECTION), newExam);

        await logOperation('ADICIONAR_EXAME', {
            pacienteId: patientId,
            exame: exameNome
        });

        return { success: true, data: { id: docRef.id, ...newExam } };
    } catch (error) {
        console.error("Erro ao adicionar exame manual:", error);
        return { success: false, error };
    }
}

/**
 * Verifica se todos estão concluídos
 */
const checkAllExamsDone = async (patientId) => {
    try {
        const q = query(
            collection(db, EXAMES_COLLECTION),
            where("id_paciente", "==", patientId),
            where("status", "==", "PENDENTE")
        );
        const querySnapshot = await getDocs(q);

        // Se retornar 0, significa que não há mais pendentes (estão todos FEITOS ou CANCELADOS)
        if (querySnapshot.empty) {
            const patientRef = doc(db, PACIENTES_COLLECTION, patientId);
            await updateDoc(patientRef, {
                status_monitoramento_atual: "AGENDAR CONSULTA",
                updatedAt: serverTimestamp()
            });

            await logOperation('AVANCO_FASE', {
                pacienteId: patientId,
                novaFase: "AGENDAR CONSULTA",
                motivo: "Todos os exames concluídos"
            });

            return true; // Mudou de fase
        }
        return false;
    } catch (error) {
        console.error("Erro ao verificar conclusão dos exames:", error);
        return false;
    }
}

/**
 * Atualiza status de um exame específico
 */
export const updateExamStatus = async (examId, newStatus, patientId) => {
    try {
        const docRef = doc(db, EXAMES_COLLECTION, examId);

        await updateDoc(docRef, {
            status: newStatus,
            data_checagem: serverTimestamp()
        });

        // Após atualizar o exame, verifica se deve mover de fase
        const phaseChanged = await checkAllExamsDone(patientId);

        return { success: true, phaseChanged };
    } catch (error) {
        console.error("Erro ao atualizar status do exame:", error);
        return { success: false, error };
    }
};

const DESFECHOS_COLLECTION = 'nexus_avc_desfechos';

/**
 * Busca pacientes na fase de Desfecho, cruzando com os dados da consulta original
 */
export const getPatientsForOutcome = async () => {
    try {
        const q = query(
            collection(db, PACIENTES_COLLECTION),
            where("status_monitoramento_atual", "==", "VERIFICAR DESFECHO"),
            orderBy("createdAt", "desc")
        );
        const querySnapshot = await getDocs(q);
        const pacientes = [];

        // Fazer um loop paralelo para buscar a consulta
        for (const docSnap of querySnapshot.docs) {
            const pData = docSnap.data();
            const pId = docSnap.id;

            let consultaData = null;
            try {
                const qC = query(
                    collection(db, CONSULTAS_COLLECTION),
                    where("id_paciente", "==", pId),
                    where("status", "==", "CONFIRMADO"),
                    orderBy("createdAt", "desc")
                );
                const cSnap = await getDocs(qC);
                if (!cSnap.empty) {
                    consultaData = { id: cSnap.docs[0].id, ...cSnap.docs[0].data() };
                }
            } catch (e) {
                console.warn("Nenhuma consulta confirmada atrelada encontrada para", pId);
            }

            pacientes.push({ id: pId, ...pData, consulta_ref: consultaData });
        }

        return { success: true, data: pacientes };
    } catch (error) {
        console.error("Erro ao buscar pacientes para desfecho:", error);
        return { success: false, error };
    }
};

/**
 * Salva o Desfecho Clínico
 */
export const saveOutcome = async (outcomeData, timerSeconds) => {
    try {
        const { id_paciente, consulta_id, resultado_consulta, exames_solicitados, observacoes, atendimento_realizado } = outcomeData;

        // 1. Gravar Desfecho
        const dataToSave = {
            id_paciente,
            consulta_id: consulta_id || null,
            resultado_consulta,
            exames_solicitados: exames_solicitados || [],
            observacoes,
            atendimento_realizado,
            createdAt: serverTimestamp()
        };
        const outcomeRef = await addDoc(collection(db, DESFECHOS_COLLECTION), dataToSave);

        // 2. Transição de Status do Paciente
        const patientRef = doc(db, PACIENTES_COLLECTION, id_paciente);
        let novoStatusPaciente = "VERIFICAR DESFECHO"; // Fallback

        // Mapeamento de Regras do Formulário para Status
        if (resultado_consulta === "ALTA") novoStatusPaciente = "MONITORAMENTO CONCLUÍDO";
        else if (resultado_consulta === "ALTA_EMAD") novoStatusPaciente = "ENCAMINHADO PARA EMAD";
        else if (resultado_consulta === "RETORNO_MEDICO" || resultado_consulta === "FALTA_REAGENDAR") novoStatusPaciente = "AGENDAR CONSULTA";
        else if (resultado_consulta === "RETORNO_EXAMES") novoStatusPaciente = "VERIFICAR EXAMES";
        else if (resultado_consulta === "FALTA_ENCERRAR") novoStatusPaciente = "ENCERRADO - ABANDONO";

        await updateDoc(patientRef, {
            status_monitoramento_atual: novoStatusPaciente,
            updatedAt: serverTimestamp()
        });

        // 3. Atualizar Status da Consulta Atrelada (para as estatisticas)
        if (consulta_id) {
            const consultRef = doc(db, CONSULTAS_COLLECTION, consulta_id);
            await updateDoc(consultRef, {
                status: atendimento_realizado ? "REALIZADA" : "NAO_COMPARECEU", // Pelo form do gas, sabemos se não compareceu e encerrou.
                desfecho_atrelado: outcomeRef.id,
                updatedAt: serverTimestamp()
            });
        }

        // 4. Se SOLICITOU_EXAMES (Retorno Exames), popular novos na coleção
        if (resultado_consulta === "RETORNO_EXAMES" && exames_solicitados && exames_solicitados.length > 0) {
            for (const exameNome of exames_solicitados) {
                const newExam = {
                    id_paciente: id_paciente,
                    nome: exameNome,
                    status: 'PENDENTE',
                    origem: 'Consulta de Retorno',
                    createdAt: serverTimestamp(),
                    data_checagem: null
                };
                await addDoc(collection(db, EXAMES_COLLECTION), newExam);
            }
        }

        // 5. Registrar Log Operacional
        await logOperation('REGISTRAR_DESFECHO', {
            pacienteId: id_paciente,
            resultado: resultado_consulta,
            novaFase_paciente: novoStatusPaciente,
            tempo_gasto_segundos: timerSeconds
        });

        return { success: true, novaFase: novoStatusPaciente };

    } catch (error) {
        console.error("Erro ao registrar o desfecho clínico:", error);
        return { success: false, error };
    }
};

// ==========================================
// CENTRAL DE CONTATO (CRM)
// ==========================================

export const getPatientsForCRM = async () => {
    try {
        const q = query(
            collection(db, PACIENTES_COLLECTION),
            where('status_monitoramento_atual', 'not-in', ['NÃO ELEGÍVEL', 'MONITORAMENTO CONCLUÍDO', 'ENCERRADO - ÓBITO', 'ENCERRADO - ABANDONO', 'ENCERRADO - REINTERNAÇÃO'])
        );

        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => {
            const docData = doc.data();

            // Collect the 3 potential phones
            const telefones = [];
            if (docData.telefone) telefones.push(docData.telefone);
            if (docData.telefone2) telefones.push(docData.telefone2);
            if (docData.telefone3) telefones.push(docData.telefone3);

            return {
                id: doc.id,
                nome: docData.nome || 'Sem Nome',
                status_monitoramento_atual: docData.status_monitoramento_atual || 'DESCONHECIDO',
                telefones: telefones
            };
        });

        // Ordenar alfabeticamente
        data.sort((a, b) => a.nome.localeCompare(b.nome));

        return { success: true, data };
    } catch (error) {
        console.error('Erro ao buscar pacientes para CRM:', error);
        return { success: false, error: error.message };
    }
};

export const saveContact = async (contactData) => {
    try {
        const contatoRef = doc(collection(db, 'nexus_avc_contatos'));

        await setDoc(contatoRef, {
            id_paciente: contactData.id_paciente || null,
            meio_contato: contactData.meio_contato || '',
            data_contato: serverTimestamp(),
            hora_inicio: contactData.hora_inicio || '',
            hora_fim: contactData.hora_fim || '',
            duracao_minutos: contactData.duracao_minutos || 0,
            categoria_desfecho: contactData.categoria_desfecho || '',
            observacoes: contactData.observacoes || ''
        });

        // Registrar Log Operacional
        await logOperation('REGISTRO DE CONTATO CRM', {
            pacienteId: contactData.id_paciente,
            detalhes: `Via ${contactData.meio_contato}: ${contactData.categoria_desfecho}. Duração: ${contactData.duracao_minutos}min.`,
            tempo_gasto_segundos: contactData.duracao_minutos * 60
        });

        return { success: true, contatoid: contatoRef.id };
    } catch (error) {
        console.error('Erro ao salvar contato:', error);
        return { success: false, error: error.message };
    }
};

// ==========================================
// MAILING / LISTA AMBULATORIAL
// ==========================================

export const getConfirmedDates = async () => {
    try {
        const q = query(
            collection(db, CONSULTAS_COLLECTION),
            where('status', '==', 'CONFIRMADO')
        );
        const snapshot = await getDocs(q);

        const dates = new Set();
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.data_agendamento) {
                dates.add(data.data_agendamento);
            }
        });

        // Ordenar as datas decrescente ou crescente
        const sortedDates = Array.from(dates).sort((a, b) => new Date(a) - new Date(b));

        return { success: true, data: sortedDates };
    } catch (error) {
        console.error('Erro ao buscar datas confirmadas:', error);
        return { success: false, error: error.message };
    }
};

export const getDailySchedulePreview = async (date) => {
    try {
        // 1. Get Consultas on the date
        const qConsultas = query(
            collection(db, CONSULTAS_COLLECTION),
            where('data_agendamento', '==', date),
            where('status', '==', 'CONFIRMADO')
        );
        const consultasSnap = await getDocs(qConsultas);

        const previewList = [];

        for (const cDoc of consultasSnap.docs) {
            const consultaData = cDoc.data();
            const pacienteId = consultaData.id_paciente;

            if (!pacienteId) continue;

            // 2. Get Paciente
            const pRef = doc(db, PACIENTES_COLLECTION, pacienteId);
            const pSnap = await getDoc(pRef);
            let pData = { nome: 'Desconhecido', data_nascimento: null, prontuario: 'N/A' };
            if (pSnap.exists()) {
                pData = pSnap.data();
            }

            // Calcula Idade
            let idade = 0;
            if (pData.data_nascimento) {
                const birthDate = new Date(pData.data_nascimento);
                const today = new Date();
                idade = today.getFullYear() - birthDate.getFullYear();
                const m = today.getMonth() - birthDate.getMonth();
                if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                    idade--;
                }
            }

            // 3. Get Exames
            const qExames = query(
                collection(db, EXAMES_COLLECTION),
                where('id_paciente', '==', pacienteId)
            );
            const examesSnap = await getDocs(qExames);
            const exames = examesSnap.docs.map(e => {
                const eData = e.data();
                return {
                    nome: eData.exame_nome || eData.nome || 'Desconhecido',
                    status: eData.status // 'PENDENTE', 'CONCLUÍDO', 'CANCELADO'
                };
            });

            previewList.push({
                hora: consultaData.hora_agendamento || '00:00',
                nome: pData.nome,
                idade: `${idade} anos`,
                prontuario: pData.prontuario || 'N/A',
                exames: exames
            });
        }

        // Sort by Time
        previewList.sort((a, b) => a.hora.localeCompare(b.hora));

        return { success: true, data: previewList };
    } catch (error) {
        console.error('Erro ao montar preview diário:', error);
        return { success: false, error: error.message };
    }
};

export const triggerEmailSend = async (payload) => {
    try {
        const queueRef = doc(collection(db, 'nexus_avc_mail_queue'));

        await setDoc(queueRef, {
            ...payload,
            status: 'PENDING',
            created_at: serverTimestamp()
        });

        // Registrar Log Operacional
        await logOperation('DISPARO DE E-MAIL (QUEUE)', {
            assunto: payload.assunto,
            destinatarios: payload.destinatarios,
            referencia_data: payload.data_alvo
        });

        return { success: true, queueId: queueRef.id };
    } catch (error) {
        console.error('Erro ao enfileirar email:', error);
        return { success: false, error: error.message };
    }
};

// ==========================================
// PRONTUÁRIO ELETRÔNICO (PERFIL 360)
// ==========================================

export const getComprehensivePatientData = async (patientId) => {
    try {
        if (!patientId) throw new Error("ID do Paciente is required.");

        // Referências das consultas
        const pRef = doc(db, PACIENTES_COLLECTION, patientId);
        const qExames = query(collection(db, EXAMES_COLLECTION), where('id_paciente', '==', patientId));
        const qConsultas = query(collection(db, CONSULTAS_COLLECTION), where('id_paciente', '==', patientId));
        const qContatos = query(collection(db, 'nexus_avc_contatos'), where('id_paciente', '==', patientId));
        const qDesfechos = query(collection(db, DESFECHOS_COLLECTION), where('id_paciente', '==', patientId));

        // Busca Paralela
        const [pSnap, examesSnap, consultasSnap, contatosSnap, desfechosSnap] = await Promise.all([
            getDoc(pRef),
            getDocs(qExames),
            getDocs(qConsultas),
            getDocs(qContatos),
            getDocs(qDesfechos)
        ]);

        if (!pSnap.exists()) {
            return { success: false, error: "Paciente não encontrado." };
        }

        const pacienteData = { id: pSnap.id, ...pSnap.data() };

        // Calcular Idade
        let idade = 'N/I';
        if (pacienteData.data_nascimento) {
            const birth = new Date(pacienteData.data_nascimento);
            const today = new Date();
            let age = today.getFullYear() - birth.getFullYear();
            const m = today.getMonth() - birth.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
                age--;
            }
            idade = age;
        }

        const exames = examesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const consultas = consultasSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const contatos = contatosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const desfechos = desfechosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Check Anticoagulante in Patient Data or Configs?
        // Medicacao de alta is usually an array or string
        let usaAnticoagulante = false;
        if (pacienteData.medicacao_alta) {
            const anticoagulantesList = [
                'ENOXAPARINA', 'RIVAROXABANA', 'APIXABANA', 'MAREVAN',
                'VARFARINA', 'EDOXABANA', 'DABIGATRANA', 'ACENOCUMAROL',
                'HEPARINA NÃO FRACIONADA', 'HEPARINA DE BAIXO PESO MOLECULAR',
                'FONDAPARINUX', 'ELIQUIS'
            ];

            const meds = typeof pacienteData.medicacao_alta === 'string'
                ? pacienteData.medicacao_alta.split(',').map(m => m.trim().toUpperCase())
                : (Array.isArray(pacienteData.medicacao_alta) ? pacienteData.medicacao_alta.map(m => typeof m === 'string' ? m.toUpperCase() : '') : []);

            usaAnticoagulante = meds.some(m => anticoagulantesList.includes(m));
        }

        return {
            success: true,
            data: {
                paciente: { ...pacienteData, idade, usaAnticoagulante },
                exames,
                consultas,
                contatos,
                desfechos
            }
        };

    } catch (error) {
        console.error("Erro ao montar prontuário Eletrônico:", error);
        return { success: false, error: error.message };
    }
};
