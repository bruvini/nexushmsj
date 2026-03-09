import { collection, addDoc, getDocs, doc, setDoc, updateDoc, query, where, orderBy, serverTimestamp, getDoc, arrayUnion, arrayRemove, writeBatch, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../../services/firebase';

const PACIENTES_COLLECTION = 'nexus_avc_pacientes';
const LOGS_COLLECTION = 'nexus_avc_logs';
const CONFIG_COLLECTION = 'nexus_avc_config';
const EXAMES_COLLECTION = 'nexus_avc_exames';
const CONSULTAS_COLLECTION = 'nexus_avc_consultas';
const DESFECHOS_COLLECTION = 'nexus_avc_desfechos';
const CONTATOS_COLLECTION = 'nexus_avc_contatos';

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
 * Realiza upload agressivo em Lotes (Batches) para o Firestore Firestore (Max 500 por transação)
 * @param {Array} pacientesArray Array de objetos estritamente mapeados pro padrão Firebase
 */
export const importarPacientesLoteCSV = async (pacientesArray) => {
    try {
        if (!pacientesArray || pacientesArray.length === 0) return { success: false, error: 'Lista vazia' };

        const chunkSize = 500; // Limite global do Firestore para Batch
        let totalImported = 0;

        for (let i = 0; i < pacientesArray.length; i += chunkSize) {
            const chunk = pacientesArray.slice(i, i + chunkSize);
            const batch = writeBatch(db);

            chunk.forEach((pacienteObj) => {
                // A regra solicita: Mapeamento de id_paciente explícito como id do document
                const { id_paciente, ...dadosPaciente } = pacienteObj;
                if (!id_paciente) return; // Segurança contra quebra

                const docRef = doc(db, PACIENTES_COLLECTION, id_paciente);

                // Mapeia `status` se vier do CSV para `status_monitoramento_atual` caso apropriado,
                // mas garantimos que a arvore nativa do firebase sempre recebe `status_monitoramento_atual`.
                const cleanData = {
                    ...dadosPaciente,
                    status_monitoramento_atual: dadosPaciente.status_monitoramento_atual || dadosPaciente.status || 'ENCERRADO - REINTERNAÇÃO',
                    isImportadoLegado: true,
                    importedAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                };
                if (!cleanData.createdAt) cleanData.createdAt = serverTimestamp();

                batch.set(docRef, cleanData, { merge: true });
            });

            await batch.commit();
            totalImported += chunk.length;
        }

        await logOperation('IMPORTACAO_LOTE_CSV', `Foram importados/atualizados ${totalImported} pacientes do legado.`);

        return { success: true, count: totalImported };
    } catch (error) {
        console.error("Erro crítico ao executar Batch Import:", error);
        return { success: false, error: error.message };
    }
};

/**
 * Realiza upload agressivo em Lotes (Batches) para a Coleção de Exames (Max 500 por transação)
 * @param {Array} examesArray Array de objetos higienizados de exames com vínculo obrigatório ao Paciente
 */
export const importarExamesLoteCSV = async (examesArray) => {
    try {
        if (!examesArray || examesArray.length === 0) return { success: false, error: 'Lista vazia' };

        const chunkSize = 500;
        let totalImported = 0;

        for (let i = 0; i < examesArray.length; i += chunkSize) {
            const chunk = examesArray.slice(i, i + chunkSize);
            const batch = writeBatch(db);

            chunk.forEach((exameObj) => {
                // A regra solicita: Mapeamento de id_exame explícito como id do document, ou gerar dinâmico se nulo (embora a instrução fale id_exame do CSV)
                const { id_exame, ...dadosExame } = exameObj;

                // Vínculo obrigatório ao paciente já foi filtrado no Frontend, mas fica a segurança
                if (!dadosExame.id_paciente) return;

                // Se não vier id_exame fixo, deixa o firebase criar. (Mas a instrução pede docRef explícito se tiver)
                const docRef = id_exame
                    ? doc(db, EXAMES_COLLECTION, id_exame)
                    : doc(collection(db, EXAMES_COLLECTION));

                const cleanData = {
                    ...dadosExame,
                    isImportadoLegado: true,
                    importedAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                };
                if (!cleanData.createdAt) cleanData.createdAt = serverTimestamp();

                batch.set(docRef, cleanData, { merge: true });
            });

            await batch.commit();
            totalImported += chunk.length;
        }

        await logOperation('IMPORTACAO_LOTE_EXAMES_CSV', `Foram importados/atualizados ${totalImported} exames do legado.`);

        return { success: true, count: totalImported };
    } catch (error) {
        console.error("Erro crítico ao executar Batch Import de Exames:", error);
        return { success: false, error: error.message };
    }
};

/**
 * Realiza upload agressivo em Lotes (Batches) para a Coleção de Consultas (Max 500 por transação)
 * @param {Array} consultasArray Array de objetos higienizados de consultas com vínculo obrigatório ao Paciente
 */
export const importarConsultasLoteCSV = async (consultasArray) => {
    try {
        if (!consultasArray || consultasArray.length === 0) return { success: false, error: 'Lista vazia' };

        const chunkSize = 500;
        let totalImported = 0;

        for (let i = 0; i < consultasArray.length; i += chunkSize) {
            const chunk = consultasArray.slice(i, i + chunkSize);
            const batch = writeBatch(db);

            chunk.forEach((consultaObj) => {
                const { id_consulta, ...dadosConsulta } = consultaObj;

                // Vínculo obrigatório ao paciente
                if (!dadosConsulta.pacienteId) return;

                const docRef = id_consulta
                    ? doc(db, CONSULTAS_COLLECTION, id_consulta)
                    : doc(collection(db, CONSULTAS_COLLECTION));

                const cleanData = {
                    ...dadosConsulta,
                    isImportadoLegado: true,
                    importedAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                };
                if (!cleanData.createdAt) cleanData.createdAt = serverTimestamp();

                batch.set(docRef, cleanData, { merge: true });
            });

            await batch.commit();
            totalImported += chunk.length;
        }

        await logOperation('IMPORTACAO_LOTE_CONSULTAS_CSV', `Foram importados/atualizados ${totalImported} consultas do legado.`);

        return { success: true, count: totalImported };
    } catch (error) {
        console.error("Erro crítico ao executar Batch Import de Consultas:", error);
        return { success: false, error: error.message };
    }
};

/**
 * Realiza upload agressivo em Lotes (Batches) para a Coleção de Desfechos (Max 500 por transação)
 * @param {Array} desfechosArray Array de objetos higienizados de desfechos com vínculo obrigatório
 */
export const importarDesfechosLoteCSV = async (desfechosArray) => {
    try {
        if (!desfechosArray || desfechosArray.length === 0) return { success: false, error: 'Lista vazia' };

        const chunkSize = 500;
        let totalImported = 0;

        for (let i = 0; i < desfechosArray.length; i += chunkSize) {
            const chunk = desfechosArray.slice(i, i + chunkSize);
            const batch = writeBatch(db);

            chunk.forEach((desfechoObj) => {
                const { id_desfecho, ...dadosDesfecho } = desfechoObj;

                // Vínculo obrigatório ao paciente
                if (!dadosDesfecho.pacienteId) return;

                const docRef = id_desfecho
                    ? doc(db, DESFECHOS_COLLECTION, id_desfecho)
                    : doc(collection(db, DESFECHOS_COLLECTION));

                const cleanData = {
                    ...dadosDesfecho,
                    isImportadoLegado: true,
                    importedAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                };
                if (!cleanData.createdAt) cleanData.createdAt = serverTimestamp();

                batch.set(docRef, cleanData, { merge: true });
            });

            await batch.commit();
            totalImported += chunk.length;
        }

        await logOperation('IMPORTACAO_LOTE_DESFECHOS_CSV', `Foram importados/atualizados ${totalImported} desfechos do legado.`);

        return { success: true, count: totalImported };
    } catch (error) {
        console.error("Erro crítico ao executar Batch Import de Desfechos:", error);
        return { success: false, error: error.message };
    }
};

/**
 * Realiza upload agressivo em Lotes (Batches) para a Coleção de Contatos (Max 500 por transação)
 * @param {Array} contatosArray Array de objetos higienizados de contatos com vínculo obrigatório
 */
export const importarContatosLoteCSV = async (contatosArray) => {
    try {
        if (!contatosArray || contatosArray.length === 0) return { success: false, error: 'Lista vazia' };

        const chunkSize = 500;
        let totalImported = 0;

        for (let i = 0; i < contatosArray.length; i += chunkSize) {
            const chunk = contatosArray.slice(i, i + chunkSize);
            const batch = writeBatch(db);

            chunk.forEach((contatoObj) => {
                const { id_contato, ...dadosContato } = contatoObj;

                // Vínculo obrigatório ao paciente
                if (!dadosContato.pacienteId) return;

                const docRef = id_contato
                    ? doc(db, CONTATOS_COLLECTION, id_contato)
                    : doc(collection(db, CONTATOS_COLLECTION));

                const cleanData = {
                    ...dadosContato,
                    isImportadoLegado: true,
                    importedAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                };
                if (!cleanData.createdAt) cleanData.createdAt = serverTimestamp();

                batch.set(docRef, cleanData, { merge: true });
            });

            await batch.commit();
            totalImported += chunk.length;
        }

        await logOperation('IMPORTACAO_LOTE_CONTATOS_CSV', `Foram importados/atualizados ${totalImported} contatos históricos do legado.`);

        return { success: true, count: totalImported };
    } catch (error) {
        console.error("Erro crítico ao executar Batch Import de Contatos:", error);
        return { success: false, error: error.message };
    }
};

/**
 * Realiza upload agressivo em Lotes (Batches) para a Coleção de Logs (Max 500 por transação)
 * @param {Array} logsArray Array de objetos higienizados de logs com vínculo obrigatório
 */
export const importarLogsLoteCSV = async (logsArray) => {
    try {
        if (!logsArray || logsArray.length === 0) return { success: false, error: 'Lista vazia' };

        const chunkSize = 500;
        let totalImported = 0;

        for (let i = 0; i < logsArray.length; i += chunkSize) {
            const chunk = logsArray.slice(i, i + chunkSize);
            const batch = writeBatch(db);

            chunk.forEach((logObj) => {
                // Vínculo obrigatório ao paciente
                if (!logObj.pacienteId) return;

                // Gera auto-ID pois logs não têm e nem precisam de ID legado resgatável
                const newLogRef = doc(collection(db, LOGS_COLLECTION));

                const cleanData = {
                    ...logObj,
                    isImportadoLegado: true,
                    importedAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                };
                if (!cleanData.createdAt) cleanData.createdAt = serverTimestamp();

                batch.set(newLogRef, cleanData); // Não precisa merge pois a doc_ref é sempre nova
            });

            await batch.commit();
            totalImported += chunk.length;
        }

        await logOperation('IMPORTACAO_LOTE_LOGS_CSV', `Foram importados ${totalImported} logs históricos do legado.`);

        return { success: true, count: totalImported };
    } catch (error) {
        console.error("Erro crítico ao executar Batch Import de Logs:", error);
        return { success: false, error: error.message };
    }
};

/**
 * ==========================================
 * ARQUITETURA DE ROTEAMENTO DO KANBAN AVC
 * ==========================================
 * O Dashboard do AVC deriva o status visual dos pacientes reagindo aos sub-documentos:
 * 
 * REGRA A (PRECISA AGENDAR):
 * O paciente cai nesta coluna se as seguintes condições existirem:
 * - Possui exames com status_exame === "PENDENTE".
 * - OU todos os seus exames estão "CHECADOS" (resolvidos), mas o paciente AINDA NÃO 
 *   possui uma consulta com `data_confirmada` válida no banco de Consultas.
 * 
 * REGRA B (PRÓXIMAS CONSULTAS):
 * O paciente avança para esta etapa SE:
 * - Já possuir uma consulta com `data_confirmada` registrada e em aberto.
 * - E concomitantemente, todos os seus exames solicitados estiverem com status 
 *   resolvido ("REALIZADO", "CANCELADO" ou "CHECADO").
 * 
 * Isso exige um onSnapshot root em Pacientes, cruzando em tempo real com getDocs 
 * ou onSnapshot nas coleções nexus_avc_exames e nexus_avc_consultas.
 * 
 * ==========================================
 * ROTAS DE CONCLUSÃO E REATIVAÇÃO (DESFECHOS)
 * ==========================================
 * O Kanban derivará o status final avaliando cronologicamente os Desfechos (nexus_avc_desfechos):
 * 
 * - REATIVAÇÃO DE CICLO: Se o desfecho mais recente for `RETORNO_EXAMES`, `RETORNO_MEDICO`, 
 *   ou `FALTA_REAGENDAR`, ou o array `novos_exames` possuir itens atrelados, o paciente não 
 *   está encerrado. Retorna às dinâmicas ativas ("Verificar Exames", "Precisa Agendar").
 * 
 * - ENCERRAMENTO DE CICLO: Se culminar em `ALTA`, `DESISTÊNCIA`, `FALTA_ENCERRAR`, 
 *   `ALTA_EMAD` ou `ÓBITO`, o front tranca o paciente na macroetapa "Concluídos" (Oculto 
 *   do fluxo diário caso determinado pelas views).
 */

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

// ==========================================
// ZONA DE PERIGO E ENCERRAMENTO (ÓBITO/DESISTÊNCIA)
// ==========================================

export const closeMonitoring = async (payload) => {
    try {
        const { id_paciente, motivo_encerramento, data_falecimento, observacoes } = payload;

        if (!id_paciente || !motivo_encerramento) {
            throw new Error("ID do Paciente e Motivo são obrigatórios.");
        }

        // 1. Atualizar Paciente
        const pRef = doc(db, PACIENTES_COLLECTION, id_paciente);
        await updateDoc(pRef, {
            status_monitoramento_atual: motivo_encerramento === 'ÓBITO' ? 'ÓBITO' : 'DESISTÊNCIA',
            data_encerramento: serverTimestamp(),
            motivo_encerramento: motivo_encerramento,
            data_falecimento: data_falecimento || null
        });

        // 2. Registrar no Desfecho para Histórico (com flag especial ADM_ENCERRAMENTO)
        const dRef = collection(db, DESFECHOS_COLLECTION);
        await addDoc(dRef, {
            id_paciente,
            id_consulta_ref: 'ADM_ENCERRAMENTO',
            data_registro: serverTimestamp(),
            resultado_consulta: motivo_encerramento,
            observacoes: observacoes || `Encerramento administrativo por ${motivo_encerramento}.`
        });

        // 3. Log
        await logOperation(
            `ENCERRAMENTO_${motivo_encerramento}`,
            `Paciente ${id_paciente} encerrado por ${motivo_encerramento}. Obs: ${observacoes || ''}`
        );

        return { success: true };
    } catch (error) {
        console.error("Erro ao encerrar monitoramento:", error);
        return { success: false, error: error.message };
    }
};

export const deletePatientCompletely = async (patientId) => {
    try {
        if (!patientId) throw new Error("ID do paciente é obrigatório para exclusão.");

        const batch = writeBatch(db);

        // 1. Delete Patient Document
        const pRef = doc(db, PACIENTES_COLLECTION, patientId);
        batch.delete(pRef);

        // Funções auxiliares para buscar e deletar documentos em sub-coleções
        const deleteLinkedDocs = async (collectionName) => {
            const q = query(collection(db, collectionName), where('id_paciente', '==', patientId));
            const snap = await getDocs(q);
            snap.docs.forEach(d => {
                batch.delete(d.ref);
            });
        };

        // 2. Add DELETES to batch for all related collections
        await deleteLinkedDocs(EXAMES_COLLECTION);
        await deleteLinkedDocs(CONSULTAS_COLLECTION);
        await deleteLinkedDocs('nexus_avc_contatos');
        await deleteLinkedDocs(DESFECHOS_COLLECTION);

        // 3. Commit Atomic Batch (All or nothing)
        await batch.commit();

        // 4. Log the deletion ATTEMPT and SUCCESS (Audit Trail - Never delete the log)
        await logOperation(
            'EXCLUSAO_PACIENTE',
            `Paciente ID ${patientId} e todos os seus registros (${EXAMES_COLLECTION}, ${CONSULTAS_COLLECTION}, contatos, desfechos) foram EXCLUÍDOS PERMANENTEMENTE do banco.`
        );

        return { success: true };
    } catch (error) {
        console.error("Erro crítico na Zona de Perigo (Exclusão):", error);
        return { success: false, error: error.message };
    }
};

// ==========================================
// PAINEL GERAL E KANBAN (DASHBOARD)
// ==========================================

export const getDashboardData = async () => {
    try {
        // Buscar todos os pacientes
        const pacientesSnap = await getDocs(collection(db, PACIENTES_COLLECTION));
        const todosPacientes = pacientesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Buscar Contatos totais
        const contatosSnap = await getDocs(collection(db, 'nexus_avc_contatos'));
        const totalContatos = contatosSnap.size;

        // Buscar Consultas futuras (agendadas mas não confirmadas/realizadas - simplificando, vamos buscar todas e filtrar no código)
        const consultasSnap = await getDocs(collection(db, CONSULTAS_COLLECTION));
        const todasConsultas = consultasSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const now = new Date();
        const consultasFuturas = todasConsultas.filter(c => {
            if (c.status !== 'AGENDADO') return false;

            let dataAgendamento;
            if (c.data_agendamento && c.data_agendamento.toDate) {
                dataAgendamento = c.data_agendamento.toDate();
            } else if (c.data_agendamento) {
                // assume string YYYY-MM-DD
                dataAgendamento = new Date(c.data_agendamento + 'T23:59:59'); // end of day 
            } else {
                return false;
            }
            return dataAgendamento >= new Date(now.setHours(0, 0, 0, 0));
        });

        // ==========================
        // 1. KPIs
        // ==========================
        const kpis = {
            cadastrados: todosPacientes.length,
            ativos: todosPacientes.filter(p => !['ÓBITO', 'DESISTÊNCIA', 'MONITORAMENTO CONCLUÍDO', 'ENCAMINHADO PARA EMAD'].includes(p.status_monitoramento_atual)).length,
            contatos: totalContatos,
            agendados: consultasFuturas.length,
            concluidos: todosPacientes.filter(p => ['MONITORAMENTO CONCLUÍDO', 'ENCAMINHADO PARA EMAD'].includes(p.status_monitoramento_atual)).length
        };

        // ==========================
        // 2. KANBAN CATEGORIES
        // ==========================
        const kanban = {
            acolhimento: [],
            exames: [],
            agendar: [],
            proximas: [],
            desfecho: []
        };

        // Populate Kanban (Only active patients)
        const pacientesAtivos = todosPacientes.filter(p => !['ÓBITO', 'DESISTÊNCIA', 'MONITORAMENTO CONCLUÍDO', 'ENCAMINHADO PARA EMAD'].includes(p.status_monitoramento_atual));

        for (const p of pacientesAtivos) {

            // Format basic card data
            const cardData = {
                id: p.id,
                nome: p.nome,
                prontuario: p.prontuario || 'N/I',
                data_nascimento: p.data_nascimento, // para idade depois
                status: p.status_monitoramento_atual,
                telefone: p.telefone || p.telefone2 || 'Sem telefone',
                resumo: ''
            };

            switch (p.status_monitoramento_atual) {
                case 'REALIZAR ACOLHIMENTO':
                    cardData.resumo = 'Aguardando contato inicial';
                    kanban.acolhimento.push(cardData);
                    break;
                case 'VERIFICAR EXAMES':
                    // Contar exames pendentes
                    // Note: Num sistema massivo isso precisaria de otimização, mas como são exames de poucos pacientes ativos, fazemos query leve filtrando do que temos se quisermos ou buscar especifico
                    cardData.resumo = `Checar exames em andamento`;
                    kanban.exames.push(cardData);
                    break;
                case 'AGENDAR CONSULTA':
                    cardData.resumo = 'Prioridade: Marcar retorno';
                    kanban.agendar.push(cardData);
                    break;
                case 'AGUARDANDO CONSULTA':
                    // Finding their specific appointment
                    const consultaProj = consultasFuturas.find(c => c.id_paciente === p.id);
                    if (consultaProj) {
                        cardData.resumo = `Consulta em ${consultaProj.data_agendamento}`;
                        cardData.data_ordenacao = consultaProj.data_agendamento; // Para reordenar a coluna
                    } else {
                        cardData.resumo = `Consulta futura agendada`;
                        cardData.data_ordenacao = '9999-12-31';
                    }
                    kanban.proximas.push(cardData);
                    break;
                case 'VERIFICAR DESFECHO':
                    cardData.resumo = 'Realizou consulta, aguardando parecer';
                    kanban.desfecho.push(cardData);
                    break;
                default:
                    // Outros status menores, se caírem aqui, não vão pro Kanban pra não poluir.
                    break;
            }
        }

        // Sort "Proximas" by date closest to today
        kanban.proximas.sort((a, b) => a.data_ordenacao?.localeCompare(b.data_ordenacao));

        return {
            success: true,
            kpis,
            kanban
        };

    } catch (error) {
        console.error("Erro ao carregar Dashboard Kanban:", error);
        return { success: false, error: error.message };
    }
};

export const subscribeDashboardData = (callback) => {
    let todosPacientes = [];
    let todosContatosSize = 0;
    let todasConsultas = [];

    let isPacientesLoaded = false;
    let isContatosLoaded = false;
    let isConsultasLoaded = false;

    const emitIfReady = () => {
        if (!isPacientesLoaded || !isContatosLoaded || !isConsultasLoaded) return;

        const now = new Date();
        const consultasFuturas = todasConsultas.filter(c => {
            if (c.status !== 'AGENDADO') return false;
            let dataAgendamento;
            if (c.data_agendamento && c.data_agendamento.toDate) {
                dataAgendamento = c.data_agendamento.toDate();
            } else if (c.data_agendamento) {
                dataAgendamento = new Date(c.data_agendamento + 'T23:59:59');
            } else {
                return false;
            }
            return dataAgendamento >= new Date(now.setHours(0, 0, 0, 0));
        });

        const kpis = {
            cadastrados: todosPacientes.length,
            ativos: todosPacientes.filter(p => !['ÓBITO', 'DESISTÊNCIA', 'MONITORAMENTO CONCLUÍDO', 'ENCAMINHADO PARA EMAD'].includes(p.status_monitoramento_atual)).length,
            contatos: todosContatosSize,
            agendados: consultasFuturas.length,
            concluidos: todosPacientes.filter(p => ['MONITORAMENTO CONCLUÍDO', 'ENCAMINHADO PARA EMAD'].includes(p.status_monitoramento_atual)).length
        };

        const kanban = { acolhimento: [], exames: [], agendar: [], proximas: [], desfecho: [] };
        const pacientesAtivos = todosPacientes.filter(p => !['ÓBITO', 'DESISTÊNCIA', 'MONITORAMENTO CONCLUÍDO', 'ENCAMINHADO PARA EMAD'].includes(p.status_monitoramento_atual));

        for (const p of pacientesAtivos) {
            const cardData = {
                id: p.id,
                nome: p.nome,
                prontuario: p.prontuario || 'N/I',
                data_nascimento: p.data_nascimento,
                status: p.status_monitoramento_atual,
                telefone: p.telefone || p.telefone2 || 'Sem telefone',
                resumo: ''
            };

            switch (p.status_monitoramento_atual) {
                case 'REALIZAR ACOLHIMENTO':
                    cardData.resumo = 'Aguardando contato inicial';
                    kanban.acolhimento.push(cardData);
                    break;
                case 'VERIFICAR EXAMES':
                    cardData.resumo = `Checar exames em andamento`;
                    kanban.exames.push(cardData);
                    break;
                case 'AGENDAR CONSULTA':
                    cardData.resumo = 'Prioridade: Marcar retorno';
                    kanban.agendar.push(cardData);
                    break;
                case 'AGUARDANDO CONSULTA':
                    const consultaProj = consultasFuturas.find(c => c.id_paciente === p.id);
                    if (consultaProj) {
                        cardData.resumo = `Consulta em ${consultaProj.data_agendamento}`;
                        cardData.data_ordenacao = consultaProj.data_agendamento;
                    } else {
                        cardData.resumo = `Consulta futura agendada`;
                        cardData.data_ordenacao = '9999-12-31';
                    }
                    kanban.proximas.push(cardData);
                    break;
                case 'VERIFICAR DESFECHO':
                    cardData.resumo = 'Realizou consulta, aguardando parecer';
                    kanban.desfecho.push(cardData);
                    break;
                default:
                    break;
            }
        }

        kanban.proximas.sort((a, b) => a.data_ordenacao?.localeCompare(b.data_ordenacao));

        callback({ success: true, kpis, kanban });
    };

    const unsubPacientes = onSnapshot(collection(db, PACIENTES_COLLECTION), (snap) => {
        todosPacientes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        isPacientesLoaded = true;
        emitIfReady();
    }, (error) => {
        console.error("Erro pacientes onSnapshot:", error);
        callback({ success: false, error: error.message });
    });

    const unsubContatos = onSnapshot(collection(db, 'nexus_avc_contatos'), (snap) => {
        todosContatosSize = snap.size;
        isContatosLoaded = true;
        emitIfReady();
    }, (error) => {
        console.error("Erro contatos onSnapshot:", error);
    });

    const unsubConsultas = onSnapshot(collection(db, CONSULTAS_COLLECTION), (snap) => {
        todasConsultas = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        isConsultasLoaded = true;
        emitIfReady();
    }, (error) => {
        console.error("Erro consultas onSnapshot:", error);
    });

    return () => {
        unsubPacientes();
        unsubContatos();
        unsubConsultas();
    };
};

// ==========================================
// TEMPLATE DE E-MAIL INSTITUCIONAL
// ==========================================

export const generateEmailHtml = (data) => {
    const { dateBr, responsavel, previewList } = data;

    let htmlStr = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; color: #334155; max-width: 800px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <!-- Header Institucional -->
            <div style="background-color: #0f172a; color: white; padding: 25px 30px; border-bottom: 4px solid #3b82f6;">
                <h1 style="margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Hospital Municipal São José</h1>
                <h2 style="margin: 5px 0 0 0; font-size: 16px; font-weight: 400; color: #94a3b8;">Nexus Hub - Telemonitoramento AVC (Pós-Alta)</h2>
            </div>
            
            <!-- Resumo da Agenda -->
            <div style="padding: 25px 30px; background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                <h3 style="margin: 0 0 15px 0; color: #1e293b; font-size: 18px; display: flex; align-items: center;">
                    📋 Prévia da Agenda Ambulatorial
                </h3>
                <table style="width: 100%; font-size: 14px;">
                    <tr>
                        <td style="padding: 5px 0; color: #64748b; width: 150px;"><strong>Data da Consulta:</strong></td>
                        <td style="padding: 5px 0; font-weight: 600; color: #0f172a;">${dateBr}</td>
                    </tr>
                    <tr>
                        <td style="padding: 5px 0; color: #64748b;"><strong>Responsável:</strong></td>
                        <td style="padding: 5px 0; font-weight: 600; color: #0f172a;">${responsavel || 'Equipe AVC'}</td>
                    </tr>
                    <tr>
                        <td style="padding: 5px 0; color: #64748b;"><strong>Total de Pacientes:</strong></td>
                        <td style="padding: 5px 0; font-weight: 600; color: #0f172a;">${previewList.length}</td>
                    </tr>
                </table>
            </div>

            <!-- Tabela de Pacientes -->
            <div style="padding: 30px;">
                <table style="width: 100%; border-collapse: collapse; margin-top: 5px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                    <thead>
                        <tr style="background-color: #f1f5f9; border-top: 1px solid #cbd5e1; border-bottom: 2px solid #cbd5e1; text-align: left;">
                            <th style="padding: 12px 15px; font-size: 13px; color: #475569; font-weight: 700; text-transform: uppercase;">Hora</th>
                            <th style="padding: 12px 15px; font-size: 13px; color: #475569; font-weight: 700; text-transform: uppercase;">Paciente</th>
                            <th style="padding: 12px 15px; font-size: 13px; color: #475569; font-weight: 700; text-transform: uppercase;">Nasc. (Idade)</th>
                            <th style="padding: 12px 15px; font-size: 13px; color: #475569; font-weight: 700; text-transform: uppercase; width: 100px;">Prontuário</th>
                            <th style="padding: 12px 15px; font-size: 13px; color: #475569; font-weight: 700; text-transform: uppercase;">Status Exames Base</th>
                        </tr>
                    </thead>
                    <tbody>
    `;

    if (previewList.length === 0) {
        htmlStr += `<tr><td colspan="5" style="padding: 20px; text-align: center; color: #94a3b8; font-style: italic; background-color: #fff;">Nenhum paciente agendado para esta data.</td></tr>`;
    }

    const examesIconMap = {
        'CONCLUÍDO': 'https://raw.githubusercontent.com/google/material-design-icons/master/png/action/done/materialicons/24dp/2x/baseline_done_black_24dp.png',
        'PENDENTE': 'https://raw.githubusercontent.com/google/material-design-icons/master/png/alert/error_outline/materialicons/24dp/2x/baseline_error_outline_black_24dp.png',
        'CANCELADO': 'https://raw.githubusercontent.com/google/material-design-icons/master/png/content/block/materialicons/24dp/2x/baseline_block_black_24dp.png'
    };

    previewList.forEach((item, index) => {
        const bg = index % 2 === 0 ? '#ffffff' : '#f8fafc';

        // Render exames list
        let examesHtml = '<ul style="margin: 0; padding-left: 0; list-style-type: none; font-size: 12px;">';
        if (item.exames && item.exames.length > 0) {
            item.exames.forEach(ex => {
                let statusColor = '#cbd5e1'; // DEFAULT (cancelado)
                let statusText = 'Cancelado';

                if (ex.status === 'CONCLUÍDO') {
                    statusColor = '#22c55e'; // GREEN
                    statusText = 'Feito';
                } else if (ex.status === 'PENDENTE') {
                    statusColor = '#ef4444'; // RED
                    statusText = 'Pendente';
                }

                examesHtml += `
                    <li style="margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
                        <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${statusColor};"></span>
                        <strong style="color: ${statusColor};">${statusText}</strong>: ${ex.nome}
                    </li>
                `;
            });
        } else {
            examesHtml += `<li><span style="color: #94a3b8; font-style: italic;">Sem exames atrelados</span></li>`;
        }
        examesHtml += '</ul>';

        htmlStr += `
            <tr style="background-color: ${bg}; border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 15px; font-weight: 700; font-size: 14px; color: #0f172a;">${item.hora}</td>
                <td style="padding: 15px; font-size: 14px; font-weight: 500; color: #1e293b;">${item.nome}</td>
                <td style="padding: 15px; font-size: 13px; color: #64748b;">${item.idade}</td>
                <td style="padding: 15px; font-size: 13px; font-family: monospace; color: #475569; letter-spacing: 0.5px;">${item.prontuario}</td>
                <td style="padding: 15px;">${examesHtml}</td>
            </tr>
        `;
    });

    htmlStr += `
                    </tbody>
                </table>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #f1f5f9; padding: 20px 30px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #64748b;">
                <p style="margin: 0 0 5px 0;">Este é um e-mail automático gerado pelo <strong>Nexus Hub de Inteligência Hospitalar</strong>.</p>
                <p style="margin: 0;">Por favor, não responda a este e-mail.</p>
            </div>
        </div>
    `;

    return htmlStr;
};
