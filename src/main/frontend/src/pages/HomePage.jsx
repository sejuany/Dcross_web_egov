import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Check, FilePenLine, FileSearch, FileText, Globe, PenIcon, Search, User, X } from 'lucide-react';
import { useTabs } from '../context/TabContext';
import { useAuth } from '../context/AuthContext';
import './HomePage.css';

const getValue = (row, key) => {
    if (!row) return '';

    return (
        row[key] ??
        row[key.toLowerCase()] ??
        row[key.toUpperCase()] ??
        ''
    );
};

const normalizeMenuRow = (row) => {
    const id = String(getValue(row, 'ID')).trim();
    const name = String(getValue(row, 'NAME')).trim();
    const fileName = String(getValue(row, 'FILENAME')).trim();
    const webId = String(getValue(row, 'WEBID')).trim();
    const webPath = String(getValue(row, 'WEBPATH')).trim();

    return {
        id,
        title: name,
        fileName,
        tabId: webId || id,
        path: webPath,
    };
};

const getUserValue = (user, key) => {
    if (!user) return '';

    const firstSegmentLowerKey = key
        .split('_')
        .map((part, index) => index === 0 ? part.toLowerCase() : part)
        .join('_');
    const camelKey = key
        .toLowerCase()
        .replace(/_([a-z])/g, (_, char) => char.toUpperCase());

    return (
        user[key] ??
        user[firstSegmentLowerKey] ??
        user[key.toLowerCase()] ??
        user[key.charAt(0) + key.slice(1).toLowerCase()] ??
        user[camelKey] ??
        ''
    );
};

const getFavoriteMenuIcon = (title) => {
    if (title.includes('등록현황')) {
        return FileSearch;
    }

    if (title.includes('등록')) {
        return FilePenLine;
    }

    return FileText;
};

const HomePage = () => {
    const { addTab } = useTabs();
    const { user } = useAuth();
    const [ipInfo, setIpInfo] = useState('가져오는 중...');
    const [authorizedMenus, setAuthorizedMenus] = useState([]);
    const [favoriteMenuIds, setFavoriteMenuIds] = useState([]);
    const [isFavoriteModalOpen, setIsFavoriteModalOpen] = useState(false);
    const [draftFavoriteMenuIds, setDraftFavoriteMenuIds] = useState([]);
    const [menuSearchKeyword, setMenuSearchKeyword] = useState('');
    const [menuLoading, setMenuLoading] = useState(true);
    const [favoriteSaving, setFavoriteSaving] = useState(false);

    useEffect(() => {
        fetch('https://api.ipify.org?format=json')
            .then(res => res.json())
            .then(data => setIpInfo(data.ip))
            .catch(() => setIpInfo('127.0.0.1 (Local)'));
    }, []);

    useEffect(() => {
        let mounted = true;

        const loadHomeMenus = async () => {
            try {
                setMenuLoading(true);

                const [menuRes, favoriteRes] = await Promise.all([
                    axios.post('/api/menu/my-menus', {}),
                    axios.post('/api/menu/favorites', {}),
                ]);

                if (!mounted) return;

                const menus = (menuRes.data?.list || [])
                    .map(normalizeMenuRow)
                    .filter(menu => menu.id && menu.title && menu.path && menu.fileName !== 'disabled');

                const availableIds = new Set(menus.map(menu => menu.id));
                const savedIds = String(favoriteRes.data?.favMenu || '')
                    .split(',')
                    .map(id => id.trim())
                    .filter(id => id && availableIds.has(id))
                    .slice(0, 10);

                setAuthorizedMenus(menus);
                setFavoriteMenuIds(savedIds);
            } catch (error) {
                console.error('자주쓰는 메뉴 조회 실패:', error);

                if (!mounted) return;

                setAuthorizedMenus([]);
                setFavoriteMenuIds([]);
            } finally {
                if (mounted) {
                    setMenuLoading(false);
                }
            }
        };

        loadHomeMenus();

        return () => {
            mounted = false;
        };
    }, []);

    const favoriteMenus = useMemo(() => {
        const menuMap = new Map(authorizedMenus.map(menu => [menu.id, menu]));

        return favoriteMenuIds
            .map((id) => {
                const menu = menuMap.get(id);
                return menu ? { ...menu, Icon: getFavoriteMenuIcon(menu.title) } : null;
            })
            .filter(Boolean);
    }, [authorizedMenus, favoriteMenuIds]);

    const filteredAuthorizedMenus = useMemo(() => {
        const keyword = menuSearchKeyword.trim().toLowerCase();

        if (!keyword) {
            return authorizedMenus;
        }

        return authorizedMenus.filter(menu =>
            menu.title.toLowerCase().includes(keyword) ||
            menu.id.toLowerCase().includes(keyword)
        );
    }, [authorizedMenus, menuSearchKeyword]);

    const draftFavoriteMenus = useMemo(() => {
        const menuMap = new Map(authorizedMenus.map(menu => [menu.id, menu]));

        return draftFavoriteMenuIds
            .map(id => menuMap.get(id))
            .filter(Boolean);
    }, [authorizedMenus, draftFavoriteMenuIds]);

    const openFavoriteModal = () => {
        setDraftFavoriteMenuIds(favoriteMenuIds);
        setMenuSearchKeyword('');
        setIsFavoriteModalOpen(true);
    };

    const closeFavoriteModal = () => {
        if (favoriteSaving) return;
        setIsFavoriteModalOpen(false);
    };

    const toggleFavoriteMenu = (menuId) => {
        setDraftFavoriteMenuIds(prev => {
            if (prev.includes(menuId)) {
                return prev.filter(id => id !== menuId);
            }

            if (prev.length >= 10) {
                alert('자주쓰는 메뉴는 최대 10개까지 선택할 수 있습니다.');
                return prev;
            }

            return [...prev, menuId];
        });
    };

    const moveFavoriteMenu = (fromIndex, toIndex) => {
        if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) {
            return;
        }

        setDraftFavoriteMenuIds(prev => {
            if (fromIndex >= prev.length || toIndex >= prev.length) {
                return prev;
            }

            const next = [...prev];
            const [moved] = next.splice(fromIndex, 1);
            next.splice(toIndex, 0, moved);
            return next;
        });
    };

    const saveFavoriteMenus = async () => {
        try {
            setFavoriteSaving(true);

            const res = await axios.post('/api/menu/favorites/save', {
                menuIds: draftFavoriteMenuIds,
            });

            const availableIds = new Set(authorizedMenus.map(menu => menu.id));
            const savedIds = String(res.data?.favMenu || '')
                .split(',')
                .map(id => id.trim())
                .filter(id => id && availableIds.has(id))
                .slice(0, 10);

            setFavoriteMenuIds(savedIds);
            setIsFavoriteModalOpen(false);
        } catch (error) {
            console.error('자주쓰는 메뉴 저장 실패:', error);
            alert(error.response?.data?.message || '자주쓰는 메뉴 저장 중 오류가 발생했습니다.');
        } finally {
            setFavoriteSaving(false);
        }
    };

    return (
        <div className="home-dashboard">
            <h1 className="dashboard-title">Dashboard Overview</h1>

            <div className="dashboard-grid">
                <div className="widget menu-widget favorite-service-widget full-width">
                    <div className="widget-header favorite-header">
                        <div className="favorite-title">
                            <span>자주사용하는메뉴</span>
                        </div>
                        <div className="favorite-actions">
                            {/* <button className="favorite-circle-btn" type="button" aria-label="이전 메뉴">
                                <ChevronLeft size={18} />
                            </button>
                            <button className="favorite-circle-btn white" type="button" aria-label="다음 메뉴">
                                <ChevronRight size={18} />
                            </button> */}
                            <button className="favorite-expand-btn" type="button" onClick={openFavoriteModal}>
                                <PenIcon size={16} />
                            </button>
                        </div>
                    </div>

                    {menuLoading ? (
                        <div className="favorite-empty">자주쓰는 메뉴를 불러오는 중입니다.</div>
                    ) : favoriteMenus.length === 0 ? (
                        <div className="favorite-empty">자주쓰는 메뉴를 선택해주세요.</div>
                    ) : (
                        <div className="menu-grid">
                            {favoriteMenus.map(menu => (
                                <button
                                    key={menu.id}
                                    type="button"
                                    className="menu-card"
                                    onClick={() => addTab(menu.tabId, menu.title, menu.path)}
                                >
                                    <span className="menu-title">{menu.title}</span>
                                    <div className="menu-icon-box">
                                        <menu.Icon size={18} />
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div><div className="home-bottom-info">
                    <div className="widget info-widget">
                        <div className="widget-header">
                            <User size={20} />
                            <span>로그인 정보</span>
                        </div>
                        <div className="widget-content info-inline-content">
                            <div className="info-row">
                                <span className="label">회원사</span>
                                <span className="value">{getUserValue(user, 'COMPANY_NM') || getUserValue(user, 'COMPANY_ID') || '-'}</span>
                            </div>
                            <div className="info-row">
                                <span className="label">지점 / 부서</span>
                                <span className="value">{getUserValue(user, 'BRANCH_NM') || getUserValue(user, 'BRANCH_ID') || '-'}</span>
                            </div>
                            <div className="info-row">
                                <span className="label">사용자명</span>
                                <span className="value">{getUserValue(user, 'MEMBER_NM') || '사용자'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="widget info-widget">
                        <div className="widget-header">
                            <Globe size={20} />
                            <span>시스템 정보</span>
                        </div>
                        <div className="widget-content info-inline-content">
                            <div className="info-row">
                                <span className="label">접속 IP</span>
                                <span className="value">{ipInfo}</span>
                            </div>
                            <div className="info-row">
                                <span className="label">시스템 상태</span>
                                <span className="value status-ok">정상</span>
                            </div>
                            <div className="info-row">
                                <span className="label">현재버전</span>
                                <span className="value">v1.0.0</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {isFavoriteModalOpen && (
                <div className="favorite-modal-backdrop" onMouseDown={closeFavoriteModal}>
                    <div className="favorite-modal" onMouseDown={e => e.stopPropagation()}>
                        <div className="favorite-modal-header">
                            <div>
                                <h2>자주쓰는 메뉴 수정</h2>
                                <span>{draftFavoriteMenuIds.length}/10 선택</span>
                            </div>
                            <button className="modal-icon-btn" type="button" onClick={closeFavoriteModal}>
                                <X size={18} />
                            </button>
                        </div>

                        <div className="favorite-search">
                            <Search size={16} />
                            <input
                                type="text"
                                value={menuSearchKeyword}
                                onChange={e => setMenuSearchKeyword(e.target.value)}
                                placeholder="메뉴명 또는 메뉴 ID 검색"
                            />
                        </div>

                        <div className="favorite-selected-panel">
                            <div className="favorite-panel-title">선택된 메뉴 순서 (드래그하여 순서를 변경하세요)</div>
                            {draftFavoriteMenus.length === 0 ? (
                                <div className="favorite-selected-empty">선택된 메뉴가 없습니다.</div>
                            ) : (
                                <div className="favorite-selected-list">
                                    {draftFavoriteMenus.map((menu, index) => (
                                        <div
                                            key={menu.id}
                                            className="favorite-selected-item"
                                            draggable
                                            onDragStart={e => {
                                                e.dataTransfer.effectAllowed = 'move';
                                                e.dataTransfer.setData('text/plain', String(index));
                                            }}
                                            onDragOver={e => {
                                                e.preventDefault();
                                                e.dataTransfer.dropEffect = 'move';
                                            }}
                                            onDrop={e => {
                                                e.preventDefault();
                                                const fromIndex = Number(e.dataTransfer.getData('text/plain'));
                                                moveFavoriteMenu(fromIndex, index);
                                            }}
                                        >
                                            <span className="favorite-order-no">{index + 1}</span>
                                            <span className="favorite-selected-name">{menu.title}</span>
                                            <button
                                                className="favorite-remove-btn"
                                                type="button"
                                                onClick={() => toggleFavoriteMenu(menu.id)}
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="favorite-menu-list">
                            {filteredAuthorizedMenus.length === 0 ? (
                                <div className="favorite-empty">선택 가능한 메뉴가 없습니다.</div>
                            ) : (
                                filteredAuthorizedMenus.map(menu => {
                                    const selected = draftFavoriteMenuIds.includes(menu.id);

                                    return (
                                        <button
                                            key={menu.id}
                                            type="button"
                                            className={`favorite-menu-option ${selected ? 'selected' : ''}`}
                                            onClick={() => toggleFavoriteMenu(menu.id)}
                                        >
                                            <span className="favorite-menu-check">
                                                {selected && <Check size={14} />}
                                            </span>
                                            <span className="favorite-menu-name">{menu.title}</span>
                                            <span className="favorite-menu-id">{menu.id}</span>
                                        </button>
                                    );
                                })
                            )}
                        </div>

                        <div className="favorite-modal-actions">
                            <button className="modal-btn secondary" type="button" onClick={closeFavoriteModal}>
                                취소
                            </button>
                            <button className="modal-btn primary" type="button" onClick={saveFavoriteMenus} disabled={favoriteSaving}>
                                {favoriteSaving ? '저장 중...' : '저장'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HomePage;
