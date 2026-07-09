import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from '../components/member/LoginPage';
import WaProtectedRoute from './auth/WaProtectedRoute';
import { WA_HOME_PATH } from './auth/waRouting';
import WaLayout from './layout/WaLayout';
import WaNewcarRequest from './pages/newcar/WaNewcarRequest';
import WaNewcarList from './pages/WaNewcarList';
import WaPayInfo from './pages/WaPayInfo';
import WaPaymentReceipt from './pages/newcar/WaPaymentReceipt';
import WaCompanyManage from './pages/company/WaCompanyManage';

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
		
		<Route
		    path="newcar/receipt/:serviceId"
		    element={(
		        <WaProtectedRoute>
		            <WaPaymentReceipt />
		        </WaProtectedRoute>
		    )}
		/>
            <Route index element={<Navigate replace to="newcar-status" />} />
            <Route path="home" element={<Navigate replace to={WA_HOME_PATH} />} />
            <Route path="newcar-request" element={<WaNewcarRequest />} />
            <Route path="newcar-status" element={<WaNewcarList />} />
            <Route path="payment-status" element={<WaPayInfo />} />
			<Route path="company-manage" element={<WaCompanyManage />} />
            <Route path="*" element={<Navigate replace to="newcar-status" />} />
        </Route>
    </Routes>
);

export default WaRoutes;