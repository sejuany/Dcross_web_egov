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

// 기업관리 components
import CompanyManage from '../components/company/CompanyManage';
import CompanyUserManage from '../components/company/CompanyUserManage';
import NumplateDeliveryManage from '../components/company/NumplateDeliveryManage';
import CompanyNew from '../components/company/CompanyNew';

const ManagementRoutes = [
  // 번호판관리
  <Route key="num-list" path="/numplate/number-plate-list" element={<ProtectedRoute><Layout><NumberPlateList /></Layout></ProtectedRoute>} />,
  <Route key="num-paper" path="/numplate/car-paper-manage" element={<ProtectedRoute><Layout><CarPaperManage /></Layout></ProtectedRoute>} />,
  <Route key="num-temp" path="/numplate/temporary-num-plate" element={<ProtectedRoute><Layout><TemporaryNumPlate /></Layout></ProtectedRoute>} />,
  <Route key="num-supply-mng" path="/numplate/num-plate-supply-manage" element={<ProtectedRoute><Layout><NumPlateSupplyManage /></Layout></ProtectedRoute>} />,
  <Route key="num-supply-list" path="/numplate/num-plate-supply-list" element={<ProtectedRoute><Layout><NumPlateSupplyList /></Layout></ProtectedRoute>} />,

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

  // 기업관리
  <Route key="comp-mng" path="/company/company-manage" element={<ProtectedRoute><Layout><CompanyManage /></Layout></ProtectedRoute>} />,
  <Route key="comp-user" path="/company/company-user-manage" element={<ProtectedRoute><Layout><CompanyUserManage /></Layout></ProtectedRoute>} />,
  <Route key="comp-deliv" path="/company/numplate-delivery-manage" element={<ProtectedRoute><Layout><NumplateDeliveryManage /></Layout></ProtectedRoute>} />,
  <Route key="comp-new" path="/company/company-new" element={<ProtectedRoute><Layout><CompanyNew /></Layout></ProtectedRoute>} />
];

export default ManagementRoutes;
