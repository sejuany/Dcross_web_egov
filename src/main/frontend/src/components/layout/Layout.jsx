import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { LogOut, Settings, Bell, ChevronRight, X } from 'lucide-react';

import { useTabs } from '../../context/TabContext';
import { useAuth } from '../../context/AuthContext';
import './Layout.css';
const getValue = (row, key) => {
    if (!row) return '';

    return (
        row[key] ??
        row[key.toLowerCase()] ??
        row[key.toUpperCase()] ??
        ''
    );
};

/**
 * TM_MAINMENU 한 row를 React에서 쓰기 쉬운 형태로 정규화.
 *
 * 중요:
 * - id      : 기존 TM_MAINMENU.ID, 권한/계층 판단용
 * - title   : TM_MAINMENU.NAME, 화면 표시명
 * - webId   : React 탭 ID
 * - webPath : React Router path
 */
const normalizeMenuRow = (row) => {
    const id = String(getValue(row, 'ID')).trim();
    const name = String(getValue(row, 'NAME')).trim();
    const fileName = String(getValue(row, 'FILENAME')).trim();
    const imageId = String(getValue(row, 'IMAGEID')).trim();
    const viewAuth = String(getValue(row, 'VIEWAUTH')).trim();
    const writeAuth = String(getValue(row, 'WRITEAUTH')).trim();
    const message = String(getValue(row, 'MESSAGE')).trim();
    const filterUse = String(getValue(row, 'FILTERUSE')).trim();
    const etcData = String(getValue(row, 'ETCDATA')).trim();
    const webId = String(getValue(row, 'WEBID')).trim();
    const webPath = String(getValue(row, 'WEBPATH')).trim();

    return {
        id,
        title: name,
        fileName,
        imageId,
        viewAuth,
        writeAuth,
        message,
        filterUse,
        etcData,
        webId,
        webPath,
    };
};

/**
 * 서버에서 권한 필터링된 TM_MAINMENU 목록을
 * React Layout에서 사용할 menuConfig 구조로 변환한다.
 *
 * 결과 예:
 * {
 *   '저당설정': [
 *      {
 *          id: 'mort-reg-request',
 *          menuId: '1010',
 *          title: '설정등록',
 *          path: '/mortgage/mort-reg-request'
 *      }
 *   ]
 * }
 */
const buildAuthorizedMenuConfig = (rawMenuList) => {
    const rows = Array.isArray(rawMenuList)
        ? rawMenuList
            .map(normalizeMenuRow)
            .filter(menu => menu.id && menu.title)
        : [];

    const topMenus = rows.filter(menu => menu.id.length === 2);
    const childMenus = rows.filter(menu => menu.id.length > 2);

    const result = {};

    topMenus.forEach((topMenu) => {
        const children = childMenus
            // 기존 MiPlatform 구조: 하위 메뉴 ID는 상위 메뉴 ID로 시작
            .filter(child => child.id.startsWith(topMenu.id))

            // 기존 disabled 메뉴는 웹 메뉴에서 제외
            .filter(child => child.fileName !== 'disabled')

            // 웹으로 연결할 수 있는 메뉴만 표시
            // 아직 WEBPATH가 없는 메뉴는 React 화면이 없거나 매핑 미완료로 판단
            .filter(child => child.webPath)

            .map((child) => {
                return {
                    // 탭 ID는 WEBID 우선, 없으면 기존 메뉴 ID 사용
                    id: child.webId || child.id,

                    // 기존 DB 메뉴 ID는 별도 보관
                    menuId: child.id,

                    // 화면 표시명
                    title: child.title,

                    // React Router path
                    path: child.webPath,

                    // 원본 메뉴 정보 보관
                    raw: child,
                };
            });

        // 하위 메뉴가 하나라도 있는 상위 메뉴만 노출
        if (children.length > 0) {
            result[topMenu.title] = children;
        }
    });

    return result;
};

const Header = ({ activeCategory, setActiveCategory, menuConfig }) => {
    const { user, logout } = useAuth();
    const { addTab } = useTabs();

    const categories = Object.keys(menuConfig || {});

    const memberName =
        user?.member_NM ||
        user?.MEMBER_NM ||
        user?.memberNm ||
        '사용자';

    return (
        <header className="main-header">
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

                    <span className="user-name">
                        {memberName}님 환영합니다.
                    </span>

                    <button
                        className="header-btn"
                        onClick={() =>
                            addTab(
                                'member-password-check',
                                '회원정보수정',
                                '/mypage/member-password-check'
                            )
                        }
                    >
                        <Settings size={18} /> 회원정보수정
                    </button>

                    <button className="header-btn logout" onClick={logout}>
                        <LogOut size={18} /> Logout
                    </button>
                </div>
            </div>
        </header>
    );
};

const Sidebar = ({ activeCategory, menuConfig }) => {
    const { addTab } = useTabs();

    const menuItems = menuConfig?.[activeCategory] || [];

    return (
        <aside className="main-sidebar">
            <div className="sidebar-logo-area">
                <Link to="/home" onClick={() => addTab('home', '홈', '/home')}>
                    <img
                        src="/logo_navy_horizontal.png"
                        alt="DACOS"
                        className="sidebar-logo"
                    />
                </Link>
            </div>

            <div className="sidebar-group" style={{ flex: 1, overflowY: 'auto' }}>
                <h3 className="group-title">{activeCategory || '메뉴'}</h3>

                <ul className="sidebar-menu">
                    {menuItems.length === 0 && (
                        <li
                            className="menu-item"
                            style={{ cursor: 'default', opacity: 0.7 }}
                        >
                            표시할 메뉴가 없습니다.
                        </li>
                    )}

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
    const { tabs, activeTabId, switchTab, removeTab } = useTabs();

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

    const [layoutWidth] = useState('100%');
    const [menuConfig, setMenuConfig] = useState({});
    const [activeCategory, setActiveCategory] = useState('');
    const [menuLoading, setMenuLoading] = useState(true);

    const currentTab = tabs.find(t => t.id === activeTabId);

    const categories = useMemo(() => Object.keys(menuConfig || {}), [menuConfig]);

    useEffect(() => {
        let mounted = true;

        const loadMyMenus = async () => {
            try {
                setMenuLoading(true);

                const res = await axios.post('/api/menu/my-menus', {});
                const list = res.data?.list || [];

                console.log('[내 권한 메뉴 원본]', list);

                const authorizedMenuConfig = buildAuthorizedMenuConfig(list);

                console.log('[내 권한 메뉴 변환 결과]', authorizedMenuConfig);

                if (!mounted) return;

                const authorizedCategories = Object.keys(authorizedMenuConfig);

                if (authorizedCategories.length > 0) {
                    setMenuConfig(authorizedMenuConfig);

                    setActiveCategory(prev =>
                        prev && authorizedMenuConfig[prev]
                            ? prev
                            : authorizedCategories[0]
                    );
                } else {
                    console.warn('[내 권한 메뉴 없음]');
                    setMenuConfig({});
                    setActiveCategory('');
                }
            } catch (err) {
                console.error('[내 권한 메뉴 조회 실패]', err);

                if (!mounted) return;

                setMenuConfig({});
                setActiveCategory('');
            } finally {
                if (mounted) {
                    setMenuLoading(false);
                }
            }
        };

        loadMyMenus();

        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        if (!activeCategory && categories.length > 0) {
            setActiveCategory(categories[0]);
        }
    }, [activeCategory, categories]);

    return (
        <div className="app-container">
            <div className="app-layout" style={{ maxWidth: layoutWidth }}>
                <div className="layout-body">
                    <Sidebar
                        activeCategory={activeCategory}
                        menuConfig={menuConfig}
                    />

                    <div className="main-wrapper">
                        <Header
                            activeCategory={activeCategory}
                            setActiveCategory={setActiveCategory}
                            menuConfig={menuConfig}
                        />

                        <TabBar />

                        <div className="navigation-path">
                            <span className="path-icon">»</span>
                            <span className="path-text">
                                {menuLoading
                                    ? '메뉴 불러오는 중...'
                                    : `${activeCategory || '메뉴'} ${
                                        currentTab?.title ? `> ${currentTab.title}` : ''
                                    }`}
                            </span>
                        </div>

                        <main className="main-content">
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