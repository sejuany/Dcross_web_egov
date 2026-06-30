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
import './App.css';
import CommonPopupProvider from './components/common/CommonPopupProvider';

function App() {
  return (
    <Router>
      <AuthProvider>
        <CommonPopupProvider>
          <Routes>
            <Route path="/" element={<Navigate replace to="/login" />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/wa/*" element={<WaRoutes />} />
            <Route path="/signup" element={<SignupTerm />} />
            <Route path="/signup-form" element={<SignForm />} />

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
