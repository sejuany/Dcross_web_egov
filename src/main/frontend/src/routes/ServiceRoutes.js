import React from 'react';
import { Route } from 'react-router-dom';
import ProtectedRoute from '../components/common/ProtectedRoute';
import Layout from '../components/layout/Layout';

// 부가서비스 components
import WonbuScrapRequest from '../components/addservice/WonbuScrapRequest';
import CarMileageList from '../components/addservice/CarMileageList';
import Car365priceList from '../components/addservice/Car365priceList';
import InsuranceManage from '../components/addservice/InsuranceManage';
import CarSise from '../components/addservice/CarSise';
import CarZenMapping from '../components/addservice/CarZenMapping';

const ServiceRoutes = [
  <Route key="srv-wonbu-scrap" path="/addservice/wonbu-scrap-request" element={<ProtectedRoute><Layout><WonbuScrapRequest /></Layout></ProtectedRoute>} />,
  <Route key="srv-mileage" path="/addservice/car-mileage-list" element={<ProtectedRoute><Layout><CarMileageList /></Layout></ProtectedRoute>} />,
  <Route key="srv-365price" path="/addservice/car365-price-list" element={<ProtectedRoute><Layout><Car365priceList /></Layout></ProtectedRoute>} />,
  <Route key="srv-insurance" path="/addservice/insurance-manage" element={<ProtectedRoute><Layout><InsuranceManage /></Layout></ProtectedRoute>} />,
  <Route key="srv-sise" path="/addservice/car-sise" element={<ProtectedRoute><Layout><CarSise /></Layout></ProtectedRoute>} />,
  <Route key="srv-zen" path="/addservice/car-zen-mapping" element={<ProtectedRoute><Layout><CarZenMapping /></Layout></ProtectedRoute>} />
];

export default ServiceRoutes;
