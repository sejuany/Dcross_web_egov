import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * ProtectedRoute - 로그인이 필요한 화면을 보호하는 컴포넌트
 * 로그인되지 않은 상태에서 접근하면 자동으로 /login 으로 이동합니다.
 */
const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

export default ProtectedRoute;
