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
  const data = payload?.data || {};
  const title = data.title || payload?.notification?.title || 'AI 전화 알림';
  const body = data.body || payload?.notification?.body || '설정된 AI 전화 시간이 되었습니다.';

  self.registration.showNotification(title, {
    body,
    icon: '/logo.png',
    badge: '/logo.png',
    data,
  });
});

self.addEventListener('notificationclick', function(event) {
  console.log('[Service Worker] 알림 클릭 감지');

  event.notification.close();

  const appOrigin = "https://remind-aa99f.web.app";
  // 탭이 닫혀 있을 때 열 URL (파라미터로 voicechat 진입 신호 전달)
  const newTabUrl = appOrigin + "/?open=voicechat";

  const promiseChain = clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  }).then((windowClients) => {
    let matchingClient = null;

    for (let i = 0; i < windowClients.length; i++) {
      const client = windowClients[i];
      if (client.url.includes("remind-aa99f.web.app")) {
        matchingClient = client;
        break;
      }
    }

    // 1. 이미 열린 탭이 있으면 postMessage로 voicechat 이동 신호를 보내고 포커스
    if (matchingClient) {
      matchingClient.postMessage({ type: 'NOTIFICATION_CLICK', action: 'open_voicechat' });
      return matchingClient.focus();
    }

    // 2. 탭이 없으면 ?open=voicechat 파라미터와 함께 새 탭 열기
    if (clients.openWindow) {
      return clients.openWindow(newTabUrl);
    }
  });

  event.waitUntil(promiseChain);
});
