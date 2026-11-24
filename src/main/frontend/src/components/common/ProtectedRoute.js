import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { isImageManagementUser, numPlateHome } from '../numplateapp/numplateAuth';

/**
 * ProtectedRoute - ERP route guard.
 */
const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (isImageManagementUser(user)) return <Navigate to={numPlateHome(user)} replace />;
  return children;
};

export default ProtectedRoute;
