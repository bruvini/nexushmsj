import { doc, updateDoc, serverTimestamp, deleteField } from 'firebase/firestore';
import { db } from '../../../services/firebase';

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
export const updatePatientSpecialties = async (patientId, primary, additional = []) => {
    if (!patientId || !primary) return;
    const patientRef = doc(db, 'nexus_kanban_pacientes', patientId);

    try {
        await updateDoc(patientRef, {
            especialidade_gestao: {
                principal: primary,
                adicionais: additional,
                atualizado_em: serverTimestamp(),
                is_manual: true
            }
        });
    } catch (error) {
        console.error(`Erro ao atualizar Especialidades da Gestão:`, error);
        throw error;
    }
};
