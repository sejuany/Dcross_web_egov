import React from 'react';
import { Route } from 'react-router-dom';
import ProtectedRoute from '../components/common/ProtectedRoute';
import Layout from '../components/layout/Layout';

// 신규등록 components
import NewcarRequest from '../components/newcar/NewcarRequest';
import NewcarList from '../components/newcar/NewcarList';
import NewCarGroupRequest from '../components/newcar/NewCarGroupRequest';
import Epayconfirm from '../components/newcar/Epayconfirm';
import NotUsedBond from '../components/newcar/NotUsedBond';

const NewcarRoutes = [
  <Route key="newcar-req" path="/newcar/newcar-request" element={<ProtectedRoute><Layout><NewcarRequest /></Layout></ProtectedRoute>} />,
  <Route key="newcar-list" path="/newcar/newcar-list" element={<ProtectedRoute><Layout><NewcarList /></Layout></ProtectedRoute>} />,
  <Route key="newcar-group" path="/newcar/newcar-group-request" element={<ProtectedRoute><Layout><NewCarGroupRequest /></Layout></ProtectedRoute>} />,
  <Route key="newcar-epay" path="/newcar/epayconfirm" element={<ProtectedRoute><Layout><Epayconfirm /></Layout></ProtectedRoute>} />,
  <Route key="newcar-bond" path="/newcar/not-used-bond" element={<ProtectedRoute><Layout><NotUsedBond /></Layout></ProtectedRoute>} />
];

export default NewcarRoutes;
