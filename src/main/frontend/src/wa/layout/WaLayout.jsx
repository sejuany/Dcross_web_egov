import React, { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut, UserRound, Settings } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getUserCompanyId, WA_HOME_PATH } from '../auth/waRouting';
import '../styles/wa.css';

const baseNavItems = [
    { to: WA_HOME_PATH, label: '신규등록현황' },
    { to: '/wa/payment-status', label: '납부현황' },
];

const companyManageItems = [
    { to: '/wa/company-manage', label: '기업관리' },
    { to: '/wa/company-user-manage', label: '기업사용자관리' },
];

const getUserName = (user) => (
    user?.MEMBER_NM ||
    user?.member_NM ||
    user?.memberNm ||
    '사용자'
);

const getUserMemberGb = (user) => {
    return String(
        user?.MEMBER_GB ||
        user?.member_GB ||
        user?.memberGb ||
        user?.member_gb ||
        ''
    ).trim().toUpperCase();
};

const WaLayout = () => {
    const { user, logout, sessionWarningOpen, setSessionWarningOpen } = useAuth();
    const location = useLocation();
	const navigate = useNavigate();

    const companyId = getUserCompanyId(user);
    const userName = getUserName(user);
    const memberGb = getUserMemberGb(user);

    const companyMenuRef = useRef(null);
    const [companyMenuOpen, setCompanyMenuOpen] = useState(false);

	const canViewCompanyManage = memberGb === 'CA' || memberGb === 'SA';
	const canViewCompanyUserManage = memberGb === 'CA' || memberGb === 'SA' || memberGb === 'BA';
	const canViewCompanyMenu = canViewCompanyManage || canViewCompanyUserManage;

	const visibleCompanyManageItems = companyManageItems.filter(item => {
	    if (item.to === '/wa/company-manage') {
	        return canViewCompanyManage;
	    }

	    if (item.to === '/wa/company-user-manage') {
	        return canViewCompanyUserManage;
	    }

	    return false;
	});
	
	const isCompanyMenuActive = visibleCompanyManageItems.some(item =>
	    location.pathname === item.to ||
	    location.pathname.startsWith(`${item.to}/`)
	);

    useEffect(() => {
        const handleDocumentClick = (event) => {
            if (
                companyMenuRef.current &&
                !companyMenuRef.current.contains(event.target)
            ) {
                setCompanyMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handleDocumentClick);

        return () => {
            document.removeEventListener('mousedown', handleDocumentClick);
        };
    }, []);

    return (
        <div className="wa-shell">
            <header className="wa-topbar">
                <div className="wa-topbar-inner">
                    <NavLink className="wa-brand" to={WA_HOME_PATH} aria-label="DACOS 딜러시스템 홈">
                        <img src="/logo.png" alt="DACOS" />
                    </NavLink>

                    <nav className="wa-top-nav" aria-label="WA navigation">
                        {baseNavItems.map((item) => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                className={({ isActive }) =>
                                    `wa-top-nav-link ${isActive ? 'active' : ''}`
                                }
                            >
                                {item.label}
                            </NavLink>
                        ))}

                        {canViewCompanyMenu && (
                            <div
                                className="wa-top-nav-dropdown-wrap"
                                ref={companyMenuRef}
                            >
                                <button
                                    type="button"
                                    className={`wa-top-nav-link wa-top-nav-dropdown-button ${isCompanyMenuActive ? 'active' : ''}`}
                                    onClick={() => setCompanyMenuOpen(prev => !prev)}
                                >
                                    <span>기업관리</span>
                                    <ChevronDown
                                        size={14}
                                        className={`wa-dropdown-icon ${companyMenuOpen ? 'open' : ''}`}
                                    />
                                </button>

                                {companyMenuOpen && (
                                    <div className="wa-top-nav-dropdown">
                                        {visibleCompanyManageItems.map(item => (
                                            <NavLink
                                                key={item.to}
                                                to={item.to}
                                                className={({ isActive }) =>
                                                    `wa-top-nav-dropdown-item ${isActive ? 'active' : ''}`
                                                }
                                                onClick={() => setCompanyMenuOpen(false)}
                                            >
                                                {item.label}
                                            </NavLink>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </nav>

					<div className="wa-top-actions">
					    <span className="wa-user-chip">
					        <UserRound size={14} />
					        {/* <span>{companyId || 'WA'}</span> */}
					        <strong>{userName}</strong>
					    </span>

					    <button
					        type="button"
					        className="wa-logout-button"
					        onClick={() => navigate('/wa/member-password-check')}
					    >
					        <Settings size={14} />
					        <span>회원정보수정</span>
					    </button>

					    <button
					        type="button"
					        className="wa-logout-button"
					        onClick={() => logout({ redirectTo: '/wa/login' })}
					    >
					        <LogOut size={14} />
					        <span>로그아웃</span>
					    </button>
					</div>
                </div>
            </header>
			{sessionWarningOpen && (
			    <div className="wa-session-warning-overlay">
			        <div className="wa-session-warning-modal" role="dialog" aria-modal="true">
			            <button type="button" className="wa-session-warning-close" onClick={() => setSessionWarningOpen(false)}>×</button>

			            <h2>로그인 세션 만료 안내</h2>

			            <div className="wa-session-warning-content">
			                <strong>1분</strong>
			                <span>후 자동 로그아웃됩니다.</span>
			            </div>

			            <p>
			                장시간 서비스 이용이 없어 로그인 세션이 곧 만료됩니다.<br />
			                서비스를 계속 이용하면 로그인 시간이 자동으로 연장됩니다.
			            </p>

			            <button type="button" className="wa-session-warning-confirm" onClick={() => setSessionWarningOpen(false)}>
			                확인
			            </button>
			        </div>
			    </div>
			)}
            <main className="wa-content">
                <Outlet />
            </main>
        </div>
    );
};

export default WaLayout;