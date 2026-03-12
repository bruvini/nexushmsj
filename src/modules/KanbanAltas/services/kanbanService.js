import { doc, getDoc, updateDoc, serverTimestamp, deleteField, collection, addDoc, increment, arrayUnion } from 'firebase/firestore';
import { db, auth } from '../../../services/firebase';

export const saveActivityLog = async (patientId, action, description) => {
    try {
        let patientName = 'Massa Censo / Multicards';
        if (patientId && patientId !== 'CENSO') {
            const patientRef = doc(db, 'nexus_kanban_pacientes', patientId);
            const patientSnap = await getDoc(patientRef);
            if (patientSnap.exists()) patientName = patientSnap.data().nome;
        }

        const authUser = auth?.currentUser;
        const userName = authUser?.displayName || authUser?.email || "Interação Local";

        await addDoc(collection(db, 'nexus_kanban_logs'), {
            id_paciente: patientId || 'SISTEMA',
            nome_paciente: patientName,
            usuario_nome: userName,
            acao: action,
            descricao: description,
            timestamp: serverTimestamp()
        });
    } catch (error) {
        console.error("Erro ao salvar log:", error);
    }
};

/**
 * Adiciona ou remove uma tag clínica simples (ex: EMAD, Retaguarda) de um paciente.
 * 
 * @param {string} patientId ID do paciente no Firestore
 * @param {string} tagName Nome da tag a ser configurada (ex: 'perfil_emad', 'perfil_retaguarda')
 * @param {boolean} active Status true para adicionar, false para remover
 */
export const toggleClinicalTag = async (patientId, tagName, active) => {
    if (!patientId || !tagName) return;
    const patientRef = doc(db, 'nexus_kanban_pacientes', patientId);

    try {
        const payload = {};
        if (active) {
            payload[tagName] = {
                active: true,
                timestamp: serverTimestamp()
            };
        } else {
            payload[tagName] = deleteField();
        }
        await updateDoc(patientRef, payload);

        const formatTagName = (tag) => {
            const map = {
                'perfil_emad': 'EMAD',
                'perfil_retaguarda': 'Retaguarda',
                'provavel_alta': 'Provável Alta',
                'fluxo_trauma': 'Fluxo Trauma'
            };
            return map[tag] || tag.replace('perfil_', '').toUpperCase();
        };
        const nomeFormatado = formatTagName(tagName);
        await saveActivityLog(patientId, tagName.toUpperCase(), active ? `Marcou a tag ${nomeFormatado}` : `Desmarcou a tag ${nomeFormatado}`);
    } catch (error) {
        console.error(`Erro ao atualizar tag ${tagName}:`, error);
        throw error;
    }
};

/**
 * Adiciona ou atualiza a marcação de 'Provável Alta' com a pendência informada.
 * 
 * @param {string} patientId ID do paciente no Firestore
 * @param {string} pendencia Texto justificando o entrave/pendência para a alta
 */
export const updateProvavelAlta = async (patientId, pendencia) => {
    if (!patientId || !pendencia) return;
    const patientRef = doc(db, 'nexus_kanban_pacientes', patientId);

    try {
        await updateDoc(patientRef, {
            provavel_alta: {
                active: true,
                pendencia: pendencia,
                timestamp: serverTimestamp()
            }
        });
        await saveActivityLog(patientId, 'ALTA', `Sinalizou provável alta: ${pendencia}`);
    } catch (error) {
        console.error(`Erro ao atualizar Provável Alta:`, error);
        throw error;
    }
};

/**
 * Remove a marcação de 'Provável Alta' de um paciente.
 * 
 * @param {string} patientId ID do paciente no Firestore
 */
export const removeProvavelAlta = async (patientId) => {
    if (!patientId) return;
    const patientRef = doc(db, 'nexus_kanban_pacientes', patientId);

    try {
        await updateDoc(patientRef, {
            provavel_alta: deleteField()
        });
        await saveActivityLog(patientId, 'ALTA', `Removeu sinalização de alta`);
    } catch (error) {
        console.error(`Erro ao remover Provável Alta:`, error);
        throw error;
    }
};

/**
 * Adiciona ou atualiza a marcação de 'Fluxo Trauma' com a descrição informada.
 * 
 * @param {string} patientId ID do paciente no Firestore
 * @param {string} descricao Texto descrevendo o trauma
 */
export const updateFluxoTrauma = async (patientId, descricao) => {
    if (!patientId || !descricao) return;
    const patientRef = doc(db, 'nexus_kanban_pacientes', patientId);

    try {
        await updateDoc(patientRef, {
            fluxo_trauma: {
                active: true,
                descricao: descricao,
                timestamp: serverTimestamp()
            }
        });
        await saveActivityLog(patientId, 'TRAUMA', `Sinalizou fluxo trauma: ${descricao}`);
    } catch (error) {
        console.error(`Erro ao atualizar Fluxo Trauma:`, error);
        throw error;
    }
};

/**
 * Remove a marcação de 'Fluxo Trauma' de um paciente.
 * 
 * @param {string} patientId ID do paciente no Firestore
 */
export const removeFluxoTrauma = async (patientId) => {
    if (!patientId) return;
    const patientRef = doc(db, 'nexus_kanban_pacientes', patientId);

    try {
        await updateDoc(patientRef, {
            fluxo_trauma: deleteField()
        });
        await saveActivityLog(patientId, 'TRAUMA', `Removeu sinalização de fluxo trauma`);
    } catch (error) {
        console.error(`Erro ao remover Fluxo Trauma:`, error);
        throw error;
    }
};

/**
 * Atualiza o array de medicações em curso do paciente.
 * Garante que cada medicação tenha um ID único e data de modificação.
 * 
 * @param {string} patientId ID do paciente no Firestore
 * @param {Array} medicationsArray Array de objetos de medicação
 */
export const updateMedications = async (patientId, medicationsArray) => {
    if (!patientId) return;
    const patientRef = doc(db, 'nexus_kanban_pacientes', patientId);

    try {
        // Assegurar que os itens tenham um id (se criados no client, já devem ter, mas garantimos)
        const parsedArray = medicationsArray.map(med => ({
            ...med,
            id: med.id || crypto.randomUUID(),
        }));

        await updateDoc(patientRef, {
            medicacoes_curso: parsedArray,
            medicacoes_updated_at: serverTimestamp()
        });
        // Log específico é feito no componente
    } catch (error) {
        console.error(`Erro ao atualizar Medicações:`, error);
        throw error;
    }
};

/**
 * Adiciona ou atualiza a gestão de especialidades do paciente,
 * ativando a flag manual para proteger contra sobrescritas do sistema automático.
 * 
 * @param {string} patientId ID do paciente no Firestore
 * @param {string} primary Especialidade principal
 * @param {Array} additional Array de strings com especialidades adicionais cruzadas
 */
export const updatePatientSpecialties = async (patientId, primary, additional = [], historico = null) => {
    if (!patientId || !primary) return;
    const patientRef = doc(db, 'nexus_kanban_pacientes', patientId);

    try {
        const payload = {
            especialidade_gestao: {
                principal: primary,
                adicionais: additional,
                atualizado_em: serverTimestamp(),
                is_manual: true
            }
        };

        if (historico) {
            payload['especialidade_gestao.historico'] = arrayUnion(historico);
        }

        await updateDoc(patientRef, payload);
    } catch (error) {
        console.error(`Erro ao atualizar Especialidades da Gestão:`, error);
        throw error;
    }
};

/**
 * Ativa ou desativa a flag do Protocolo de Capacidade Plena (PCP) para um paciente.
 *
 * @param {string} patientId ID do paciente no Firestore
 * @param {boolean} active true para ativar, false para remover a flag
 */
export const togglePCP = async (patientId, active) => {
    if (!patientId) return;
    const patientRef = doc(db, 'nexus_kanban_pacientes', patientId);
    try {
        if (active) {
            await updateDoc(patientRef, {
                pcp: true,
                pcp_ativado_em: serverTimestamp()
            });
            await saveActivityLog(patientId, 'PCP', 'Sinalizou paciente como elegível para leito PCP');
        } else {
            await updateDoc(patientRef, {
                pcp: false,
                pcp_ativado_em: deleteField()
            });
            await saveActivityLog(patientId, 'PCP', 'Removeu sinalização de leito PCP');
        }
    } catch (error) {
        console.error('Erro ao atualizar flag PCP:', error);
        throw error;
    }
};

/**
 * Salva a alteração de status/histórico do SISREG e computa estatística global.
 * @param {string} patientId 
 * @param {object} payload Dados exatos que subirão no updateDoc do paciente.
 * @param {string} logMessage 
 * @param {string} statKey (Opcional) Chave da estatística na nexus_estatisticas/sisreg_global a incrementar.
 */
export const saveSisregWorkflow = async (patientId, payload, logMessage, statKey = null) => {
    if (!patientId || !payload) return;
    try {
        const patientRef = doc(db, 'nexus_kanban_pacientes', patientId);
        await updateDoc(patientRef, payload);

        if (logMessage) {
            await saveActivityLog(patientId, 'SISREG', logMessage);
        }

        if (statKey) {
            const statRef = doc(db, 'nexus_estatisticas', 'sisreg_global');
            await updateDoc(statRef, {
                [statKey]: increment(1),
                ultima_atualizacao: serverTimestamp()
            }).catch(async (e) => {
                // Ignore missing error quietly to avoid breaking flow if document doesn't exist
            });
        }
    } catch (error) {
        console.error("Erro ao salvar SISREG Workflow:", error);
        throw error;
    }
};
