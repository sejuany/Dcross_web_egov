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
import Dashboard from './components/dashboard/Dashboard';
import HomePage from './pages/HomePage';
import { TabProvider } from './context/TabContext';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import './App.css';

// ===== 모듈별 라우트 임포트 =====
import MortgageRoutes from './routes/MortgageRoutes';
import EraseAndEquipRoutes from './routes/EraseAndEquipRoutes';
import NewcarRoutes from './routes/NewcarRoutes';
import TrnsnameRoutes from './routes/TrnsnameRoutes';
import ServiceRoutes from './routes/ServiceRoutes';
import ManagementRoutes from './routes/ManagementRoutes';
import AdminRoutes from './routes/AdminRoutes';
import MemberRoutes from './routes/MemberRoutes';

function App() {
  return (
    <Router>
      <AuthProvider>
        <TabProvider>
          <Routes>
            {/* ===== 기본 경로 → 로그인 리다이렉트 ===== */}
            <Route path="/" element={<Navigate to="/login" replace />} />

            {/* ===== 공통 (인증 불필요) ===== */}
            <Route path="/login" element={<LoginPage />} />

            {/* ===== 홈 / 대시보드 ===== */}
            <Route path="/home" element={<ProtectedRoute><Layout><HomePage /></Layout></ProtectedRoute>} />
            <Route path="/registration" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />

            {/* ===== 모듈별 라우트 그룹 ===== */}
            {MortgageRoutes}
            {EraseAndEquipRoutes}
            {NewcarRoutes}
            {TrnsnameRoutes}
            {ServiceRoutes}
            {ManagementRoutes}
            {AdminRoutes}
            {MemberRoutes}

          </Routes>
        </TabProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;