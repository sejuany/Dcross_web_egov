import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LogOut, Settings, Bell, ChevronRight, X, Laptop, Monitor, Maximize } from 'lucide-react';
import { useTabs } from '../../context/TabContext';
import { useAuth } from '../../context/AuthContext';
import './Layout.css';

import { useEffect } from 'react';

const MENU_CONFIG = {
    '저당설정': [
        { id: 'mort-reg-request',    title: '설정등록',       path: '/mortgage/mort-reg-request' },
        { id: 'mort-reg-list',       title: '설정신청현황',   path: '/mortgage/mort-reg-list' },
        { id: 'm-e-sign',            title: '사전전자서명',   path: '/mortgage/beforehand-dsign' },
        { id: 'm-work',              title: '대사작업',       path: '/mortgage/mort-reg-confirm' },
        { id: 'm-joint',             title: '공동저당',       path: '/mortgage/regist-confirm' },
        { id: 'm-change',            title: '저당권변경',     path: '/mortgage/mort-change' },
        { id: 'm-change-status',     title: '저당권변경현황', path: '/mortgage/mort-change-list' },
        { id: 'm-rectify',           title: '경정관리',       path: '/mortgage/correction-info' },
        { id: 'm-delay',             title: '처리지연현황',   path: '/mortgage/delay-list' },
    ],
    '저당말소': [
        { id: 'mort-ers-request',       title: '말소등록',     path: '/mortgageerase/mort-ers-request' },
        { id: 'mort-ers-list',          title: '말소신청현황', path: '/mortgageerase/mort-ers-list' },
        { id: 'mort-ers-group-request', title: '다건말소등록', path: '/mortgageerase/mort-ers-group-request' },
        { id: 'mort-ers-manual',        title: '말소수동신청', path: '/mortgageerase/mort-ers-request' },
    ],
    '신규등록': [
        { id: 'new-reg',         title: '신규등록',       path: '/newcar/newcar-request' },
        { id: 'new-list',        title: '신규신청현황',   path: '/newcar/newcar-list' },
        { id: 'new-group',       title: '다건신규등록',   path: '/newcar/newcar-group-request' },
        { id: 'epayconfirm',     title: '지방세납부관리', path: '/newcar/epayconfirm' },
        { id: 'not-used-bond',   title: '미사용채권',     path: '/newcar/not-used-bond' },
    ],
    '이전등록': [
        { id: 'trnsname-request',    title: '이전등록',            path: '/trnsname/trnsname-request' },
        { id: 'trnsname-list',       title: '이전등록현황',        path: '/trnsname/trnsname-list' },
        { id: 'total-group-request', title: '통합업로드(신규,이전)',path: '/trnsname/total-group-request' },
        { id: 'carp-request-list',   title: '등록증발송현황',      path: '/trnsname/carp-request-list' },
        { id: 'trns-num-change',     title: '탈부착요청현황',      path: '/trnsname/trns-num-change' },
        { id: 'offline-list',        title: '오프라인',            path: '/trnsname/offline-list' },
    ],
    '건설기계': [
        { id: 'ce-mort-reg-request', title: '건설기계설정',     path: '/constructequip/ce-mort-reg-request' },
        { id: 'ce-mort-reg-list',    title: '건설기계설정현황', path: '/constructequip/ce-mort-reg-list' },
        { id: 'ce-mort-ers-request', title: '건설기계말소',     path: '/constructequip/ce-mort-ers-request' },
        { id: 'ce-mort-ers-list',    title: '건설기계말소현황', path: '/constructequip/ce-mort-ers-list' },
        { id: 'ce-mort-ers-group',   title: '건기다건말소등록', path: '/constructequip/ce-mort-ers-group' },
    ],
    '변경등록': [
        { id: 'modify-request',       title: '변경등록',       path: '/modify/modify-request' },
        { id: 'modify-list',          title: '변경등록현황',   path: '/modify/modify-list' },
        { id: 'modify-group-request', title: '다건변경등록',   path: '/modify/modify-group-request' },
        { id: 'carp-reprint-request', title: '등록증재발급',   path: '/modify/carp-reprint-request' },
        { id: 'carp-reprint-multi',   title: '다건등록증재발급',path: '/modify/carp-reprint-request' },
        { id: 'carp-reprint-list',    title: '등록증현황',     path: '/modify/carp-reprint-list' },
    ],
    '번호판관리': [
        { id: 'number-plate-list',       title: '번호판목록',       path: '/numplate/number-plate-list' },
        { id: 'car-paper-manage',        title: '자동차등록증관리', path: '/numplate/car-paper-manage' },
        { id: 'temporary-num-plate',     title: '임판회수관리',     path: '/numplate/temporary-num-plate' },
        { id: 'num-plate-supply-manage', title: '번호판수불관리',   path: '/numplate/num-plate-supply-manage' },
        { id: 'num-plate-supply-list',   title: '번호판납품현황',   path: '/numplate/num-plate-supply-list' },
    ],
    '부가서비스': [
        { id: 'car-mileage-list',    title: '원부스크래핑',   path: '/addservice/car-mileage-list' },
        { id: 'wonbu-scrap-request', title: '소유자정보확인', path: '/addservice/wonbu-scrap-request' },
        { id: 'car-sise',            title: '시세',           path: '/addservice/car-sise' },
        { id: 'car-365price-list',   title: '365시세현황',    path: '/addservice/car-365price-list' },
        { id: 'car-zen-mapping',     title: '카젠매핑',       path: '/addservice/car-zen-mapping' },
        { id: 'insurance-manage',    title: '보험가입여부',   path: '/addservice/insurance-manage' },
    ],
    '납부관리': [
        { id: 'pay-info',        title: '납부현황',       path: '/payment/pay-info' },
        { id: 'tvbank-manage',   title: '통합가상계좌',   path: '/payment/tvbank-manage' },
        { id: 'selling-info',    title: '매출현황',       path: '/payment/selling-info' },
        { id: 'point-manage',    title: '선납금관리',     path: '/payment/point-manage' },
        { id: 'not-pay-info',    title: '미납내역관리',   path: '/payment/not-pay-info' },
        { id: 'pay-return-info', title: '환불관리',       path: '/payment/pay-return-info' },
        { id: 'injise-manage',   title: '인지세관리',     path: '/payment/injise-manage' },
        { id: 'epay-info',       title: '지방세납부현황', path: '/payment/epay-info' },
        { id: 'payment-total',   title: '종합신청현황',   path: '/payment/total-list' },
    ],
    '기업관리': [
        { id: 'company-manage',          title: '기업관리',       path: '/company/company-manage' },
        { id: 'company-user-manage',     title: '사용자관리',     path: '/company/company-user-manage' },
        { id: 'numplate-delivery-manage',title: '탈부착업체관리', path: '/company/numplate-delivery-manage' },
        { id: 'company-new',             title: '회원사관리',     path: '/company/company-new' },
    ],
    '관리자메뉴': [
        { id: 'code-manage',      title: '코드관리',     path: '/admin/code-manage' },
        { id: 'board-manage',     title: '게시판관리',   path: '/admin/board-manage' },
        { id: 'menu-manage',      title: '메뉴관리',     path: '/admin/menu-manage' },
        { id: 'login-log',        title: '로그인로그',   path: '/admin/login-log-list' },
        { id: 'search-log',       title: '조회로그',     path: '/admin/search-log-list' },
        { id: 'nexus-log',        title: '연계로그',     path: '/admin/data-link-test' },
        { id: 'auth-history',     title: '권한변경이력', path: '/admin/account-history' },
        { id: 'source-deploy',    title: '소스반영',     path: '/admin/server-apply' },
        { id: 'admin-total-list', title: '종합신청현황', path: '/admin/total-list' },
    ],
};

const Header = ({ activeCategory, setActiveCategory, layoutWidth }) => {
    const { user, logout } = useAuth();
	const { addTab } = useTabs();
    const categories = Object.keys(MENU_CONFIG);
	console.log('현재 로그인 user:', user);

    const memberName =
		user?.member_NM ||
        '사용자';

    return (
        /*<header className={`main-header ${layoutWidth === '1280px' ? 'is-1280' : ''}`}>*/
		<header className={`main-header ${layoutWidth === '100%'}`}>
            <div className="header-left">
                <nav className="top-nav">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            className={`nav-item ${activeCategory === cat ? 'active' : ''}`}
                            onClick={() => setActiveCategory(cat)}
                        >
                            {cat}
                        </button>
                    ))}
                </nav>
            </div>
            <div className="header-right">
                <div className="user-info">
                    <Bell size={18} className="icon" />
                    <span className="user-name">{memberName}님 환영합니다.</span>
					<button
					    className="header-btn"
					    onClick={() => addTab('member-password-check', '회원정보수정', '/mypage/member-password-check')}
					>
					    <Settings size={18} /> 회원정보수정
					</button>
                    <button className="header-btn logout" onClick={logout}><LogOut size={18} /> Logout</button>
                </div>
            </div>
        </header>
    );
};

const Sidebar = ({ activeCategory, layoutWidth, setLayoutWidth }) => {
    const { addTab } = useTabs();
    const menuItems = MENU_CONFIG[activeCategory] || [];

    return (
        <aside className="main-sidebar">
            <div className="sidebar-logo-area">
                <Link to="/home" onClick={() => addTab('home', '홈', '/home')}>
                    <img src="/logo_navy_horizontal.png" alt="DACOS" className="sidebar-logo" />
                </Link>
            </div>
            <div className="sidebar-group" style={{ flex: 1, overflowY: 'auto' }}>
                <h3 className="group-title">{activeCategory}</h3>
                <ul className="sidebar-menu">
                    {menuItems.map(item => (
                        <li
                            key={item.id}
                            className="menu-item"
                            onClick={() => addTab(item.id, item.title, item.path)}
                        >
                            <ChevronRight size={14} /> {item.title}
                        </li>
                    ))}
                </ul>
            </div>
        </aside>
    );
};

const TabBar = () => {
	// 커스텀 Hook(useTabs) 호출
	// tabs: 탭 목록 배열
	// activeTabId: 현재 활성화된 탭 id
	// switchTab: 탭 변경 함수
	// removeTab: 탭 삭제 함수
    const { tabs, activeTabId, switchTab, removeTab } = useTabs();
	
	// 현재 활성화 된 객체 찾기
	const activeTab = tabs.find(tab => tab.id === activeTabId);

	useEffect(() => {
	    if (activeTab) {
	        document.title = `주식회사 다코스 - ${activeTab.title}`;
	    } else {
	        document.title = '주식회사 다코스';
	    }
	}, [activeTabId, activeTab]);
	
    return (
        <div className="tab-wrapper">
            <div className="tab-bar">
                {tabs.map((tab) => (
                    <div
                        key={tab.id}
                        className={`tab-item ${activeTabId === tab.id ? 'active' : ''}`}
                        onClick={() => switchTab(tab.id)}
                    >
                        <span className="tab-title">{tab.title}</span>
                        {tab.closable && (
                            <X
                                size={14}
                                className="tab-close"
                                onClick={(e) => removeTab(tab.id, e)}
                            />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

const Layout = ({ children }) => {
    const { activeTabId, tabs } = useTabs();
    const [activeCategory, setActiveCategory] = useState('신규등록');
    const [layoutWidth, setLayoutWidth] = useState('100%'); 
    const currentTab = tabs.find(t => t.id === activeTabId);

    return ( 
        <div className="app-container">
            <div className="app-layout" style={{ maxWidth: layoutWidth }}>
                <div className="layout-body">
                    <Sidebar
                        activeCategory={activeCategory}
                        layoutWidth={layoutWidth}
                        setLayoutWidth={setLayoutWidth}
                    />
                    <div className="main-wrapper">
                        <Header
                            activeCategory={activeCategory}
                            setActiveCategory={setActiveCategory}
                            layoutWidth={layoutWidth}
                        />
                        <TabBar />
                        <div className="navigation-path">
                            <span className="path-icon">»</span>
                            <span className="path-text">
                                {activeCategory} {currentTab?.title ? `> ${currentTab.title}` : ''}
                            </span>
                        </div>
                        {/*<main className={`main-content ${layoutWidth === '1280px' ? 'is-1280' : ''}`}>*/}
						<main className={`main-content ${layoutWidth === '100%'}`}>
                            <div className="content-inner">
                                {children}
                            </div>
                        </main>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Layout;
