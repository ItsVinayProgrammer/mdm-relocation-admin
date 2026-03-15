import React from "react";
import { Navigate } from "react-router-dom";
import { type User } from "firebase/auth";
import AccessDeniedPage from "./AccessDeniedPage";
import AuthLoadingScreen from "./AuthLoadingScreen";

interface ProtectedRouteProps {
  user: User | null;
  isLoading: boolean;
  isAuthorized: boolean;
  isSuperAdmin?: boolean;
  requireSuperAdmin?: boolean;
  onLogout: () => Promise<void>;
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  user,
  isLoading,
  isAuthorized,
  isSuperAdmin = false,
  requireSuperAdmin = false,
  onLogout,
  children,
}) => {
  if (isLoading) {
    return <AuthLoadingScreen message="Verifying access permissions..." />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isAuthorized) {
    return <AccessDeniedPage email={user.email ?? "Unknown account"} onLogout={onLogout} />;
  }

  if (requireSuperAdmin && !isSuperAdmin) {
    return <AccessDeniedPage email={user.email ?? "Unknown account"} onLogout={onLogout} />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
