import React from 'react';
import { Route } from 'react-router-dom';
import ProtectedRoute from '../components/common/ProtectedRoute';
import Layout from '../components/layout/Layout';

// 번호판관리 components
import NumberPlateList from '../components/numplate/NumberPlateList';
import CarPaperManage from '../components/numplate/CarPaperManage';
import TemporaryNumPlate from '../components/numplate/TemporaryNumPlate';
import NumPlateSupplyManage from '../components/numplate/NumPlateSupplyManage';
import NumPlateSupplyList from '../components/numplate/NumPlateSupplyList';

const NumberPlateRoutes = [
  // 번호판관리
  <Route key="num-list" path="/numplate/number-plate-list" element={<ProtectedRoute><Layout><NumberPlateList /></Layout></ProtectedRoute>} />,
  <Route key="num-paper" path="/numplate/car-paper-manage" element={<ProtectedRoute><Layout><CarPaperManage /></Layout></ProtectedRoute>} />,
  <Route key="num-temp" path="/numplate/temporary-num-plate" element={<ProtectedRoute><Layout><TemporaryNumPlate /></Layout></ProtectedRoute>} />,
  <Route key="num-supply-mng" path="/numplate/num-plate-supply-manage" element={<ProtectedRoute><Layout><NumPlateSupplyManage /></Layout></ProtectedRoute>} />,
  <Route key="num-supply-list" path="/numplate/num-plate-supply-list" element={<ProtectedRoute><Layout><NumPlateSupplyList /></Layout></ProtectedRoute>} />,
];

export default NumberPlateRoutes;
