/**
 * firebase.js — Inicialización de Firebase.
 * Las credenciales se inyectan por Vite desde los secrets de GitHub Actions.
 */
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';

const firebaseConfig = {
  apiKey:     import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:  import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId:      import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);

// Persistencia offline: permite usar la app sin conexión y sincronizar al volver
enableIndexedDbPersistence(db).catch(err => {
  if (err.code === 'failed-precondition') {
    console.warn('TimeFlow: persistencia offline no disponible (múltiples pestañas).');
  } else if (err.code === 'unimplemented') {
    console.warn('TimeFlow: este navegador no soporta persistencia offline.');
  }
});
