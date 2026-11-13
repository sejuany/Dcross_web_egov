import React from 'react';

const descriptions = {
  'browser-confirm': 'Chrome 브라우저로 진입합니다.',
  'browser-menu': 'Chrome 오른쪽 위 점 세 개 메뉴를 여는 위치입니다.',
  'browser-scroll': '메뉴를 아래로 내려 설치 및 바로가기 만들기를 찾습니다.',
  'install-choice': '첫 번째 설치 항목과 이어서 나타나는 팝업창의 설치를 선택합니다.',
  'home-icon': '설치가 끝나면 홈 버튼을 눌러 생성된 DACOS 번호판 아이콘을 확인합니다.',
  'app-open': 'DACOS 번호판 아이콘을 눌러 설치한 앱을 실행합니다.',
  'login-input': '아이디와 비밀번호를 입력하고 로그인 상태 유지 선택 후 로그인합니다.',
  'login-passkey': '패스키 만들기에서 계속을 누르고 처리목록의 비밀번호 저장 안내를 확인합니다.',
  'fingerprint-faceid': 'Face ID·지문으로 로그인 버튼을 누르고 등록된 패스키를 선택하여 지문·얼굴 인증으로 로그인합니다.',
};

const guideVideos = {
  'browser-confirm': "app_install_1_samsung_browser_guide",
  'browser-menu': "app_install_2",
  'browser-scroll': "app_install_3",
  'install-choice': "app_install_4",
  'home-icon': "app_install_5",
  'app-open': "app_install_6",
  'login-input': "login1_input",
  'login-passkey': "login1_passkey",
  'fingerprint-faceid': "login2_fingerprint_faceID",
  };

/** 실제 설치·인증을 실행하지 않는 안내용 화면이다. */
export default function NumPlateGuideExample({ scene }) {
  const description = descriptions[scene];
  const videoName = guideVideos[scene];
  if (!description || !videoName) return null;
  return (
    <figure className="numplate-guide-example numplate-guide-video">
      <figcaption>영상 확인해보세요!</figcaption>
      <video key={scene} className="numplate-guide-video-player" src={`/loginGuide/${videoName}.mp4`}
        controls autoPlay muted loop playsInline preload="metadata" aria-label={`안내 영상: ${description}`}>
        이 브라우저에서는 영상을 재생할 수 없습니다.
      </video>
    </figure>
  );
}
