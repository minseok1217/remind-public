importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyDiGHtBF69iR3w8BRaR8PnVfGf0k1pbogg',
  authDomain: 'remind-aa99f.firebaseapp.com',
  databaseURL: 'https://remind-aa99f-default-rtdb.firebaseio.com',
  projectId: 'remind-aa99f',
  storageBucket: 'remind-aa99f.firebasestorage.app',
  messagingSenderId: '286493951038',
  appId: '1:286493951038:web:e167943198eaba8fee7d6f',
  measurementId: 'G-SVS8W4HX01',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const time = payload?.data?.time;
  const title = payload?.notification?.title || 'Remind';
  const body = payload?.notification?.body || (time ? `${time} 통화 시간이 되었어요.` : '통화 시간이 되었어요.');

  self.registration.showNotification(title, {
    body,
    icon: '/logo.png',
    badge: '/logo.png',
    data: payload?.data || {},
  });
});
