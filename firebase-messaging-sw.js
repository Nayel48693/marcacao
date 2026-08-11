importScripts('https://www.gstatic.com/firebasejs/10.4.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.4.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: 'AIzaSyAYKk6uU8Rj-xnHaMK9itUevZId74TWF8k',
  authDomain: 'marcacao-3e416.firebaseapp.com',
  projectId: 'marcacao-3e416',
  storageBucket: 'marcacao-3e416.firebasestorage.app',
  messagingSenderId: '298508942351',
  appId: '1:298508942351:web:d3c83b788f0b3889fbb77a'
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification?.title || 'Nova notificação';
  const notificationOptions = {
    body: payload.notification?.body || 'Tens uma nova atualização de marcação.',
    icon: '/favicon.ico'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
