/* 백그라운드 FCM 표시와 클릭은 Firebase가 처리하고, 직접 표시한 알림의 클릭만 처리한다. */
self.addEventListener('install', (event) => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

function numplateNotificationUrl(value) {
  try {
    const url = new URL(value, self.location.origin);
    return url.origin === self.location.origin && !url.username && !url.password
      && (url.pathname === '/numplateapp' || url.pathname.startsWith('/numplateapp/')) ? url : null;
  } catch {
    return null;
  }
}

self.addEventListener('notificationclick', (event) => {
  if (event.notification.data?.numplateForeground !== true) return;
  event.stopImmediatePropagation();
  event.notification.close();
  const url = numplateNotificationUrl(event.notification.data.url)
    || new URL('/numplateapp/notifications', self.location.origin);
  event.waitUntil((async () => {
    try {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existing = windows.find((client) => numplateNotificationUrl(client.url));
      if (existing) {
        const navigated = await existing.navigate(url.href);
        if (navigated) {
          await navigated.focus();
          return;
        }
      }
    } catch {
      // 닫힌 창이나 이동할 수 없는 창은 새 창으로 대체한다.
    }
    await self.clients.openWindow(url.href);
  })());
});

importScripts('https://www.gstatic.com/firebasejs/12.18.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.18.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyDGHCTqvWNNRVEd8dHv3wgVDkm6rKX3dP8',
  authDomain: 'dcross-web.firebaseapp.com',
  projectId: 'dcross-web',
  storageBucket: 'dcross-web.firebasestorage.app',
  messagingSenderId: '583946147446',
  appId: '1:583946147446:web:276daa5573ccaae691b157',
});

firebase.messaging();
