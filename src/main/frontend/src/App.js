import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './components/member/LoginPage';
import Layout from './components/layout/Layout';
import { TabProvider } from './context/TabContext';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import SignupTerm from './components/member/SignupTerm';
import SignForm from './components/member/SignForm';
import WaRoutes from './wa/WaRoutes';
import WaErpRedirect from './wa/auth/WaErpRedirect';
import CustomerRoutes from './customer/CustomerRoutes';
import './App.css';
import CommonPopupProvider from './components/common/CommonPopupProvider';
import Policy from './components/member/Policy';
import NumPlateAppRoutes from './components/numplateapp/NumPlateAppRoutes';
import WaNewcarGuide from './guide/WaNewcarGuide';

function App() {
  return (
    <Router>
      <AuthProvider>
        <CommonPopupProvider>
          <Routes>
            <Route path="/" element={<Navigate replace to="/login" />} />
            <Route path="/login" element={<LoginPage />} />
			{/* 개인정보 처리방침 */}
			<Route path="/policy" element={<Policy />} />
			<Route path="/guide/wa-newcar" element={<WaNewcarGuide />} />
            <Route path="/wa/*" element={<WaRoutes />} />
            <Route path="/signup" element={<SignupTerm />} />
            <Route path="/signup-form" element={<SignForm />} />
			{/* 고객용 업로드 페이지 */}
			<Route path="/customer/*" element={<CustomerRoutes />} />
			{/* 일반 ERP 로그인과 분리된 모바일 번호판 앱 라우트 */}
			<Route path="/numplateapp/*" element={<NumPlateAppRoutes />} />

            <Route
              path="/*"
              element={(
                <WaErpRedirect>
                  <TabProvider>
                    <ProtectedRoute>
                      <Layout />
                    </ProtectedRoute>
                  </TabProvider>
                </WaErpRedirect>
              )}
            />
          </Routes>
        </CommonPopupProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
