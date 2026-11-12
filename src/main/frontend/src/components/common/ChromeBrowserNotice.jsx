import React, { useEffect, useId, useState } from 'react';

const NON_CHROME_ANDROID_RE = /SamsungBrowser|KAKAOTALK|NAVER|Whale|EdgA|OPR|Firefox|FxiOS|DaumApps|Instagram|FBAN|FBAV|Line|;\s*wv\)|Version\/\d/i;
const HELP_PARAM = 'chromeOpenHelp';

const isAndroidNonChrome = () => {
  const ua = navigator.userAgent || '';
  if (!/Android/i.test(ua)) return false;
  if (window.matchMedia?.('(display-mode: standalone)')?.matches) return false;
  return !/Chrome\//i.test(ua) || NON_CHROME_ANDROID_RE.test(ua);
};

export default function ChromeBrowserNotice({ inline = false, location = window.location }) {
  const fallbackHelp = new URLSearchParams(location.search).get(HELP_PARAM) === '1';
  const [dismissed, setDismissed] = useState(false);
  const [helpOpen, setHelpOpen] = useState(fallbackHelp);
  const [copyMessage, setCopyMessage] = useState('');
  const helpId = useId();

  useEffect(() => {
    if (fallbackHelp) setHelpOpen(true);
  }, [fallbackHelp]);

  if (dismissed || !isAndroidNonChrome()) return null;

  const targetUrl = new URL(window.location.origin);
  targetUrl.pathname = location.pathname;
  targetUrl.search = location.search || '';
  targetUrl.hash = location.hash || '';
  if (targetUrl.searchParams.has(HELP_PARAM)) targetUrl.searchParams.delete(HELP_PARAM);
  const fallbackUrl = new URL(targetUrl);
  fallbackUrl.searchParams.set(HELP_PARAM, '1');
  const intentUrl = `intent://${targetUrl.host}${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}#Intent;scheme=${targetUrl.protocol.slice(0, -1)};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(fallbackUrl.href)};end`;

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(targetUrl.href);
      setCopyMessage('주소를 복사했습니다. Chrome 주소창에 붙여넣어 주세요.');
    } catch {
      setCopyMessage('아래 주소를 길게 눌러 복사한 뒤 Chrome 주소창에 붙여넣어 주세요.');
    }
  };

  return (
    <section className={inline ? 'chrome-open-inline' : 'chrome-open-banner'} aria-label="Chrome 브라우저 열기 안내">
      <div className="chrome-open-banner-actions">
        <a className="chrome-open-banner-link" href={intentUrl} onClick={() => setHelpOpen(true)}>
          Chrome 브라우저로 열기
        </a>
        <button type="button" className="chrome-open-banner-close" onClick={() => setDismissed(true)}>닫기</button>
      </div>
      <button type="button" className="chrome-open-help-toggle" aria-expanded={helpOpen} aria-controls={helpId}
        onClick={() => setHelpOpen(!helpOpen)}>Chrome이 열리지 않나요?</button>
      {helpOpen && (
        <div className="chrome-open-help" id={helpId}>
          <p>Chrome이 열리지 않으면 아래 방법으로 진행해 주세요.</p>
          <ol>
            <li>Chrome이 없다면 Play 스토어에서 「Google Chrome」을 검색해 설치해 주세요.</li>
            <li>메뉴에서 Chrome을 선택하여 실행해주세요.</li>
            <li>아래 주소를 복사하고, Chrome을 직접 열어 주소창에 붙여넣어 주세요.</li>
          </ol>
          <div className="chrome-open-copy">
            <input type="text" aria-label="Chrome에서 열 주소" value={targetUrl.href} readOnly onFocus={(event) => event.target.select()} />
            <button type="button" onClick={copyUrl}>주소 복사</button>
          </div>
          {copyMessage && <p role="status">{copyMessage}</p>}
        </div>
      )}
    </section>
  );
}
