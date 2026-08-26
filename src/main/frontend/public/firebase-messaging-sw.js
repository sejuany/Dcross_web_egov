/* 백그라운드 FCM 알림 수신용 워커. Firebase가 notification과 fcm_options.link를 처리한다. */
importScripts('https://www.gstatic.com/firebasejs/12.18.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.18.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyBIna2IqKRZwsJ0yFonWdOzFKWQ4TES42c',
  authDomain: 'dcross-no.firebaseapp.com',
  projectId: 'dcross-no',
  storageBucket: 'dcross-no.firebasestorage.app',
  messagingSenderId: '253936722169',
  appId: '1:253936722169:web:fb26fc41cc808027338228',
});

firebase.messaging();
