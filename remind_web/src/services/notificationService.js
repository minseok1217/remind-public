import { collection, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { db, app } from '../firebase';

const PUSH_FUNCTION_URL = 'https://us-central1-remind-aa99f.cloudfunctions.net/pushSend';

const getTokenDocId = async (token) => {
  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(token));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

export const saveNotificationToken = async (patientId, token, platform = 'web') => {
  if (!patientId || !token) return null;

  const tokenId = await getTokenDocId(token);
  const tokenRef = doc(db, 'patients', patientId, 'notification_tokens', tokenId);

  await setDoc(tokenRef, {
    token,
    platform,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  }, { merge: true });

  return token;
};

export const registerWebPushToken = async (patientId) => {
  if (!patientId) {
    throw new Error('Patient id is required.');
  }

  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
    throw new Error('이 브라우저는 웹 알림을 지원하지 않습니다.');
  }

  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
  if (!vapidKey) {
    throw new Error('VITE_FIREBASE_VAPID_KEY가 설정되지 않았습니다.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('브라우저 알림 권한이 허용되지 않았습니다.');
  }

  const [{ getMessaging, getToken, isSupported }] = await Promise.all([
    import('firebase/messaging'),
  ]);

  const supported = await isSupported();
  if (!supported) {
    throw new Error('현재 브라우저에서는 Firebase 웹 알림을 사용할 수 없습니다.');
  }

  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  const messaging = getMessaging(app);
  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: registration,
  });

  if (!token) {
    throw new Error('웹 알림 토큰을 발급받지 못했습니다.');
  }

  await saveNotificationToken(patientId, token, 'web');
  return token;
};

export const listenForForegroundPushMessages = async () => {
  if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') {
    return () => {};
  }

  const { getMessaging, onMessage, isSupported } = await import('firebase/messaging');
  const supported = await isSupported();
  if (!supported) {
    return () => {};
  }

  const messaging = getMessaging(app);
  return onMessage(messaging, (payload) => {
    const time = payload?.data?.time;
    const title = payload?.notification?.title || 'Remind';
    const body = payload?.notification?.body || (time ? `${time} 통화 시간이 되었어요.` : '통화 시간이 되었어요.');

    new Notification(title, {
      body,
      icon: '/logo.png',
      data: payload?.data || {},
    });
  });
};

export const getPatientNotificationTokens = async (patientId, legacyToken) => {
  const tokens = new Set();

  if (legacyToken) {
    tokens.add(legacyToken);
  }

  const tokenSnapshot = await getDocs(collection(db, 'patients', patientId, 'notification_tokens'));
  tokenSnapshot.forEach((tokenDoc) => {
    const token = tokenDoc.data()?.token;
    if (token) {
      tokens.add(token);
    }
  });

  return Array.from(tokens);
};

export const sendPushNotificationToTokens = async (tokens, formattedTime) => {
  const uniqueTokens = Array.from(new Set(tokens.filter(Boolean)));
  if (uniqueTokens.length === 0) {
    return [];
  }

  const requests = uniqueTokens.map(async (token) => {
    const response = await fetch(PUSH_FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        data: {
          time: formattedTime,
        },
      }),
    });

    const result = await response.json();
    console.log('[Notification] pushSend response:', result);
    return result;
  });

  return Promise.allSettled(requests);
};
