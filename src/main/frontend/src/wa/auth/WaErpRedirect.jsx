import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { isWaCompanyUser, WA_HOME_PATH } from './waRouting';

const WaErpRedirect = ({ children }) => {
    const { user } = useAuth();

    if (isWaCompanyUser(user)) {
        return <Navigate to={WA_HOME_PATH} replace />;
    }

    return children;
};

export default WaErpRedirect;