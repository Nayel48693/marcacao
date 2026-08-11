// Configuração central do Firebase para o site de marcações.
// Os valores reais devem ser substituídos pelo teu projeto Firebase.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js';
import { getFirestore, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js';
import { getMessaging, getToken } from 'https://www.gstatic.com/firebasejs/10.4.0/firebase-messaging.js';

const firebaseConfig = {
  apiKey: "AIzaSyAYKk6uU8Rj-xnHaMK9itUevZId74TWF8k",
  authDomain: "marcacao-3e416.firebaseapp.com",
  projectId: "marcacao-3e416",
  storageBucket: "marcacao-3e416.firebasestorage.app",
  messagingSenderId: "298508942351",
  appId: "1:298508942351:web:d3c83b788f0b3889fbb77a",
};

export const BARBEARIA_ID = '298508942351';
export const VAPID_KEY = 'BMWM-UkYc43k9bwAIR_y0dr1lqPOnUUqUwZKcJmyLjvlRUWi3zXJnt8M6QGLjWkVFSqKPtyqJlnVNMh_U8_LQwg';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const messaging = getMessaging(app);

export async function obterTokenNotificacoes() {
  try {
    const registration = await navigator.serviceWorker.ready;
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration
    });
    return token;
  } catch (erro) {
    console.error('Erro a obter token FCM:', erro);
    return null;
  }
}

export { serverTimestamp };
