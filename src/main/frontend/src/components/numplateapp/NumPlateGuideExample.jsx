import React from 'react';
import { ArrowDown, ArrowRight, Download, Fingerprint, Globe, KeyRound, MoreVertical, ShieldCheck } from 'lucide-react';

const descriptions = {
  'browser-menu': 'Chrome 오른쪽 위 점 세 개 메뉴를 여는 위치입니다.',
  'browser-scroll': '메뉴를 아래로 내려 설치 및 바로가기 만들기를 찾습니다.',
  'install-choice': '바로가기 만들기 위에 있는 설치를 선택합니다.',
  'install-confirm': 'DACOS 번호판 앱 이름을 확인하고 설치를 선택합니다.',
  'home-icon': '휴대폰 홈 화면에 생긴 DACOS 번호판 아이콘을 선택합니다.',
  'login-button': '입력을 마친 다음 파란색 로그인 버튼을 선택합니다.',
  'process-list': '로그인하면 배정받은 번호판 업무의 처리목록이 보입니다.',
  'password-save': '비밀번호 저장 안내에서 저장을 선택하는 위치입니다.',
  'password-fill': '저장된 예시 매니저 계정을 선택하면 로그인 정보가 채워집니다.',
  'passkey-create': '패스키 만들기 안내에서 계속을 선택합니다.',
  'device-unlock': '휴대폰의 지문이나 화면 잠금 PIN으로 본인을 확인합니다.',
  'passkey-use': '저장된 패스키를 확인한 다음 계속을 선택합니다.',
  'passkey-missing': '저장된 패스키가 없으면 확인을 누른 뒤 비밀번호로 로그인합니다.',
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
    case 'browser-menu':
      return <>
        <div className="numplate-example-browser-bar">
          <Globe /><span>web.dcross.kr<small>/numplateapp/login</small></span>
          <Target><MoreVertical /></Target>
        </div>
        <div className="numplate-example-login"><AppIcon /><strong>DACOS 번호판</strong><span className="numplate-example-line" /><span className="numplate-example-line" /></div>
      </>;
    case 'browser-scroll':
      return <div className="numplate-example-menu">
        <span>새 탭</span><span>기록</span><span>다운로드</span>
        <div className="numplate-example-scroll-cue"><ArrowDown />아래로 내려 찾기</div>
        <Target number={2}><Download /><strong>설치 및 바로가기 만들기</strong></Target>
      </div>;
    case 'install-choice':
      return <div className="numplate-example-menu">
        <strong>설치 및 바로가기 만들기</strong>
        <Target number={3}><AppIcon /><div><strong>설치</strong><span>휴대폰에 앱으로 설치</span></div></Target>
        <div className="numplate-example-menu-row"><Globe /><div><strong>바로가기 만들기</strong><span>Chrome에서 열기</span></div></div>
      </div>;
    case 'install-confirm':
      return <div className="numplate-example-system-card">
        <div className="numplate-example-app-name"><AppIcon /><div><strong>DACOS 번호판</strong><span>앱을 설치할까요?</span></div></div>
        <div className="numplate-example-dialog-actions"><span>취소</span><Target number={4} className="numplate-example-primary">설치</Target></div>
      </div>;
    case 'home-icon':
      return <div className="numplate-example-home">
        <span className="numplate-example-home-label">휴대폰 홈 화면</span>
        <Target number={5}><AppIcon /><strong>DACOS 번호판</strong></Target>
        <div className="numplate-example-home-dots"><i /><i /><i /></div>
      </div>;
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
  return (
    <figure className={`numplate-guide-example numplate-example-${scene}`} role="img" aria-label={`예시 화면: ${description}`}>
      <figcaption>예시 화면</figcaption>
      <div className="numplate-example-screen" aria-hidden="true"><ExampleScene scene={scene} /></div>
      <p className="numplate-example-caption" aria-hidden="true">{description}</p>
    </figure>
  );
}
