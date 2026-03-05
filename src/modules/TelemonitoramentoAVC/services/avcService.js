import { collection, addDoc, getDocs, doc, setDoc, updateDoc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../services/firebase';

const COLLECTION_NAME = 'nexus_avc_pacientes';

export const savePaciente = async (pacienteData) => {
    try {
        const docRef = await addDoc(collection(db, COLLECTION_NAME), {
            ...pacienteData,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        return { success: true, id: docRef.id };
    } catch (error) {
        console.error("Erro ao salvar paciente AVC:", error);
        return { success: false, error };
    }
};

export const getPacientes = async () => {
    try {
        const q = query(collection(db, COLLECTION_NAME), orderBy("createdAt", "desc"));
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
