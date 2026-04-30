import React from 'react';
import { Route } from 'react-router-dom';
import ProtectedRoute from '../components/common/ProtectedRoute';
import Layout from '../components/layout/Layout';

// 저당설정 components
import MortgageRegistration from '../components/mortgage/MortgageRegistration';
import MortRegRequest from '../components/mortgage/MortRegRequest';
import MortRegList from '../components/mortgage/MortRegList';
import BeforehandDsign from '../components/mortgage/BeforehandDsign';
import MortRegConfirmList from '../components/mortgage/MortRegConfirmList';
import RegistConfirm from '../components/mortgage/RegistConfirm';
import MortChange from '../components/mortgage/MortChange';
import MortChangeList from '../components/mortgage/MortChangeList';
import CorrectionInfo from '../components/mortgage/CorrectionInfo';
import DelayList from '../components/mortgage/DelayList';

const MortgageRoutes = [
  <Route key="mort-reg" path="/mortgage/registration" element={<ProtectedRoute><Layout><MortgageRegistration /></Layout></ProtectedRoute>} />,
  <Route key="mort-reg-req" path="/mortgage/mort-reg-request" element={<ProtectedRoute><Layout><MortRegRequest /></Layout></ProtectedRoute>} />,
  <Route key="mort-reg-list" path="/mortgage/mort-reg-list" element={<ProtectedRoute><Layout><MortRegList /></Layout></ProtectedRoute>} />,
  <Route key="mort-before-dsign" path="/mortgage/beforehand-dsign" element={<ProtectedRoute><Layout><BeforehandDsign /></Layout></ProtectedRoute>} />,
  <Route key="mort-reg-confirm" path="/mortgage/mort-reg-confirm" element={<ProtectedRoute><Layout><MortRegConfirmList /></Layout></ProtectedRoute>} />,
  <Route key="mort-regist-confirm" path="/mortgage/regist-confirm" element={<ProtectedRoute><Layout><RegistConfirm /></Layout></ProtectedRoute>} />,
  <Route key="mort-change" path="/mortgage/mort-change" element={<ProtectedRoute><Layout><MortChange /></Layout></ProtectedRoute>} />,
  <Route key="mort-change-list" path="/mortgage/mort-change-list" element={<ProtectedRoute><Layout><MortChangeList /></Layout></ProtectedRoute>} />,
  <Route key="mort-correction" path="/mortgage/correction-info" element={<ProtectedRoute><Layout><CorrectionInfo /></Layout></ProtectedRoute>} />,
  <Route key="mort-delay-list" path="/mortgage/delay-list" element={<ProtectedRoute><Layout><DelayList /></Layout></ProtectedRoute>} />
];

export default MortgageRoutes;
