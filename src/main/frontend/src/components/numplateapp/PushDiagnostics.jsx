import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { enablePushNotifications, firebaseProjectId, firebaseVapidConfigured, PUSH_RECEIVED_EVENT, pushStatus } from './firebasePush';

const permissionLabels = { default: '허용 전', granted: '허용됨', denied: '차단됨', unsupported: '사용 불가' };

export default function PushDiagnostics() {
  const [server, setServer] = useState(null);
  const [permission, setPermission] = useState(pushStatus());
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const [received, setReceived] = useState('');

  const loadStatus = useCallback(async () => {
    try {
      const { data } = await axios.get('/api/numplateapp/push/status');
      setServer(data.data);
    } catch (failure) {
      setError(failure.response?.data?.message || '서버의 푸시 상태를 불러오지 못했습니다.');
    }
  }, []);

  useEffect(() => {
    loadStatus();
    const onReceived = (event) => setReceived(`${new Date().toLocaleTimeString('ko-KR')} · ${event.detail?.notification?.title || '새 알림'}`);
    const onVisible = () => { if (document.visibilityState === 'visible') setPermission(pushStatus()); };
    window.addEventListener(PUSH_RECEIVED_EVENT, onReceived);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener(PUSH_RECEIVED_EVENT, onReceived);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [loadStatus]);

  const register = async () => {
    setBusy(true);
    setError('');
    setResult('');
    try {
      setToken(await enablePushNotifications());
      setResult('현재 기기를 등록했습니다. 이제 테스트 알림을 보낼 수 있습니다.');
      await loadStatus();
    } catch (failure) {
      setToken('');
      setError(failure.response?.data?.message || failure.message || '기기를 등록하지 못했습니다.');
    } finally {
      setPermission(pushStatus());
      setBusy(false);
    }
  };

  const send = async () => {
    setBusy(true);
    setError('');
    setResult('');
    setReceived('');
    try {
      const { data } = await axios.post('/api/numplateapp/push/test', { token });
      const response = data.data;
      setResult(response.pushSent
        ? 'FCM이 발송 요청을 접수했습니다. 앱 상단 안내와 휴대폰 시스템 알림을 확인해 주세요. 알림센터 이력도 저장했습니다.'
        : `알림센터 이력은 저장했지만 FCM 발송에 실패했습니다. 오류 코드: ${response.resultCode}`);
      await loadStatus();
    } catch (failure) {
      setError(failure.response?.data?.message || '테스트 알림을 보내지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const projectMatches = server?.projectId === firebaseProjectId;

  return (
    <section className="numplate-process-page">
      <div className="numplate-page-title">
        <div><h1>푸시 테스트</h1><span>현재 로그인한 매니저의 기기로 테스트합니다.</span></div>
        <button type="button" onClick={loadStatus} disabled={busy}>상태 확인</button>
      </div>
      <div className="numplate-detail-grid">
        <div><span>현재 접속 환경</span><strong>{window.isSecureContext ? '보안 연결 사용 가능' : 'HTTP · HTTPS 접속 필요'}</strong></div>
        <div><span>브라우저 알림 권한</span><strong>{permissionLabels[permission]}</strong></div>
        <div><span>Firebase 서버 초기화</span><strong>{!server ? '확인 중' : !server.enabled ? '푸시 비활성화됨' : server.firebaseReady ? '준비됨' : '서비스 계정 설정 확인 필요'}</strong></div>
        <div><span>서버에 저장된 기기 토큰</span><strong>{!server ? '확인 중' : server.tokenRegistered ? '등록됨' : '미등록'}</strong></div>
        <div><span>웹 / 서버 프로젝트</span><strong>{firebaseProjectId} / {server?.projectId || '확인 중'}</strong></div>
        <div><span>알림 클릭 시 접속할 서버</span><strong>{server?.publicBaseUrl || '확인 중'}</strong></div>
      </div>
      {server && !projectMatches && <p className="numplate-inline-message" role="alert">웹 설정과 서버의 Firebase 프로젝트가 다릅니다. 같은 프로젝트의 설정을 사용해 주세요.</p>}
      {!firebaseVapidConfigured && <p className="numplate-inline-message" role="alert">dcross-web 프로젝트의 VAPID 공개 키를 설정해야 기기를 등록할 수 있습니다.</p>}
      <div className="numplate-request-form">
        <p>① 알림을 허용하고 현재 기기를 등록한 뒤 ② 테스트 알림을 보내세요. 테스트 발송은 30초 간격으로 가능합니다.</p>
        <button type="button" className="numplate-primary-button" onClick={register} disabled={busy || !firebaseVapidConfigured || permission === 'unsupported' || permission === 'denied'}>① 알림 허용 · 현재 기기 등록</button>
        <button type="button" className="numplate-primary-button" onClick={send} disabled={busy || !token || permission !== 'granted' || !server?.firebaseReady || !projectMatches}>② 내 기기로 테스트 보내기</button>
        {busy && <p role="status">처리 중입니다…</p>}
        {error && <p className="numplate-inline-message" role="alert">{error}</p>}
        {result && <p className="numplate-push-result" role="status">{result}</p>}
        <p role="status">이 화면에서 마지막으로 수신한 알림: {received || '아직 없음'}</p>
        <Link className="numplate-push-link" to="/numplateapp/notifications">③ 알림센터에서 이력 확인</Link>
        {token && (
          <details>
            <summary>Firebase 콘솔 테스트용 현재 기기 토큰</summary>
            <label><span>FCM 등록 토큰</span><textarea readOnly rows={3} value={token} onFocus={(event) => event.target.select()} /></label>
            <p>Firebase 콘솔의 테스트 메시지 수신자로 사용하세요. 토큰은 다른 사람에게 공유하지 마세요.</p>
          </details>
        )}
      </div>
      <div className="numplate-status-section">
        <h2>수신 확인 방법</h2>
        <p>앱을 열어둔 상태에서도 떠 있는 알림 카드와 휴대폰 시스템 알림을 함께 표시합니다. 카드는 화면을 밀지 않고 헤더 아래에 나타나며 7초 후 자동으로 닫힙니다.</p>
        <p>카드를 좌우 또는 위로 밀면 닫히고, 본문을 누르면 알림목록으로 이동합니다. 알림센터를 보고 있으면 목록도 자동으로 갱신됩니다.</p>
        <p>시스템 알림을 누르면 해당 업무 상세로 이동하고, 업무가 없는 테스트 알림은 알림센터로 이동합니다.</p>
        <p>갤럭시에서 상단 팝업이 보이지 않으면 휴대폰 알림창의 해당 알림을 길게 눌러 알림 설정을 여세요. 해당 앱 또는 Chrome 사이트의 알림 카테고리에서 팝업 허용, 소리 및 방해금지 설정을 확인해 주세요. 메뉴 이름은 기기 버전에 따라 다를 수 있습니다.</p>
        <p>상단 팝업과 소리·진동은 휴대폰 및 브라우저 설정에 따라 달라집니다. 시스템 알림을 표시할 수 없는 경우에도 화면 상단 안내는 유지됩니다.</p>
        <p>백그라운드 알림은 기기를 등록한 뒤 다른 앱으로 전환하고, PC의 Firebase 콘솔에서 위 토큰으로 테스트 메시지를 보내 확인하세요.</p>
        <p>Firebase 콘솔에서 직접 보낸 알림은 이 서버의 알림센터 이력에 저장되지 않습니다. 알림센터까지 확인하려면 위의 테스트 보내기를 사용하세요.</p>
        {permission === 'denied' && <p>브라우저의 사이트 설정에서 알림을 허용한 후 이 화면으로 돌아오세요.</p>}
        <p>갤럭시는 HTTPS 주소로 접속하세요. iPhone은 홈 화면에 추가한 앱에서 알림을 허용해야 합니다.</p>
      </div>
    </section>
  );
}
