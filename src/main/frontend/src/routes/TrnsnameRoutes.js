import React from 'react';
import { Route } from 'react-router-dom';
import ProtectedRoute from '../components/common/ProtectedRoute';
import Layout from '../components/layout/Layout';

// 이전등록 components
import TrnsNameRequest from '../components/trnsname/TrnsNameRequest';
import TrnsNameList from '../components/trnsname/TrnsNameList';
import TotalGroupRequest from '../components/trnsname/TotalGroupRequest';
import CarpRequestList from '../components/trnsname/CarpRequestList';
import TrnsNumChangeList from '../components/trnsname/TrnsNumChangeList';
import OfflineList from '../components/trnsname/OfflineList';

const TrnsnameRoutes = [
  <Route key="trns-req" path="/trnsname/trnsname-request" element={<ProtectedRoute><Layout><TrnsNameRequest /></Layout></ProtectedRoute>} />,
  <Route key="trns-list" path="/trnsname/trnsname-list" element={<ProtectedRoute><Layout><TrnsNameList /></Layout></ProtectedRoute>} />,
  <Route key="trns-group" path="/trnsname/total-group-request" element={<ProtectedRoute><Layout><TotalGroupRequest /></Layout></ProtectedRoute>} />,
  <Route key="trns-carp" path="/trnsname/carp-request-list" element={<ProtectedRoute><Layout><CarpRequestList /></Layout></ProtectedRoute>} />,
  <Route key="trns-num" path="/trnsname/trns-num-change" element={<ProtectedRoute><Layout><TrnsNumChangeList /></Layout></ProtectedRoute>} />,
  <Route key="trns-off" path="/trnsname/offline-list" element={<ProtectedRoute><Layout><OfflineList /></Layout></ProtectedRoute>} />
];

export default TrnsnameRoutes;
