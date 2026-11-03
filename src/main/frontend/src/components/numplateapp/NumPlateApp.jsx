import React, { useEffect, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { Bell, BellRing, ClipboardList, PackageCheck, UserRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import NumPlateSimpleList from './NumPlateSimpleList';
import { enablePushNotifications, pushStatus, PUSH_RECEIVED_EVENT, subscribeToPushMessages } from './firebasePush';
import './NumPlateApp.css';

// 모든 인증 화면 하단에 고정되는 모바일 주 메뉴.
const bottomMenus = [
  { to: '/numplateapp', label: '처리목록', icon: ClipboardList, end: true },
  { to: '/numplateapp/returns', label: '반납목록', icon: PackageCheck },
  { to: '/numplateapp/notifications', label: '알림센터', icon: Bell },
  { to: '/numplateapp/mypage', label: '마이페이지', icon: UserRound },
];

const columns = [
  { headerName: '차량번호', field: 'CAR_NO', minWidth: 120 },
  { headerName: '번호판 종류', field: 'NUM_KIND', minWidth: 110 },
  { headerName: '사용 상태', field: 'USE_YN', minWidth: 90 },
  { headerName: '처리 상태', field: 'PROC_ST', minWidth: 100 },
  { headerName: '접수번호', field: 'SERVICE_ID', minWidth: 140 },
  { headerName: '제작일', field: 'MAKE_DT', minWidth: 110 },
];

export function NumPlateInventory() {
  return (
    <NumPlateSimpleList
      mobile
      title="번호판 조회"
      endpoint="/api/numplate/list"
      columns={columns}
    />
  );
}

function PushPermissionButton() {
  const [status, setStatus] = useState(pushStatus());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status !== 'granted') return;
    // 이미 허용한 사용자는 로그인할 때 토큰 갱신만 수행하며 권한 창은 다시 띄우지 않는다.
    enablePushNotifications({ requestPermission: false }).catch(() => setStatus('error'));
  }, [status]);

  const enable = async () => {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (ios && !standalone) {
      window.alert('iPhone에서는 먼저 공유 메뉴에서 홈 화면에 추가한 뒤 설치된 앱에서 알림을 켜 주세요.');
      return;
    }
    setBusy(true);
    try {
      await enablePushNotifications();
      setStatus('granted');
    } catch (error) {
      setStatus(pushStatus() === 'denied' ? 'denied' : 'error');
      window.alert(error.message || '알림을 설정하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const label = status === 'granted' ? '알림 켜짐'
    : status === 'denied' ? '알림 차단됨'
      : status === 'unsupported' ? '알림 미지원' : '알림 켜기';

  return (
    <button type="button" className="numplate-push-button" onClick={enable}
      disabled={busy || status === 'granted' || status === 'denied' || status === 'unsupported'}>
      <BellRing aria-hidden="true" />{busy ? '설정 중' : label}
    </button>
  );
}

export default function NumPlateApp() {
  const { user, logout } = useAuth();
  const [pushNotice, setPushNotice] = useState(null);

  useEffect(() => {
    let disposed = false;
    let unsubscribe;
    subscribeToPushMessages((payload) => {
      setPushNotice(payload.notification || { title: '새 알림', body: '알림센터에서 확인해 주세요.' });
      window.dispatchEvent(new CustomEvent(PUSH_RECEIVED_EVENT, { detail: payload }));
    }).then((stop) => {
      if (disposed) stop();
      else unsubscribe = stop;
    }).catch(() => setPushNotice({ title: '알림 수신 연결 실패', body: '알림센터의 푸시 테스트에서 설정을 확인해 주세요.' }));
    return () => { disposed = true; unsubscribe?.(); };
  }, []);

  return (
    <main className="numplate-app-shell">
      <header className="numplate-app-header">
        <div>
          <strong>DACOS</strong>
          <span>{user?.member_NM || user?.MEMBER_NM || user?.login_ID || user?.LOGIN_ID}님</span>
        </div>
        <div className="numplate-header-actions">
          <PushPermissionButton />
          <button type="button" onClick={() => logout()}>로그아웃</button>
        </div>
      </header>
      {pushNotice && (
        <div className="numplate-push-notice" role="status">
          <Link to="/numplateapp/notifications" onClick={() => setPushNotice(null)}>
            <strong>{pushNotice.title}</strong><span>{pushNotice.body}</span>
          </Link>
          <button type="button" onClick={() => setPushNotice(null)} aria-label="알림 닫기">닫기</button>
        </div>
      )}
      {/* 현재 하위 라우트의 목록·상세·결과 화면이 이 위치에 렌더링된다. */}
      <Outlet />
      <nav className="numplate-app-nav" aria-label="번호판 앱 메뉴">
        {bottomMenus.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} end={end} to={to}>
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </main>
  );
}
