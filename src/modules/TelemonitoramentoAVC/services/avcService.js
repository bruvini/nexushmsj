import { collection, addDoc, getDocs, doc, setDoc, updateDoc, query, where, orderBy, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../../../services/firebase';

const PACIENTES_COLLECTION = 'nexus_avc_pacientes';
const LOGS_COLLECTION = 'nexus_avc_logs';
const CONFIG_COLLECTION = 'nexus_avc_config';

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
 * Busca listas de exames e medicações (Configurações Iniciais)
 */
export const getInitialConfigs = async () => {
    try {
        // Tentativa de ler do config. Como pode não existir ainda, retornamos um default mockado em caso de erro.
        const examesDocRef = doc(db, CONFIG_COLLECTION, 'exames');
        const examesSnap = await getDoc(examesDocRef);

        let examesList = [];
        if (examesSnap.exists()) {
            examesList = examesSnap.data().lista || [];
        } else {
            // Default Fallback
            examesList = [
                "TC de Crânio", "Angio TC", "RM de Crânio", "Ecocardiograma",
                "Doppler de Carótidas", "Holter 24h", "Eletrocardiograma (ECG)", "Eletroencefalograma (EEG)",
                "Exames Laboratoriais (Gerais)"
            ];
            // Opcional: já inicializar o documento no firestore para o futuro
            await setDoc(examesDocRef, { lista: examesList });
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
