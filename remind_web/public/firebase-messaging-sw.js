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

self.addEventListener('notificationclick', function(event) {
  console.log('[Service Worker] 알림 클릭 감지');
  
  event.notification.close();

  // 백엔드에서 지정한 대시보드 URL 주소 가져오기
  let targetUrl = "https://remind-aa99f.web.app/dashboard";
  if (event.notification.data && event.notification.data.url) {
    targetUrl = event.notification.data.url;
  } else if (event.notification.clickAction) {
    targetUrl = event.notification.clickAction;
  }

  const promiseChain = clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  }).then((windowClients) => {
    let matchingClient = null;

    // 우리 서비스 탭이 브라우저에 이미 켜져 있는지 확인
    for (let i = 0; i < windowClients.length; i++) {
      const client = windowClients[i];
      if (client.url.includes("remind-aa99f.web.app")) {
        matchingClient = client;
        break;
      }
    }

    // 1. 이미 켜져 있는 탭이 있다면 해당 탭을 대시보드 경로로 이동시키고 포커스
    if (matchingClient) {
      return matchingClient.navigate(targetUrl).then(client => client.focus());
    }
    
    // 2. 아예 다 닫혀 있다면 새 탭으로 대시보드 열기
    // (이때 웹앱 내부 소스코드에서 기존 자동 로그인 세션을 체크하여 화면을 띄우게 됩니다)
    if (clients.openWindow) {
      return clients.openWindow(targetUrl);
    }
  });

  event.waitUntil(promiseChain);
});
