import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import WaProtectedRoute from './auth/WaProtectedRoute';
import WaLayout from './layout/WaLayout';
import WaHome from './pages/WaHome';
import WaLoginPage from './pages/WaLoginPage';
import WaNewcarRequest from './pages/WaNewcarRequest';

const WaRoutes = () => (
    <Routes>
        <Route path="login" element={<WaLoginPage />} />
        <Route
            element={(
                <WaProtectedRoute>
                    <WaLayout />
                </WaProtectedRoute>
            )}
        >
            <Route index element={<Navigate replace to="home" />} />
            <Route path="home" element={<WaHome />} />
            <Route path="newcar-request" element={<WaNewcarRequest />} />
            <Route path="*" element={<Navigate replace to="home" />} />
        </Route>
    </Routes>
);

export default WaRoutes;