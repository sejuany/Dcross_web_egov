import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, MousePointer2, User, Globe, Grid } from 'lucide-react';
import { useTabs } from '../context/TabContext';
import { useAuth } from '../context/AuthContext';
import './HomePage.css';

const HomePage = () => {
    const { addTab } = useTabs();
    const { user } = useAuth();
    const [currentTime, setCurrentTime] = useState(new Date());
    const [ipInfo, setIpInfo] = useState('가져오는 중...');

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);

        // IP 정보 가져오기 (테스트용)
        fetch('https://api.ipify.org?format=json')
            .then(res => res.json())
            .then(data => setIpInfo(data.ip))
            .catch(() => setIpInfo('127.0.0.1 (Local)'));

        return () => clearInterval(timer);
    }, []);

    const favoriteMenus = [
        { id: 1, title: '신규등록신청', path: '/newcar/newcar-request', color: '#007bff' },
        { id: 2, title: '저당설정', path: '#', color: '#28a745' },
        { id: 3, title: '이전등록', path: '#', color: '#ffc107' },
        { id: 4, title: '부가서비스', path: '#', color: '#17a2b8' },
        { id: 5, title: '기본설정', path: '#', color: '#6610f2' },
    ];

    return (
        <div className="home-dashboard">
            <h1 className="dashboard-title">Dashboard Overview</h1>

            <div className="dashboard-grid">
                {/* User Info Widget */}
                <div className="widget info-widget">
                    <div className="widget-header">
                        <User size={20} />
                        <span>로그인 정보</span>
                    </div>
                    <div className="widget-content">
                        <div className="info-row">
                            <span className="label">사용자</span>
                            <span className="value">{user?.MEMBER_NM || '임세준'} ({user?.MEMBER_GB === 'A' ? '관리자' : '사용자'})</span>
                        </div>
                        <div className="info-row">
                            <span className="label">지점 코드</span>
                            <span className="value">{user?.BRANCH_ID || 'IT 개발팀'}</span>
                        </div>
                        <div className="info-row">
                            <span className="label">로그인 시간</span>
                            <span className="value">{currentTime.toLocaleTimeString()}</span>
                        </div>
                    </div>
                </div>

                {/* IP Info Widget */}
                <div className="widget info-widget">
                    <div className="widget-header">
                        <Globe size={20} />
                        <span>시스템 정보</span>
                    </div>
                    <div className="widget-content">
                        <div className="info-row">
                            <span className="label">접속 IP</span>
                            <span className="value">{ipInfo}</span>
                        </div>
                        <div className="info-row">
                            <span className="label">시스템 상태</span>
                            <span className="value status-ok">정상</span>
                        </div>
                        <div className="info-row">
                            <span className="label">현재 버전</span>
                            <span className="value">v1.2.0</span>
                        </div>
                    </div>
                </div>

                {/* Favorite Menu Widget */}
                <div className="widget menu-widget full-width">
                    <div className="widget-header">
                        <Grid size={20} />
                        <span>자주쓰는 메뉴</span>
                    </div>
                    <div className="menu-grid">
                        {favoriteMenus.map(menu => (
                            <div
                                key={menu.id}
                                className="menu-card"
                                onClick={() => menu.path !== '#' && addTab(menu.id.toString(), menu.title, menu.path)}
                            >
                                <div className="menu-icon-box" style={{ backgroundColor: menu.color }}>
                                    <MousePointer2 size={24} color="#fff" />
                                </div>
                                <span className="menu-title">{menu.title}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HomePage;
