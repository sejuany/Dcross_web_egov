import React from 'react';
import { Route } from 'react-router-dom';
import ProtectedRoute from '../components/common/ProtectedRoute';
import Layout from '../components/layout/Layout';

import CompanyUserManage from '../components/company/CompanyUserManage';

const CompanyRoutes = (
    <>
        <Route
            path="/company/company-user-manage"
            element={
                <ProtectedRoute>
                    <Layout>
                        <CompanyUserManage />
                    </Layout>
                </ProtectedRoute>
            }
        />
    </>
);

export default CompanyRoutes;