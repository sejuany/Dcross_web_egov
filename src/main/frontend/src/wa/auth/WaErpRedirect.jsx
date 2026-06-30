import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { isWaCompanyUser } from './waRouting';

const WaErpRedirect = ({ children }) => {
    const { user } = useAuth();

    if (isWaCompanyUser(user)) {
        return <Navigate to="/wa/home" replace />;
    }

    return children;
};

export default WaErpRedirect;