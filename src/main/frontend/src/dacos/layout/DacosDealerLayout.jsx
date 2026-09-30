import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LogOut, UserRound } from 'lucide-react';
import AppSwitcher from '../../components/common/AppSwitcher';
import { useAuth } from '../../context/AuthContext';
import { DACOS_DEALER_HOME_PATH } from '../auth/dacosRouting';
import '../../wa/styles/wa.css';

const getUserName = (user) => (
    user?.MEMBER_NM || user?.member_NM || user?.memberNm || '사용자'
);

const DacosDealerLayout = () => {
    const { user, logout } = useAuth();

    return (
        <div className="wa-shell">
            <header className="wa-topbar">
                <div className="wa-topbar-inner">
                    <AppSwitcher currentApp="dealer" logoSrc="/logo.png" logoClassName="dacos-dealer-logo" />

                    <nav className="wa-top-nav" aria-label="DACOS 딜러시스템 navigation">
                        <NavLink
                            to={DACOS_DEALER_HOME_PATH}
                            className={({ isActive }) => `wa-top-nav-link ${isActive ? 'active' : ''}`}
                        >
                            신규등록현황
                        </NavLink>
                    </nav>

                    <div className="wa-top-actions">
                        <span className="wa-user-chip">
                            <UserRound size={14} />
                            <strong>{getUserName(user)}</strong>
                        </span>
                        <button type="button" className="wa-logout-button" onClick={() => logout({ redirectTo: '/login' })}>
                            <LogOut size={14} />
                            <span>로그아웃</span>
                        </button>
                    </div>
                </div>
            </header>
            <main className="wa-content">
                <Outlet />
            </main>
        </div>
    );
};

export default DacosDealerLayout;
