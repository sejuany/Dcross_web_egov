import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LogOut, UserRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getUserCompanyId, WA_HOME_PATH } from '../auth/waRouting';
import '../styles/wa.css';

const navItems = [
    { to: WA_HOME_PATH, label: '신규등록현황' },
    { to: '/wa/payment-status', label: '납부현황' },
    { to: '/wa/company-manage', label: '기업관리' }
];

const getUserName = (user) => (
    user?.MEMBER_NM ||
    user?.member_NM ||
    user?.memberNm ||
    '사용자'
);

const WaLayout = () => {
    const { user, logout } = useAuth();
    const companyId = getUserCompanyId(user);
    const userName = getUserName(user);

    return (
        <div className="wa-shell">
            <header className="wa-topbar">
                <div className="wa-topbar-inner">
                    <NavLink className="wa-brand" to={WA_HOME_PATH} aria-label="DACOS WA 홈">
                        <img src="/logo.png" alt="DACOS" />
                    </NavLink>

                    <nav className="wa-top-nav" aria-label="WA navigation">
                        {navItems.map((item) => (
                            <NavLink key={item.to} to={item.to} className={({ isActive }) => `wa-top-nav-link ${isActive ? 'active' : ''}`}>
                                {item.label}
                            </NavLink>
                        ))}
                    </nav>

                    <div className="wa-top-actions">
                        <span className="wa-user-chip">
                            <UserRound size={14} />
                            <span>{companyId || 'WA'}</span>
                            <strong>{userName}</strong>
                        </span>
                        <button type="button" className="wa-logout-button" onClick={() => logout({ redirectTo: '/wa/login' })}>
                            <LogOut size={14} />
                            <span>로그아웃</span>
                        </button>
                        <button type="button" className="wa-mypage-button">
                            마이페이지
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

export default WaLayout;