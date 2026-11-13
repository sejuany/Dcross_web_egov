import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CircleHelp, Download, Fingerprint, Smartphone } from 'lucide-react';
import NumPlateGuideExample from './NumPlateGuideExample';
import ChromeBrowserNotice from '../common/ChromeBrowserNotice';

const STORAGE_KEY = 'numplateapp.login-guide-complete';
const topics = {
    install: {
    title: '휴대폰에 앱 설치하기', icon: Download, summary: '설치 과정을 영상으로 확인해 보세요.',
    steps: [
      { scene: 'browser-confirm', title: '브라우저 확인', description: ['web.dcross.kr/numplateapp/login을 열었을때 다음과 같이 팝업이 뜨는지 확인해주세요.','크롬브라우저 열기 버튼을 눌러주세요.','Chrome 아이콘을 선택하여 실행해주세요.'], hint: 'Chrome 브라우저에 최적화 되으므로 반드시 따라주세요.' },
      { scene: 'browser-menu', title: '브라우저 메뉴를 열어 주세요', description: ['브라우저 우측 상단 점 3개를 클릭해주세요.'], hint: '브라우저 메뉴 이름이나 위치는 Chrome 버전에 따라 조금 다를 수 있어요.' },
      { scene: 'browser-scroll', title: '설치 메뉴를 찾아 주세요', description: ['메뉴를 스크롤 해주세요.', '[설치 및 바로가기 만들기]를 클릭해주세요.'], hint: '메뉴 이름이나 위치는 Chrome 버전에 따라 조금 다를 수 있어요.' },
      { scene: 'install-choice', title: '설치를 선택하고 확인해 주세요', description: ['첫번째 항목인 "설치" 를 클릭해주세요.', '이 후 나타난 팝업창에서 "설치"를 클릭해주세요.'], hint: '설치 메뉴가 없으면 이미 설치했는지 확인해 주세요.' },
      { scene: 'home-icon', title: '생성된 앱 아이콘을 확인해 주세요', description: ['설치가 완료되면 홈버튼을 눌러 메뉴화면으로 이동해주세요.', '기존 앱과 같이 아이콘이 생성되었습니다!'], hint: '휴대폰 홈 화면이나 앱 목록에서 DACOS 번호판 아이콘을 찾아 주세요.' },
      { scene: 'app-open', title: '아이콘을 눌러 앱을 실행해 주세요', description: ['아이콘을 클릭하여 앱을 실행시켜주세요.', '앱 설치 완료!'], hint: '다음부터는 이 아이콘을 눌러 번호판 앱을 이용하시면 돼요.' },
    ],
  },
  login: {
    title: '로그인 따라하기', icon: Smartphone, summary: '정보 입력과 패스키 생성을 영상으로 확인해 보세요.',
    steps: [
      { scene: 'login-input', title: '로그인 정보 입력', description: ['아이디, 패스워드를 입력해주세요.', '자동로그인을 클릭하시면 최대 30일 로그인 없이 이용 가능합니다.', '로그인 버튼을 눌러주세요.'], hint: '아이디는 등록된 휴대폰 번호예요. 자동로그인은 화면의 「로그인 상태 유지」를 선택하면 돼요. 로그아웃하거나 서버 세션이 종료되면 30일 이전에도 다시 로그인해야 해요.' },
      { scene: 'login-passkey', title: '로그인 패스키 생성', description: ['패스키 만들기 창이 뜨면 계속 버튼을 눌러주세요.', '처리목록 화면에 [비밀번호를 저장하시겠습니까?] 팝업이 나타났을때 저장을 누르시면 이후 로그인시 아이디/비밀번호 입력 없이 편하게 로그인 가능합니다.'], hint: '비밀번호 저장은 다음 입력을 도와주는 기능이며, 지문·얼굴로 로그인하는 패스키와는 달라요. 안내 창이 나오지 않아도 직접 입력하여 로그인할 수 있어요.' },
    ],
  },
  passkey: {
    title: '지문·얼굴로 로그인하기', icon: Fingerprint, summary: 'Face ID·지문으로 로그인하는 과정을 영상으로 확인해 보세요.',
    steps: [
      { scene: 'fingerprint-faceid', title: '지문·얼굴로 로그인하기', description: ['[Face ID·지문으로 로그인] 버튼을 클릭해주세요', '등록된 패스키를 선택하여 [계속] 버튼을 눌러주세요', 'Face ID·지문인식을 진행해주세요.', '로그인 완료'], hint: '등록된 패스키가 있어야 사용할 수 있어요. 패스키가 없거나 지원하지 않는 환경에서는 휴대폰 번호와 비밀번호로 로그인해 주세요.' },
    ],
  },
};

export default function NumPlateLoginGuide({ disabled = false, onGuideChange }) {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) !== 'true';
    } catch {
      return true;
    }
  });
  const [topic, setTopic] = useState(null);
  const [step, setStep] = useState(0);
  const dialogRef = useRef(null);
  const headingRef = useRef(null);
  const currentTopic = topics[topic];
  const current = currentTopic?.steps[step];
  const last = currentTopic && step === currentTopic.steps.length - 1;

  useLayoutEffect(() => {
    onGuideChange?.(open);
  }, [open, onGuideChange]);

  useEffect(() => () => onGuideChange?.(false), [onGuideChange]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    headingRef.current?.focus();
  }, [open, topic, step]);

  const finish = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // shortcut: 저장소 차단 시 다음 방문에 다시 표시되며, 기기 간 보장이 필요하면 서버에 저장한다.
    }
    setOpen(false);
    setTopic(null);
    setStep(0);
  }, []);

  const chooseTopic = (value) => {
    setTopic(value);
    setStep(0);
  };

  const header = (
    <header className="numplate-guide-header">
      <span>DACOS <span>· 처음 사용 안내</span></span>
      <button type="button" className="numplate-guide-skip" onClick={finish}>건너뛰기</button>
    </header>
  );
  const content = (
    <>
      {header}
      <div className="numplate-guide-body">
        {(!topic || topic === 'install') && <ChromeBrowserNotice inline />}
        {currentTopic ? (
          <>
            <p className="numplate-guide-step">{currentTopic.title} <span>{step + 1} / {currentTopic.steps.length}단계</span></p>
            <h2 id="numplate-guide-title" ref={headingRef} tabIndex={-1}>
              {current.title}
            </h2>
            {Array.isArray(current.description) ? (
              <ol id="numplate-guide-description" className="numplate-guide-description numplate-guide-instructions">
                {current.description.map((instruction) => <li key={instruction}>{instruction}</li>)}
              </ol>
            ) : <p id="numplate-guide-description" className="numplate-guide-description">{current.description}</p>}
            {current.scene && <NumPlateGuideExample scene={current.scene} />}
            <p className="numplate-guide-hint">{current.hint}</p>
            <div className="numplate-guide-progress" aria-hidden="true">
              {currentTopic.steps.map((item, index) => <span key={item.title} className={index <= step ? 'complete' : ''} />)}
            </div>
          </>
        ) : (
          <>
            <h2 id="numplate-guide-title" ref={headingRef} tabIndex={-1}>앱 설치 및 로그인 가이드</h2>
            <p id="numplate-guide-description" className="numplate-guide-description">처음이라면 「휴대폰에 앱 설치하기」부터 눌러 보세요.</p>
            <div className="numplate-guide-topics">
              {Object.entries(topics).map(([key, item]) => {
                const Icon = item.icon;
                return <button key={key} type="button" className="numplate-guide-topic" onClick={() => chooseTopic(key)}>
                  <Icon aria-hidden="true" /><span><strong>{item.title}</strong><small>{item.summary}</small></span><ArrowRight aria-hidden="true" />
                </button>;
              })}
            </div>
          </>
        )}
      </div>
      <footer className={`numplate-guide-actions${last ? ' is-last' : ''}`}>
        {currentTopic && step > 0 && <button type="button" className="numplate-guide-previous" onClick={() => setStep(step - 1)}><ArrowLeft aria-hidden="true" />이전</button>}
        {currentTopic && !last && <button type="button" className="numplate-guide-next" onClick={() => setStep(step + 1)}>다음<ArrowRight aria-hidden="true" /></button>}
        {last && <button type="button" className="numplate-guide-menu" onClick={() => setTopic(null)}>다른 안내 보기</button>}
        {(!currentTopic || last) && <button type="button" className="numplate-guide-next" onClick={finish}>안내 마치기</button>}
      </footer>
    </>
  );

  return (
    <>
      <button type="button" className="numplate-login-guide-button" disabled={disabled || open} aria-haspopup="dialog"
        onClick={() => { setTopic(null); setStep(0); setOpen(true); }}>
        <CircleHelp aria-hidden="true" />가이드 보기
      </button>
      {open && (
        <dialog ref={dialogRef} className="numplate-login-tutorial" aria-labelledby="numplate-guide-title"
          aria-describedby="numplate-guide-description" onCancel={(event) => { event.preventDefault(); finish(); }}>
          <div className="numplate-guide-content">{content}</div>
        </dialog>
      )}
    </>
  );
}
