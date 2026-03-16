import React, { useEffect, useMemo, useRef, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import BookingData from "./BookingData";
import AccessManagementPage from "./AccessManagementPage";
import ActivityLogsPage from "./ActivityLogsPage";
import LoginPage from "./LoginPage";
import ProtectedRoute from "./ProtectedRoute";
import { auth, db } from "./firebaseConfig";
import { logAdminActivity } from "./activityLogger";

const SUPER_ADMIN_EMAIL = (import.meta.env.VITE_SUPER_ADMIN_EMAIL ?? "itsvinayprogrammer@gmail.com")
  .trim()
  .toLowerCase();

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isAccessLoading, setIsAccessLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const lastLoggedInEmailRef = useRef<string | null>(null);

  useEffect(() => {
    if (!auth) {
      setIsAuthLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      if (nextUser?.email) {
        const normalizedEmail = nextUser.email.trim().toLowerCase();
        if (lastLoggedInEmailRef.current !== normalizedEmail) {
          lastLoggedInEmailRef.current = normalizedEmail;
          void logAdminActivity({ action: "Logged in", target: "auth" });
        }
      } else {
        lastLoggedInEmailRef.current = null;
      }

      setUser(nextUser);
      setIsAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user?.email) {
      setIsAccessLoading(false);
      setIsAuthorized(false);
      return;
    }

    if (!db) {
      setIsAccessLoading(false);
      setIsAuthorized(false);
      return;
    }

    setIsAccessLoading(true);
    const normalizedEmail = user.email.trim().toLowerCase();
    const userRef = doc(db, "authorized_users", normalizedEmail);

    const unsubscribe = onSnapshot(
      userRef,
      (snapshot) => {
        setIsAuthorized(snapshot.exists());
        setIsAccessLoading(false);
      },
      (error) => {
        console.error("Failed to verify authorized user:", error);
        setIsAuthorized(false);
        setIsAccessLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const handleLogout = async () => {
    if (!auth) {
      return;
    }

    try {
      if (auth.currentUser?.email) {
        await logAdminActivity({ action: "Logged out", target: "auth" });
      }
      await signOut(auth);
    } catch (logoutError) {
      console.error("Logout failed:", logoutError);
    }
  };

  const superAdminEmail = useMemo(() => SUPER_ADMIN_EMAIL, []);
  const isSuperAdmin = !!user?.email && user.email.toLowerCase() === superAdminEmail;
  const hasDashboardAccess = isSuperAdmin || isAuthorized;
  const isRouteLoading = isAuthLoading || isAccessLoading;

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={<LoginPage user={user} isAuthLoading={isAuthLoading} />}
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute
              user={user}
              isLoading={isRouteLoading}
              isAuthorized={hasDashboardAccess}
              onLogout={handleLogout}
            >
              <BookingData onLogout={handleLogout} isSuperAdmin={isSuperAdmin} />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route
          path="/admin-settings"
          element={
            <ProtectedRoute
              user={user}
              isLoading={isRouteLoading}
              isAuthorized={hasDashboardAccess}
              isSuperAdmin={isSuperAdmin}
              requireSuperAdmin
              onLogout={handleLogout}
            >
              <AccessManagementPage onLogout={handleLogout} superAdminEmail={superAdminEmail} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/activity-logs"
          element={
            <ProtectedRoute
              user={user}
              isLoading={isRouteLoading}
              isAuthorized={hasDashboardAccess}
              isSuperAdmin={isSuperAdmin}
              requireSuperAdmin
              redirectPath="/dashboard"
              onLogout={handleLogout}
            >
              <ActivityLogsPage onLogout={handleLogout} isSuperAdmin={isSuperAdmin} />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
