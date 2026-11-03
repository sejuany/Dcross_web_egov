import axios from 'axios';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: 'AIzaSyDGHCTqvWNNRVEd8dHv3wgVDkm6rKX3dP8',
  authDomain: 'dcross-web.firebaseapp.com',
  projectId: 'dcross-web',
  storageBucket: 'dcross-web.firebasestorage.app',
  messagingSenderId: '583946147446',
  appId: '1:583946147446:web:276daa5573ccaae691b157',
  measurementId: 'G-1BB41EPBGM',
};

const vapidKey = 'BONdh7N0mxcBWaj-H4UBKcoTk8X5r9oOHJ_C9nQ-f7_YlajQiHH4iLYEwfLZtVQOhuLDQMt63UGzFPA6eEfwAfg';

export const firebaseProjectId = firebaseConfig.projectId;
export const firebaseVapidConfigured = Boolean(vapidKey);
export const PUSH_RECEIVED_EVENT = 'numplate-push-received';
const getPushMessaging = () => getMessaging(getApps().length ? getApp() : initializeApp(firebaseConfig));

export const pushStatus = () => {
  if (!window.isSecureContext || !('Notification' in window) || !('serviceWorker' in navigator)) return 'unsupported';
  return Notification.permission;
};

/** 사용자 동작으로 권한을 받은 뒤 현재 브라우저 토큰을 로그인 담당자에게 연결한다. */
export async function enablePushNotifications({ requestPermission = true } = {}) {
  if (!window.isSecureContext) throw new Error('푸시 알림은 HTTPS 또는 PC의 localhost에서 사용할 수 있습니다.');
  if (!firebaseVapidConfigured) throw new Error('dcross-web 프로젝트의 VAPID 공개 키를 먼저 설정해 주세요.');
  if (pushStatus() === 'unsupported') throw new Error('이 브라우저는 푸시 알림을 지원하지 않습니다.');
  if (Notification.permission === 'default' && requestPermission) await Notification.requestPermission();
  if (Notification.permission !== 'granted') throw new Error('알림 권한이 허용되지 않았습니다.');
  if (!(await isSupported())) throw new Error('이 브라우저는 푸시 알림을 지원하지 않습니다.');

  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  await navigator.serviceWorker.ready;
  // 프로젝트 이전 시 브라우저에 남아 있는 이전 VAPID 키의 구독을 교체한다.
  const subscription = await registration.pushManager.getSubscription();
  if (subscription?.options.applicationServerKey) {
    const previousKey = btoa(String.fromCharCode(...new Uint8Array(subscription.options.applicationServerKey)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    if (previousKey !== vapidKey) await subscription.unsubscribe();
  }
  const token = await getToken(getPushMessaging(), { vapidKey, serviceWorkerRegistration: registration });
  if (!token) throw new Error('푸시 토큰을 발급받지 못했습니다.');
  await axios.post('/api/numplateapp/push/token', { token });
  return token;
}

export async function subscribeToPushMessages(callback) {
  if (pushStatus() === 'unsupported' || !(await isSupported())) return () => {};
  return onMessage(getPushMessaging(), callback);
}
