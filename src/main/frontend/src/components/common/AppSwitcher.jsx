import React from 'react';
import { NavLink } from 'react-router-dom';
import { isDacosUser, DACOS_DEALER_HOME_PATH } from '../../dacos/auth/dacosRouting';
import { useAuth } from '../../context/AuthContext';
import './AppSwitcher.css';

const AppSwitcher = ({ currentApp, logoSrc, logoClassName = '', onWebDacosClick }) => {
    const { user } = useAuth();

    if (!isDacosUser(user)) {
        return (
            <NavLink to="/home" className="app-switcher-logo-link" onClick={onWebDacosClick}>
                <img src={logoSrc} alt="DACOS" className={logoClassName} />
            </NavLink>
        );
    }

    return (
        <div className="app-switcher">
            <button type="button" className="app-switcher-trigger" aria-label="시스템 전환 메뉴">
                <img src={logoSrc} alt="DACOS" className={logoClassName} />
            </button>
            <div className="app-switcher-menu">
                <NavLink className={currentApp === 'dealer' ? 'active' : ''} to={DACOS_DEALER_HOME_PATH}>
                    딜러시스템
                </NavLink>
                <NavLink className={currentApp === 'web' ? 'active' : ''} to="/home" onClick={onWebDacosClick}>
                    웹 다코스
                </NavLink>
            </div>
        </div>
    );
};

export default AppSwitcher;
