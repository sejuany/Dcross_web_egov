import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, CircleHelp, Download, Fingerprint, Smartphone } from 'lucide-react';
import NumPlateGuideExample from './NumPlateGuideExample';

const STORAGE_KEY = 'numplateapp.login-guide-complete';
const topics = {
  login: {
    title: '로그인 따라하기', icon: Smartphone, summary: '예시 번호로 직접 눌러 보며 배워요.',
    steps: [
      { target: 'phone', title: '휴대폰 번호 칸을 눌러 주세요', description: '숫자 키패드가 열리면 번호를 입력해 보세요. 연습에서는 01000000000을 사용해요.', hint: '어려우시면 「예시 넣기」를 눌러 주세요. 실제 로그인할 때는 등록된 내 휴대폰 번호를 입력해요.' },
      { target: 'password', title: '숫자 비밀번호를 입력해 보세요', description: '비밀번호 칸을 누르면 숫자 키패드가 열려요. 연습 비밀번호 1234를 입력해 보세요.', hint: '입력한 숫자는 점으로 가려져요. 1234는 연습용이며, 실제 로그인할 때는 안내받은 내 비밀번호를 입력해요.' },
      { target: 'remember', title: '로그인 상태 유지를 눌러 보세요', description: '작은 네모를 누르면 체크 표시가 생겨요. 한 번 더 누르면 체크가 해제돼요.', hint: '내 기기에서 선택하면 최대 30일간 유지돼요. 로그아웃하거나 서버 세션이 끝나면 다시 로그인해 주세요.' },
      { target: 'login', scene: 'login-button', title: '파란색 로그인 버튼을 눌러 보세요', description: '연습 버튼을 눌러 로그인 뒤에 보이는 처리목록 예시를 확인해 보세요.', hint: '실제로 로그인되거나 고객의 업무가 조회되지는 않아요.' },
      { scene: 'password-save', title: '비밀번호 저장 창이 나오면', description: '내 휴대폰에서 다음에도 편하게 입력하려면 「저장」을 누를 수 있어요.', hint: '저장은 선택이에요. 창이 안 나와도 직접 입력하면 돼요. 지문·얼굴로 로그인하는 패스키와는 다른 기능이에요.' },
      { scene: 'password-fill', title: '저장된 내 번호를 선택해 주세요', description: '다음 방문에 저장된 번호가 보이면 내 휴대폰 번호를 선택해요. 입력된 번호를 확인하고 로그인해 주세요.', hint: '저장된 정보가 없거나 여러 개라 헷갈리면 창을 닫고 내 번호와 비밀번호를 직접 입력해도 돼요.' },
    ],
  },
  install: {
    title: '휴대폰에 앱 설치하기', icon: Download, summary: '홈 화면에 DACOS 아이콘을 만들어요.',
    steps: [
      { scene: 'browser-menu', title: '크롬 오른쪽 위 점 세 개를 눌러요', description: '크롬에서 번호판 로그인 화면을 열고, 주소창 옆의 점 세 개 메뉴를 눌러 주세요.', hint: '주소는 web.dcross.kr/numplateapp/login이에요. 이 안내의 그림은 설치 연습용이에요.' },
      { scene: 'browser-scroll', title: '메뉴를 아래쪽까지 내려 보세요', description: '펼쳐진 메뉴를 아래로 내려 「설치 및 바로가기 만들기」를 찾아 눌러 주세요.', hint: '메뉴 이름이나 위치는 크롬 버전에 따라 조금 다를 수 있어요.' },
      { scene: 'install-choice', title: '「설치」를 선택해 주세요', description: '「설치」와 「바로가기 만들기」가 함께 보이면 「설치」를 눌러 주세요.', hint: '이 그림을 눌러도 앱이 설치되지는 않아요. 실제 크롬 메뉴에서 진행해야 해요.' },
      { scene: 'install-confirm', title: '앱 이름을 확인하고 설치해요', description: 'DACOS 번호판 업무가 맞는지 확인한 뒤, 설치 확인창의 「설치」를 눌러 주세요.', hint: '설치 메뉴가 없으면 이미 설치했는지 확인해 주세요. 설치하지 않고 크롬에서 이용할 수도 있어요.' },
      { scene: 'home-icon', title: '홈 화면의 DACOS 아이콘을 눌러요', description: '설치한 뒤에는 휴대폰 홈 화면이나 앱 목록의 DACOS 번호판 아이콘으로 열 수 있어요.', hint: '여기까지는 설치 방법 안내예요. 실제 설치가 완료됐다는 뜻은 아니에요.' },
    ],
  },
  passkey: {
    title: '지문·얼굴로 로그인하기', icon: Fingerprint, summary: '패스키 등록부터 다음 로그인까지 알아봐요.',
    steps: [
      { scene: 'passkey-create', title: '패스키 만들기에서 계속을 눌러요', description: '지원되는 휴대폰에서 처음 비밀번호로 로그인하면 패스키 등록을 안내해 드려요. 「계속」을 눌러 주세요.', hint: '패스키는 비밀번호 대신 기기의 지문·얼굴·화면 잠금으로 확인하는 방법이에요. 등록은 건너뛸 수 있어요.' },
      { scene: 'device-unlock', title: '휴대폰에서 본인 확인을 해 주세요', description: '휴대폰이 안내하는 지문·얼굴 또는 화면 잠금 번호로 확인해 주세요.', hint: '여기는 예시 그림이에요. 실제 지문이나 잠금 번호를 입력받거나 저장하지 않아요.' },
      { scene: 'passkey-use', title: '다음에는 생체 로그인 버튼을 눌러요', description: '「Face ID·지문으로 로그인」을 누른 뒤, 저장된 패스키 창에서 「계속」을 누르고 기기에서 확인해 주세요.', hint: '번호와 비밀번호를 직접 입력하지 않고 로그인할 수 있어요. 지원하지 않는 환경에서는 버튼이 없을 수 있어요.' },
      { scene: 'passkey-missing', title: '패스키 없음이 나오면 괜찮아요', description: '「확인」을 눌러 창을 닫고, 내 휴대폰 번호와 비밀번호를 입력해 로그인해 주세요.', hint: '기기를 바꾸었거나 패스키를 등록하지 않았을 때 나타날 수 있어요. 계속 반복해서 누르지 않아도 돼요.' },
    ],
  },
};

export default function NumPlateLoginGuide({
  disabled = false, targets, onGuideChange, onFillExample, onResetPractice, loginPreview = false,
}) {
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
  const target = open && current?.target && !(current.target === 'login' && loginPreview) ? current.target : null;
  const modalOpen = open && !target;
  const last = currentTopic && step === currentTopic.steps.length - 1;

  useLayoutEffect(() => {
    onGuideChange?.({ active: open, target });
  }, [open, target, onGuideChange]);

  useEffect(() => () => onGuideChange?.({ active: false, target: null }), [onGuideChange]);

  useLayoutEffect(() => {
    if (!modalOpen) return undefined;
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [modalOpen]);

  useEffect(() => {
    if (!open) return;
    headingRef.current?.focus({ preventScroll: Boolean(target) });
    if (target) targets?.current[target]?.scrollIntoView?.({ block: 'start', behavior: 'auto' });
  }, [open, topic, step, target, targets]);

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

  useEffect(() => {
    if (!target) return undefined;
    const escape = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        finish();
      }
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [target, finish]);

  const chooseTopic = (value) => {
    onResetPractice?.();
    setTopic(value);
    setStep(0);
  };

  const header = (
    <header className="numplate-guide-header">
      <span>{target ? '로그인 연습' : <>DACOS <span>· 처음 사용 안내</span></>}</span>
      <button type="button" className="numplate-guide-skip" onClick={finish}>건너뛰기</button>
    </header>
  );
  const content = (
    <>
      {header}
      <div className="numplate-guide-body">
        <p className="numplate-guide-safety">연습 화면 · 실제 로그인되지 않습니다</p>
        {!target && <p className="numplate-guide-platform">설치·인증 예시는 갤럭시 · 안드로이드 크롬 기준이에요.</p>}
        {currentTopic ? (
          <>
            <p className="numplate-guide-step">{currentTopic.title} <span>{step + 1} / {currentTopic.steps.length}단계</span></p>
            <h2 id="numplate-guide-title" ref={headingRef} tabIndex={-1}>
              {current.target === 'login' && loginPreview ? '로그인하면 처리목록이 보여요' : current.title}
            </h2>
            <p id="numplate-guide-description" className="numplate-guide-description">{current.description}</p>
            {!target && current.scene && <NumPlateGuideExample scene={current.target === 'login' && loginPreview ? 'process-list' : current.scene} />}
            {(target === 'phone' || target === 'password') && (
              <button type="button" className="numplate-guide-fill" onClick={() => onFillExample?.(target)}>예시 넣기</button>
            )}
            <p className="numplate-guide-hint">{current.hint}</p>
            <div className="numplate-guide-progress" aria-hidden="true">
              {currentTopic.steps.map((item, index) => <span key={item.title} className={index <= step ? 'complete' : ''} />)}
            </div>
          </>
        ) : (
          <>
            <h2 id="numplate-guide-title" ref={headingRef} tabIndex={-1}>어떤 안내가 필요하세요?</h2>
            <p id="numplate-guide-description" className="numplate-guide-description">처음이라면 「로그인 따라하기」부터 눌러 보세요. 원하는 안내만 골라 볼 수도 있어요.</p>
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
  const slot = target && targets?.current[target]?.querySelector('[data-guide-coach]');

  return (
    <>
      <button type="button" className="numplate-login-guide-button" disabled={disabled || open} aria-haspopup="dialog"
        onClick={() => { setTopic(null); setStep(0); setOpen(true); }}>
        <CircleHelp aria-hidden="true" />가이드 보기
      </button>
      {modalOpen && (
        <dialog ref={dialogRef} className="numplate-login-tutorial" aria-labelledby="numplate-guide-title"
          aria-describedby="numplate-guide-description" onCancel={(event) => { event.preventDefault(); finish(); }}>
          <div className="numplate-guide-content">{content}</div>
        </dialog>
      )}
      {open && target && slot && createPortal(
        <section className="numplate-practice-coach" aria-labelledby="numplate-guide-title">{content}</section>, slot,
      )}
    </>
  );
}
