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
 * - 30분 동안 아무 활동이 없으면 자동으로 로그아웃됩니다.
 * - 마우스 이동, 클릭, 키보드 입력이 있으면 타이머가 초기화됩니다.
 * - 세션 만료 시간은 TIMEOUT_MS 값을 조정하세요.
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

// Context 생성 (초기값: undefined)
const AuthContext = createContext();

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
    // user 상태: 새로고침해도 유지되도록 localStorage에서 초기값 로드
    const [user, setUser] = useState(() => {
        const savedUser = localStorage.getItem('user');
        return savedUser ? JSON.parse(savedUser) : null;
    });
    const navigate = useNavigate();

    // 세션 만료 시간: 30분 (밀리초)
    // 변경하려면 이 값을 수정하세요 (예: 60 * 60 * 1000 = 1시간)
    const TIMEOUT_MS = 30 * 60 * 1000;

    /**
     * logout - 로그아웃 처리
     * - user 상태 초기화
     * - localStorage에서 사용자 정보 삭제
     * - 로그인 페이지로 이동
     */
    const logout = useCallback(() => {
        setUser(null);
        localStorage.removeItem('user');
        navigate('/login');
    }, [navigate]);

    /**
     * login - 로그인 성공 시 호출
     * @param {object} userData - 서버에서 받은 사용자 정보
     */
    const login = (userData) => {
        console.log('AuthContext: Setting user data', userData);
        setUser(userData);
        // 새로고침해도 로그인 상태 유지를 위해 localStorage에 저장
        localStorage.setItem('user', JSON.stringify(userData));
        resetTimer(); // 세션 타이머 시작
    };

    /**
     * resetTimer - 세션 만료 타이머 초기화
     * 사용자 활동(마우스, 키보드 등)이 감지되면 호출됩니다.
     */
    const resetTimer = useCallback(() => {
        if (window.sessionTimeout) clearTimeout(window.sessionTimeout);
        window.sessionTimeout = setTimeout(() => {
            alert('세션이 만료되었습니다. 다시 로그인해 주세요.');
            logout();
        }, TIMEOUT_MS);
    }, [logout]);

    /**
     * useEffect - 로그인 상태일 때 사용자 활동 감지 이벤트 등록
     * 로그아웃 시 이벤트 리스너 자동 제거
     */
    useEffect(() => {
        if (user) {
            // 이 이벤트들이 발생하면 세션 타이머를 초기화합니다
            const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
            const handleActivity = () => resetTimer();

            events.forEach(event => document.addEventListener(event, handleActivity));
            resetTimer(); // 로그인 직후 타이머 시작

            // 컴포넌트 언마운트 시 이벤트 리스너 정리 (메모리 누수 방지)
            return () => {
                events.forEach(event => document.removeEventListener(event, handleActivity));
                if (window.sessionTimeout) clearTimeout(window.sessionTimeout);
            };
        }
    }, [user, resetTimer]);

    // Context로 제공할 값: user(사용자 정보), login(로그인), logout(로그아웃)
    return (
        <AuthContext.Provider value={{ user, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
