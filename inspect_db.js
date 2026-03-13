import * as dotenv from 'dotenv';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, limit, where } from 'firebase/firestore';

// O vite expõe as envs no import.meta.env, mas no node precisamos do dotenv se tiver num arquivo .env
// Porém no firebase.js o projeto já tem as credenciais. Vou tentar apenas carregar do firebase.js se possível.
