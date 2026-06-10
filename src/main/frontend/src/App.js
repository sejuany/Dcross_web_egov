/**
 * =====================================================
 * App.js - 애플리케이션 라우터 설정 파일 (Refactored)
 * =====================================================
 *
 * [URL 경로 규칙]
 * /{메뉴카테고리}/{컴포넌트명-kebab-case}
 * 예) NewcarList → /newcar/newcar-list
 */
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './components/member/LoginPage';
import Layout from './components/layout/Layout';
import { TabProvider } from './context/TabContext';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import SignupTerm from './components/member/SignupTerm';
import SignForm from './components/member/SignForm';
import './App.css';
import CommonPopupProvider from './components/common/CommonPopupProvider';

// ===== 모듈별 라우트 임포트 =====

function App() {
  return (
    <Router>
      <AuthProvider>
        <TabProvider>
		<CommonPopupProvider>
          <Routes>
		  	<Route path="/" element={<Navigate replace to="/login" />} />
            {/* ===== 공통 (인증 불필요) ===== */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupTerm />} />
            <Route path="/signup-form" element={<SignForm />} />

            {/* ===== 홈 / 대시보드 ===== */}
            <Route path="/*" element={<ProtectedRoute><Layout /></ProtectedRoute>} />

            {/* ===== 모듈별 라우트 그룹 ===== */}
          </Routes>
		  </CommonPopupProvider>
        </TabProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
