import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { isWaCompanyUser } from './waRouting';

const WaProtectedRoute = ({ children }) => {
    const { user } = useAuth();

    if (!user) {
        return <Navigate to="/wa/login" replace />;
    }

    if (!isWaCompanyUser(user)) {
        return <Navigate to="/home" replace />;
    }

    return children;
};

export default WaProtectedRoute;