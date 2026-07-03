import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from '../components/member/LoginPage';
import WaProtectedRoute from './auth/WaProtectedRoute';
import { WA_HOME_PATH } from './auth/waRouting';
import WaLayout from './layout/WaLayout';
import WaNewcarRequest from './pages/newcar/WaNewcarRequest';
import WaNewcarList from './pages/WaNewcarList';
import WaComingSoon from './pages/WaComingSoon';

const WaRoutes = () => (
    <Routes>
        <Route path="login" element={<LoginPage />} />
        <Route
            element={(
                <WaProtectedRoute>
                    <WaLayout />
                </WaProtectedRoute>
            )}
        >
            <Route index element={<Navigate replace to="newcar-status" />} />
            <Route path="home" element={<Navigate replace to={WA_HOME_PATH} />} />
            <Route path="newcar-request" element={<WaNewcarRequest />} />
            <Route path="newcar-status" element={<WaNewcarList />} />
            <Route path="payment-status" element={<WaComingSoon title="납부현황" />} />
            <Route path="company-manage" element={<WaComingSoon title="기업관리" />} />
            <Route path="*" element={<Navigate replace to="newcar-status" />} />
        </Route>
    </Routes>
);

export default WaRoutes;