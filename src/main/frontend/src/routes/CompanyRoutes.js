import React from 'react';
import { Route } from 'react-router-dom';
import ProtectedRoute from '../components/common/ProtectedRoute';
import Layout from '../components/layout/Layout';

// 기업관리 components
import CompanyManage from '../components/company/CompanyManage';
import CompanyUserManage from '../components/company/CompanyUserManage';
import NumplateDeliveryManage from '../components/company/NumplateDeliveryManage';
import CompanyNew from '../components/company/CompanyNew';

const CompanyRoutes = [
  // 기업관리
  <Route key="comp-mng" path="/company/company-manage" element={<ProtectedRoute><Layout><CompanyManage /></Layout></ProtectedRoute>} />,
  <Route key="comp-user" path="/company/company-user-manage" element={<ProtectedRoute><Layout><CompanyUserManage /></Layout></ProtectedRoute>} />,
  <Route key="comp-deliv" path="/company/numplate-delivery-manage" element={<ProtectedRoute><Layout><NumplateDeliveryManage /></Layout></ProtectedRoute>} />,
  <Route key="comp-new" path="/company/company-new" element={<ProtectedRoute><Layout><CompanyNew /></Layout></ProtectedRoute>} />
];

export default CompanyRoutes;