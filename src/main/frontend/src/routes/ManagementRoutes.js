import React from 'react';
import { Route } from 'react-router-dom';
import ProtectedRoute from '../components/common/ProtectedRoute';
import Layout from '../components/layout/Layout';

// 납부관리 components
import PayInfo from '../components/payment/PayInfo';
import TvbankManage from '../components/payment/TvbankManage';
import SellingInfo from '../components/payment/SellingInfo';
import PointManage from '../components/payment/PointManage';
import NotPayInfo from '../components/payment/NotPayInfo';
import PayReturnInfo from '../components/payment/PayReturnInfo';
import InjiseManage from '../components/payment/InjiseManage';
import EPayInfo from '../components/payment/EPayInfo';
import PaymentTotalList from '../components/payment/TotalList';

const ManagementRoutes = [
  // 납부관리
  <Route key="pay-info" path="/payment/pay-info" element={<ProtectedRoute><Layout><PayInfo /></Layout></ProtectedRoute>} />,
  <Route key="pay-tvbank" path="/payment/tvbank-manage" element={<ProtectedRoute><Layout><TvbankManage /></Layout></ProtectedRoute>} />,
  <Route key="pay-selling" path="/payment/selling-info" element={<ProtectedRoute><Layout><SellingInfo /></Layout></ProtectedRoute>} />,
  <Route key="pay-point" path="/payment/point-manage" element={<ProtectedRoute><Layout><PointManage /></Layout></ProtectedRoute>} />,
  <Route key="pay-notpay" path="/payment/not-pay-info" element={<ProtectedRoute><Layout><NotPayInfo /></Layout></ProtectedRoute>} />,
  <Route key="pay-return" path="/payment/pay-return-info" element={<ProtectedRoute><Layout><PayReturnInfo /></Layout></ProtectedRoute>} />,
  <Route key="pay-injise" path="/payment/injise-manage" element={<ProtectedRoute><Layout><InjiseManage /></Layout></ProtectedRoute>} />,
  <Route key="pay-epay" path="/payment/epay-info" element={<ProtectedRoute><Layout><EPayInfo /></Layout></ProtectedRoute>} />,
  <Route key="pay-total" path="/payment/total-list" element={<ProtectedRoute><Layout><PaymentTotalList /></Layout></ProtectedRoute>} />,
];

export default ManagementRoutes;
