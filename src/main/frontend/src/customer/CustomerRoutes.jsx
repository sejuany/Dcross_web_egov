import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import CustomerLayout from './components/CustomerLayout';

// pages 폴더의 jsx 자동 등록
const pages = require.context('./pages', false, /\.jsx$/);

const CustomerRoutes = () => {

    const routes = pages.keys().map((key) => {

        const Component = pages(key).default;
        const name = key.replace('./', '').replace('.jsx', '');

        return (
            <Route
                key={name}
                path={name}
                element={<Component />}
            />
        );
    });

    return (
        <Routes>

            <Route
                element={<CustomerLayout />}
            >

                <Route
                    index
                    element={<Navigate replace to="CustomerSign" />}
                />

                {routes}

                <Route
                    path="*"
                    element={<Navigate replace to="CustomerSign" />}
                />

            </Route>

        </Routes>
    );
};

export default CustomerRoutes;