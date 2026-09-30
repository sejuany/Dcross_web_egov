import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { isDacosUser } from './dacosRouting';

const DacosProtectedRoute = ({ children }) => {
    const { user } = useAuth();

    if (!user) return <Navigate to="/login" replace />;
    if (!isDacosUser(user)) return <Navigate to="/home" replace />;

    return children;
};

export default DacosProtectedRoute;
