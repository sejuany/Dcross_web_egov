/* 백그라운드 FCM 알림 수신용 워커. Firebase가 notification과 fcm_options.link를 처리한다. */
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
