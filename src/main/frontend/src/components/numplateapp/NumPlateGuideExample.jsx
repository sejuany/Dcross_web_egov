import React from 'react';
import { ArrowRight, Fingerprint, KeyRound, ShieldCheck } from 'lucide-react';

const descriptions = {
  'browser-confirm': 'Chrome 브라우저로 진입합니다.',
  'browser-menu': 'Chrome 오른쪽 위 점 세 개 메뉴를 여는 위치입니다.',
  'browser-scroll': '메뉴를 아래로 내려 설치 및 바로가기 만들기를 찾습니다.',
  'install-choice': '첫 번째 설치 항목과 이어서 나타나는 팝업창의 설치를 선택합니다.',
  'home-icon': '설치가 끝나면 홈 버튼을 눌러 생성된 DACOS 번호판 아이콘을 확인합니다.',
  'app-open': 'DACOS 번호판 아이콘을 눌러 설치한 앱을 실행합니다.',
  'login-button': '입력을 마친 다음 파란색 로그인 버튼을 선택합니다.',
  'process-list': '로그인하면 배정받은 번호판 업무의 처리목록이 보입니다.',
  'password-save': '비밀번호 저장 안내에서 저장을 선택하는 위치입니다.',
  'password-fill': '저장된 예시 매니저 계정을 선택하면 로그인 정보가 채워집니다.',
  'passkey-create': '패스키 만들기 안내에서 계속을 선택합니다.',
  'device-unlock': '휴대폰의 지문이나 화면 잠금 PIN으로 본인을 확인합니다.',
  'passkey-use': '저장된 패스키를 확인한 다음 계속을 선택합니다.',
  'passkey-missing': '저장된 패스키가 없으면 확인을 누른 뒤 비밀번호로 로그인합니다.',
};

const installVideos = {
  'browser-confirm': "app_install_1_samsung_browser_guide",
  'browser-menu': "app_install_2",
  'browser-scroll': "app_install_3",
  'install-choice': "app_install_4",
  'home-icon': "app_install_5",
  'app-open': "app_install_6",
  'login-input': "login1_input",
  'login-passkey': "login1_passkey",
  

};

const AppIcon = () => <img className="numplate-example-app-icon" src="/dacos_white_only_logo192.png" alt="" />;

const Target = ({ children, number = 1, className = '' }) => (
  <div className={`numplate-example-target ${className}`}>
    <span className="numplate-example-number">{number}</span>{children}
  </div>
);

const SavedAccount = () => (
  <div className="numplate-example-account">
    <KeyRound /><div><strong>예시 매니저</strong><span>01000000000</span><span>●●●●</span></div>
  </div>
);

function ExampleScene({ scene }) {
  switch (scene) {
    case 'login-button':
      return <div className="numplate-example-login">
        <strong>DACOS 번호판</strong><span className="numplate-example-field">01000000000</span><span className="numplate-example-field">●●●●</span>
        <Target className="numplate-example-primary">로그인</Target>
      </div>;
    case 'process-list':
      return <div className="numplate-example-process">
        <div className="numplate-example-process-header"><strong>DACOS</strong><span>예시 매니저</span></div>
        <div className="numplate-example-tabs"><strong>전체</strong><span>탈부착</span><span>배송</span></div>
        <div className="numplate-example-process-card"><strong>12가0000</strong><span>연습용 차량 · 예시 고객</span><span>방문장소　예시 장소</span></div>
      </div>;
    case 'password-save':
      return <div className="numplate-example-system-card">
        <KeyRound className="numplate-example-key" /><strong>비밀번호를 저장할까요?</strong>
        <SavedAccount />
        <div className="numplate-example-dialog-actions"><span>나중에</span><Target className="numplate-example-primary">저장</Target></div>
      </div>;
    case 'password-fill':
      return <div className="numplate-example-system-card">
        <strong>저장된 비밀번호</strong><span>사용할 계정을 선택하세요</span><Target><SavedAccount /></Target>
      </div>;
    case 'passkey-create':
      return <div className="numplate-example-system-card">
        <ShieldCheck className="numplate-example-key" /><strong>패스키 만들기</strong>
        <div className="numplate-example-app-name"><AppIcon /><span>DACOS 번호판</span></div>
        <span>휴대폰 화면 잠금으로<br />안전하게 로그인해요</span>
        <Target className="numplate-example-primary">계속</Target>
      </div>;
    case 'device-unlock':
      return <div className="numplate-example-unlock">
        <div className="numplate-example-fingerprint"><Fingerprint /></div><strong>휴대폰에서 본인 확인</strong>
        <span>지문 또는 화면 잠금 PIN</span><div className="numplate-example-pin">●　●　●　●</div>
      </div>;
    case 'passkey-use':
      return <div className="numplate-example-system-card">
        <KeyRound className="numplate-example-key" /><strong>저장된 패스키 사용</strong><SavedAccount />
        <Target className="numplate-example-primary">계속</Target>
      </div>;
    case 'passkey-missing':
      return <div className="numplate-example-system-card">
        <KeyRound className="numplate-example-key" /><strong>저장된 패스키가 없어요</strong><Target className="numplate-example-primary">확인</Target>
        <div className="numplate-example-follow"><ArrowRight />비밀번호로 로그인하기</div>
      </div>;
    default:
      return null;
  }
}

/** 실제 설치·인증을 실행하지 않는 안내용 화면이다. */
export default function NumPlateGuideExample({ scene }) {
  const description = descriptions[scene];
  if (!description) return null;
  const videoName = installVideos[scene];
  if (videoName) {
    return (
      <figure className="numplate-guide-example numplate-guide-video">
        <figcaption>영상 확인해보세요!</figcaption>
        <video key={scene} className="numplate-guide-video-player" src={`/loginGuide/${videoName}.mp4`}
          controls autoPlay muted loop playsInline preload="metadata" aria-label={`앱 설치 안내 영상: ${description}`}>
          이 브라우저에서는 영상을 재생할 수 없습니다.
        </video>
        {/* <p className="numplate-example-caption">영상 아래의 재생 버튼으로 멈추거나 다시 볼 수 있어요. 실제 설치는 휴대폰의 Chrome에서 진행해 주세요.</p> */}
      </figure>
    );
  }
  return (
    <figure className={`numplate-guide-example numplate-example-${scene}`} role="img" aria-label={`예시 화면: ${description}`}>
      <figcaption>예시 화면</figcaption>
      <div className="numplate-example-screen" aria-hidden="true"><ExampleScene scene={scene} /></div>
      <p className="numplate-example-caption" aria-hidden="true">{description}</p>
    </figure>
  );
}
