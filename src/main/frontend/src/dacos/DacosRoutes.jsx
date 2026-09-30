import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import WaPaymentReceipt from '../wa/pages/newcar/WaPaymentReceipt';
import WaPaymentReceiptMulti from '../wa/pages/newcar/WaPaymentReceiptMulti';
import DacosProtectedRoute from './auth/DacosProtectedRoute';
import { DACOS_DEALER_HOME_PATH } from './auth/dacosRouting';
import DacosDealerLayout from './layout/DacosDealerLayout';
import DacosNewcarList from './pages/DacosNewcarList';

const DacosRoutes = () => (
    <Routes>
        <Route
            path="newcar/receipt/multi"
            element={<DacosProtectedRoute><WaPaymentReceiptMulti /></DacosProtectedRoute>}
        />
        <Route
            path="newcar/receipt/:serviceId"
            element={<DacosProtectedRoute><WaPaymentReceipt /></DacosProtectedRoute>}
        />
        <Route element={<DacosProtectedRoute><DacosDealerLayout /></DacosProtectedRoute>}>
            <Route index element={<Navigate replace to={DACOS_DEALER_HOME_PATH} />} />
            <Route path="newcar-status" element={<DacosNewcarList />} />
            <Route path="*" element={<Navigate replace to={DACOS_DEALER_HOME_PATH} />} />
        </Route>
    </Routes>
);

export default DacosRoutes;
