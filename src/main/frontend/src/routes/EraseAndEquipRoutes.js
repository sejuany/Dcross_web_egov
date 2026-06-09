import React from 'react';
import { Route } from 'react-router-dom';
import ProtectedRoute from '../components/common/ProtectedRoute';
import Layout from '../components/layout/Layout';

// 저당말소 components
import MortErsRequest from '../components/mortgageerase/MortErsRequest';
import MortErsList from '../components/mortgageerase/MortErsList';
import MortErsGroupRequest from '../components/mortgageerase/MortErsGroupRequest';

// 건설기계 components
import CeMortRegRequest from '../components/constructequip/CeMortRegRequest';
import CeMortRegList from '../components/constructequip/CeMortRegList';
import CeMortErsRequest from '../components/constructequip/CeMortErsRequest';
import CeMortErsList from '../components/constructequip/CeMortErsList';
import CeMortErsGroupRequest from '../components/constructequip/CeMortErsGroupRequest';

const EraseAndEquipRoutes = [
  // 저당말소
  <Route key="mort-ers-req" path="/mortgageerase/mort-ers-request" element={<ProtectedRoute><Layout><MortErsRequest /></Layout></ProtectedRoute>} />,
  <Route key="mort-ers-list" path="/mortgageerase/mort-ers-list" element={<ProtectedRoute><Layout><MortErsList /></Layout></ProtectedRoute>} />,
  <Route key="mort-ers-group" path="/mortgageerase/mort-ers-group-request" element={<ProtectedRoute><Layout><MortErsGroupRequest /></Layout></ProtectedRoute>} />,

  // 건설기계
  <Route key="ce-reg-req" path="/constructequip/ce-mort-reg-request" element={<ProtectedRoute><Layout><CeMortRegRequest /></Layout></ProtectedRoute>} />,
  <Route key="ce-reg-list" path="/constructequip/ce-mort-reg-list" element={<ProtectedRoute><Layout><CeMortRegList /></Layout></ProtectedRoute>} />,
  <Route key="ce-ers-req" path="/constructequip/ce-mort-ers-request" element={<ProtectedRoute><Layout><CeMortErsRequest /></Layout></ProtectedRoute>} />,
  <Route key="ce-ers-list" path="/constructequip/ce-mort-ers-list" element={<ProtectedRoute><Layout><CeMortErsList /></Layout></ProtectedRoute>} />,
  <Route key="ce-ers-group" path="/constructequip/ce-mort-ers-group" element={<ProtectedRoute><Layout><CeMortErsGroupRequest /></Layout></ProtectedRoute>} />
];

export default EraseAndEquipRoutes;
