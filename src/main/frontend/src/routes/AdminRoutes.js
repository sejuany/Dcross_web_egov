import React from 'react';
import { Route } from 'react-router-dom';
import ProtectedRoute from '../components/common/ProtectedRoute';
import Layout from '../components/layout/Layout';

// 관리자메뉴 components
import CodeManage from '../components/common/CodeManage';
import BoardManage from '../components/common/BoardManage';
import MenuManage from '../components/common/MenuManage';
import LoginLogList from '../components/common/LoginLogList';
import SearchLogList from '../components/common/SearchLogList';
import DataLinkTest from '../components/common/DataLinkTest';
import AccountHistoryList from '../components/common/AccountHistoryList';
import ServerApply from '../components/common/ServerApply';
import AdminTotalList from '../components/common/TotalList';

const AdminRoutes = [
  <Route key="adm-code" path="/admin/code-manage" element={<ProtectedRoute><Layout><CodeManage /></Layout></ProtectedRoute>} />,
  <Route key="adm-board" path="/admin/board-manage" element={<ProtectedRoute><Layout><BoardManage /></Layout></ProtectedRoute>} />,
  <Route key="adm-menu" path="/admin/menu-manage" element={<ProtectedRoute><Layout><MenuManage /></Layout></ProtectedRoute>} />,
  <Route key="adm-login-log" path="/admin/login-log-list" element={<ProtectedRoute><Layout><LoginLogList /></Layout></ProtectedRoute>} />,
  <Route key="adm-search-log" path="/admin/search-log-list" element={<ProtectedRoute><Layout><SearchLogList /></Layout></ProtectedRoute>} />,
  <Route key="adm-datalink" path="/admin/data-link-test" element={<ProtectedRoute><Layout><DataLinkTest /></Layout></ProtectedRoute>} />,
  <Route key="adm-history" path="/admin/account-history" element={<ProtectedRoute><Layout><AccountHistoryList /></Layout></ProtectedRoute>} />,
  <Route key="adm-apply" path="/admin/server-apply" element={<ProtectedRoute><Layout><ServerApply /></Layout></ProtectedRoute>} />,
  <Route key="adm-total" path="/admin/total-list" element={<ProtectedRoute><Layout><AdminTotalList /></Layout></ProtectedRoute>} />
];

export default AdminRoutes;
