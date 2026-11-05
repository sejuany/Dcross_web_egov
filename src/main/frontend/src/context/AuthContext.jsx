/**
 * =====================================================
 * AuthContext.jsx - 로그인 상태 전역 관리
 * =====================================================
 *
 * React Context API를 사용하여 로그인 정보를 앱 전체에서 공유합니다.
 * 어느 컴포넌트에서든 useAuth() 훅으로 사용자 정보에 접근할 수 있습니다.
 *
 * [제공하는 값]
 * - user     : 현재 로그인한 사용자 정보 (null이면 미로그인)
 *              { userId, memberId, memberNm, ... }
 * - login()  : 로그인 처리 함수 (사용자 데이터를 인자로 전달)
 * - logout() : 로그아웃 처리 함수 (자동으로 /login으로 이동)
 *
 * [사용 방법]
 * import { useAuth } from '../../context/AuthContext';
 *
 * const MyComponent = () => {
 *     const { user, logout } = useAuth();
 *     return (
 *         <div>
 *             <span>{user?.memberNm}님 환영합니다</span>
 *             <button onClick={logout}>로그아웃</button>
 *         </div>
 *     );
 * };
 *
 * [세션 만료]
 * - ERP는 1시간, 번호판 앱은 유지 미선택 시 30분 미사용 후 로그아웃됩니다.
 * - 마우스 이동, 클릭, 키보드 입력이 있으면 타이머가 초기화됩니다.
 * - 세션 만료 시간은 TIMEOUT_MS 값을 조정하세요.
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useLocation } from 'react-router-dom';

// Context 생성 (초기값: undefined)
const AuthContext = createContext();

const SESSION_TIMEOUT_MS = 60 * 60 * 1000;
const NUMPLATE_TIMEOUT_MS = 30 * 60 * 1000;
const MAX_TIMEOUT_MS = 2_147_483_647;
const isNumPlateUser = (user) => (user?.login_GB || user?.LOGIN_GB) === 'NUMPLATE_APP';
const readStoredUser = () => {
    try {
        return JSON.parse(sessionStorage.getItem('user') || 'null');
    } catch {
        return null;
    }
};

const getDefaultLogoutRedirect = () => {
    const pathname = window.location.pathname || '';
    // 각 앱은 로그인 주소가 다르므로 로그아웃한 현재 영역의 로그인 화면으로 돌려보낸다.
    if (pathname === '/wa' || pathname.startsWith('/wa/')) return '/wa/login';
    if (pathname === '/numplateapp' || pathname.startsWith('/numplateapp/')) return '/numplateapp/login';
    return '/login';
};

/**
 * useAuth - 로그인 정보를 가져오는 커스텀 훅
 * 컴포넌트 내부에서 const { user, login, logout } = useAuth(); 형태로 사용
 */
export const useAuth = () => useContext(AuthContext);

/**
 * AuthProvider - 앱 전체를 감싸는 인증 상태 제공자
 * App.js에서 <AuthProvider>로 감싸서 사용합니다.
 */
export const AuthProvider = ({ children }) => {

    const { pathname } = useLocation();
    const inNumPlateApp = pathname === '/numplateapp' || pathname.startsWith('/numplateapp/');
    const [sessionWarningOpen, setSessionWarningOpen] = useState(false);
    const [user, setUser] = useState(() => {
        const savedUser = readStoredUser();
        // 번호판 앱은 캐시 대신 서버에서 확인된 세션으로 복원한다.
        return isNumPlateUser(savedUser) ? null : savedUser;
    });
    const [numPlateSession, setNumPlateSession] = useState(null);
    const [numPlateSessionChecked, setNumPlateSessionChecked] = useState(false);
    const [numPlateSessionError, setNumPlateSessionError] = useState('');
    const sessionRequest = useRef(0);
    const loggingOut = useRef(false);
    const numPlateSessionLoading = inNumPlateApp && !numPlateSessionChecked;
    const hasNumPlateUser = isNumPlateUser(user);

    const saveUser = useCallback((userData, sessionPolicy = null) => {
        setUser(userData);
        setSessionWarningOpen(false);
        setNumPlateSession(isNumPlateUser(userData) ? sessionPolicy : null);
        sessionStorage.setItem('user', JSON.stringify(userData));
    }, []);

    const refreshNumPlateSession = useCallback(async () => {
        if (loggingOut.current) return;
        const requestId = ++sessionRequest.current;
        try {
            const response = await fetch('/api/numplateapp/session', {
                credentials: 'same-origin', cache: 'no-store',
            });
            if (requestId !== sessionRequest.current) return;
            if (response.status === 401) {
                setUser((current) => isNumPlateUser(current) ? null : current);
                setNumPlateSession(null);
                if (isNumPlateUser(readStoredUser())) sessionStorage.removeItem('user');
                setNumPlateSessionError('');
                return;
            }
            if (!response.ok) throw new Error('Session check failed');
            const data = await response.json();
            if (requestId !== sessionRequest.current) return;
            if (!isNumPlateUser(data.user) || typeof data.session?.rememberMe !== 'boolean'
                    || (data.session.rememberMe && !Number.isFinite(Date.parse(data.session.expiresAt)))) {
                throw new Error('Invalid session response');
            }
            saveUser(data.user, data.session);
            setNumPlateSessionError('');
        } catch {
            if (requestId === sessionRequest.current) {
                setNumPlateSessionError('로그인 상태를 확인하지 못했습니다. 연결을 확인한 후 다시 시도해 주세요.');
            }
        } finally {
            if (requestId === sessionRequest.current) setNumPlateSessionChecked(true);
        }
    }, [saveUser]);

    const retryNumPlateSession = useCallback(() => {
        setNumPlateSessionChecked(false);
        setNumPlateSessionError('');
        refreshNumPlateSession();
    }, [refreshNumPlateSession]);

    useEffect(() => {
        setNumPlateSessionChecked(false);
        setNumPlateSessionError('');
        if (inNumPlateApp) refreshNumPlateSession();
        return () => { sessionRequest.current += 1; };
    }, [inNumPlateApp, refreshNumPlateSession]);

    /**
     * logout - 로그아웃 처리
     * - user 상태 초기화
     * - localStorage에서 사용자 정보 삭제
     * - 로그인 페이지로 이동
     */
	const logout = useCallback(async (options = {}) => {
        if (loggingOut.current) return;
        loggingOut.current = true;
        sessionRequest.current += 1;
        try {
            await axios.post('/api/logout', {});
        } catch (error) {
            console.error('[AuthContext] logout api failed:', error);
        }

	    setUser(null);
        setNumPlateSession(null);

	    // 로그인 정보 제거
	    sessionStorage.removeItem('user');
	    localStorage.removeItem('user');

	    // 탭/화면 캐시 후보 제거
	    sessionStorage.removeItem('tabs');
	    sessionStorage.removeItem('openTabs');
	    sessionStorage.removeItem('activeTab');
	    sessionStorage.removeItem('tabList');
	    sessionStorage.removeItem('visitedMenus');
	    sessionStorage.removeItem('menuTabs');

	    localStorage.removeItem('tabs');
	    localStorage.removeItem('openTabs');
	    localStorage.removeItem('activeTab');
	    localStorage.removeItem('tabList');
	    localStorage.removeItem('visitedMenus');
	    localStorage.removeItem('menuTabs');

	    if (window.sessionTimeout) {
	        clearTimeout(window.sessionTimeout);
	        window.sessionTimeout = null;
	    }
		
		if (window.sessionWarningTimeout) {
		    clearTimeout(window.sessionWarningTimeout);
		    window.sessionWarningTimeout = null;
		}
		
        const redirectTo = options.redirectTo || getDefaultLogoutRedirect();

        window.location.replace(redirectTo);
	}, []);

    useEffect(() => {
        if (!user) return undefined;

        let handled = false;
        const interceptorId = axios.interceptors.response.use(
            response => response,
            async error => {
                const path = (error.config?.url || '').split('?')[0];
                const isNumPlateAuthAttempt = path === '/api/numplateapp/login'
                    || path.startsWith('/api/numplateapp/passkeys/');
                if (error.response?.status === 401 && !handled && !isNumPlateAuthAttempt) {
                    handled = true;
                    window.alert('로그인 세션이 만료되었습니다. 다시 로그인해 주세요.');
                    await logout();
                }

                return Promise.reject(error);
            }
        );

        return () => axios.interceptors.response.eject(interceptorId);
    }, [user, logout]);

    /**
     * login - 로그인 성공 시 호출
     * @param {object} userData - 서버에서 받은 사용자 정보
     */

    const login = useCallback((userData, sessionPolicy = null) => {
        sessionRequest.current += 1;
        saveUser(userData, sessionPolicy);
        setNumPlateSessionChecked(true);
        setNumPlateSessionError('');
    }, [saveUser]);

    /**
     * resetTimer - 세션 만료 타이머 초기화
     * 사용자 활동(마우스, 키보드 등)이 감지되면 호출됩니다.
     */
	const resetTimer = useCallback(() => {
	    if (window.sessionWarningTimeout) clearTimeout(window.sessionWarningTimeout);
	    if (window.sessionTimeout) clearTimeout(window.sessionTimeout);


	    setSessionWarningOpen(false);
        if (isNumPlateUser(user) && numPlateSession?.rememberMe) return;
        const timeout = isNumPlateUser(user) ? NUMPLATE_TIMEOUT_MS : SESSION_TIMEOUT_MS;

	    window.sessionWarningTimeout = setTimeout(() => {
	        setSessionWarningOpen(true);
	    }, timeout - 60 * 1000);

	    window.sessionTimeout = setTimeout(() => {
	        setSessionWarningOpen(false);
	        alert('세션이 만료되었습니다. 다시 로그인해 주세요.');
	        logout();
	    }, timeout);
	}, [logout, user, numPlateSession?.rememberMe]);

    /**
     * useEffect - 로그인 상태일 때 사용자 활동 감지 이벤트 등록
     * 로그아웃 시 이벤트 리스너 자동 제거
     */
    useEffect(() => {
        if (user && !(isNumPlateUser(user) && numPlateSession?.rememberMe)) {
            // 이 이벤트들이 발생하면 세션 타이머를 초기화합니다
            const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
            const handleActivity = () => resetTimer();

            events.forEach(event => document.addEventListener(event, handleActivity));
            resetTimer(); // 로그인 직후 타이머 시작

            // 컴포넌트 언마운트 시 이벤트 리스너 정리 (메모리 누수 방지)
			return () => {
			    events.forEach(event => document.removeEventListener(event, handleActivity));
			    if (window.sessionWarningTimeout) clearTimeout(window.sessionWarningTimeout);
			    if (window.sessionTimeout) clearTimeout(window.sessionTimeout);
			};
        }

    }, [user, numPlateSession?.rememberMe, resetTimer]);

    useEffect(() => {
        if (!inNumPlateApp || !hasNumPlateUser) return undefined;
        const checkVisibleSession = () => {
            if (document.visibilityState !== 'hidden') refreshNumPlateSession();
        };
        window.addEventListener('focus', checkVisibleSession);
        document.addEventListener('visibilitychange', checkVisibleSession);
        return () => {
            window.removeEventListener('focus', checkVisibleSession);
            document.removeEventListener('visibilitychange', checkVisibleSession);
        };
    }, [inNumPlateApp, hasNumPlateUser, refreshNumPlateSession]);

    useEffect(() => {
        if (!inNumPlateApp || !hasNumPlateUser || !numPlateSession?.rememberMe) return undefined;
        let timer;
        const checkDeadline = () => {
            const remaining = Date.parse(numPlateSession.expiresAt) - Date.now();
            if (remaining <= 0) {
                refreshNumPlateSession();
            } else {
                timer = setTimeout(checkDeadline, Math.min(remaining, MAX_TIMEOUT_MS));
            }
        };
        checkDeadline();
        return () => clearTimeout(timer);
    }, [inNumPlateApp, hasNumPlateUser, numPlateSession?.rememberMe, numPlateSession?.expiresAt, refreshNumPlateSession]);

    // Context로 제공할 값: user(사용자 정보), login(로그인), logout(로그아웃)
    return (
        <AuthContext.Provider value={{ user, login, logout, sessionWarningOpen, setSessionWarningOpen,
            numPlateSessionLoading, numPlateSessionError, retryNumPlateSession }}>
            {children}
        </AuthContext.Provider>
    );
};
