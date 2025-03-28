import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getCurrentUser } from '../services/authService';

const ProtectedRoute = ({ children }) => {
  const user = getCurrentUser();
  const location = useLocation();
  
  if (!user || !user.token) {
    // Redirect to login if user is not authenticated
    console.log('Protected route - not authenticated, redirecting to login');
    return <Navigate to={`/login?from=${location.pathname}`} replace />;
  }
  
  // Render the protected component if user is authenticated
  return children;
};

export default ProtectedRoute;