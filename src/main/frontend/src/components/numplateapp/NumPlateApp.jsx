import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Bell, ClipboardList, PackageCheck, UserRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import NumPlateSimpleList from './NumPlateSimpleList';
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

export default function NumPlateApp() {
  const { user, logout } = useAuth();

  return (
    <main className="numplate-app-shell">
      <header className="numplate-app-header">
        <div>
          <strong>DACOS</strong>
          <span>{user?.member_NM || user?.MEMBER_NM || user?.login_ID || user?.LOGIN_ID}님</span>
        </div>
        <button type="button" onClick={() => logout()}>로그아웃</button>
      </header>
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
