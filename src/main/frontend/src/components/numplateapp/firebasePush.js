import axios from 'axios';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getMessaging, getToken, isSupported } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: 'AIzaSyBIna2IqKRZwsJ0yFonWdOzFKWQ4TES42c',
  authDomain: 'dcross-no.firebaseapp.com',
  projectId: 'dcross-no',
  storageBucket: 'dcross-no.firebasestorage.app',
  messagingSenderId: '253936722169',
  appId: '1:253936722169:web:fb26fc41cc808027338228',
  measurementId: 'G-HTC90PQ5WV',
};

const vapidKey = 'BLmyiWTaAX6bVHJUL8DSIV9n_AiQD_XBPpF81eHAGVmK0iPMs-JBse3jS2rdPJU9nLe9hAxUKasyCVos3rcVmjg';

export const pushStatus = () => {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return 'unsupported';
  return Notification.permission;
};

/** 사용자 동작으로 권한을 받은 뒤 현재 브라우저 토큰을 로그인 담당자에게 연결한다. */
export async function enablePushNotifications({ requestPermission = true } = {}) {
  if (!(await isSupported())) throw new Error('이 브라우저는 푸시 알림을 지원하지 않습니다.');
  if (Notification.permission === 'default' && requestPermission) await Notification.requestPermission();
  if (Notification.permission !== 'granted') throw new Error('알림 권한이 허용되지 않았습니다.');

  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const token = await getToken(getMessaging(app), { vapidKey, serviceWorkerRegistration: registration });
  if (!token) throw new Error('푸시 토큰을 발급받지 못했습니다.');
  await axios.post('/api/numplateapp/push/token', { token });
  return token;
}
