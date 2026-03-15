import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
  type User,
} from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { auth, firebaseConfigError, googleProvider } from "./firebaseConfig";
import AuthLoadingScreen from "./AuthLoadingScreen";

interface LoginPageProps {
  user: User | null;
  isAuthLoading: boolean;
}

const LoginPage: React.FC<LoginPageProps> = ({ user, isAuthLoading }) => {
  const [error, setError] = useState<string | null>(firebaseConfigError);
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    if (!auth) {
      return;
    }

    let isMounted = true;

    const readRedirectResult = async () => {
      try {
        const result = await getRedirectResult(auth!);
        if (!isMounted || !result) {
          return;
        }

        setError(null);
      } catch (redirectError) {
        console.error("Redirect sign-in failed:", redirectError);
        if (!isMounted) {
          return;
        }

        const authCode = redirectError instanceof FirebaseError ? redirectError.code : undefined;
        setError(getFriendlyAuthError(authCode));
      } finally {
        if (isMounted) {
          setIsSigningIn(false);
        }
      }
    };

    void readRedirectResult();

    return () => {
      isMounted = false;
    };
  }, []);

  if (isAuthLoading) {
    return <AuthLoadingScreen />;
  }

  if (user?.email) {
    return <Navigate to="/" replace />;
  }

  const getFriendlyAuthError = (code?: string): string => {
    if (!code) {
      return "Google sign-in failed. Please try again.";
    }

    if (code === "auth/operation-not-allowed") {
      return "Google sign-in is disabled in Firebase Console. Enable Google provider under Authentication > Sign-in method.";
    }

    if (code === "auth/unauthorized-domain") {
      return "This domain is not authorized. Add localhost to Firebase Authentication > Settings > Authorized domains.";
    }

    if (code === "auth/popup-closed-by-user") {
      return "Sign-in popup was closed before completion. Please try again.";
    }

    if (code === "auth/popup-blocked") {
      return "Popup was blocked by the browser. Retrying with redirect sign-in...";
    }

    return `Google sign-in failed (${code}).`;
  };

  const handleGoogleSignIn = async () => {
    if (!auth) {
      setError("Firebase Auth is not configured. Please set VITE_FIREBASE_* env values.");
      return;
    }

    try {
      setError(null);
      setIsSigningIn(true);
      await signInWithPopup(auth, googleProvider);
    } catch (signInError) {
      console.error("Google sign-in failed:", signInError);
      const authCode = signInError instanceof FirebaseError ? signInError.code : undefined;

      if (authCode === "auth/popup-blocked" || authCode === "auth/cancelled-popup-request") {
        try {
          setError("Popup was blocked. Continuing with redirect sign-in...");
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectError) {
          console.error("Redirect fallback failed:", redirectError);
          const redirectCode = redirectError instanceof FirebaseError ? redirectError.code : undefined;
          setError(getFriendlyAuthError(redirectCode));
        }
      } else {
        setError(getFriendlyAuthError(authCode));
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#fff8ef] px-6 py-10">
      <div className="absolute -left-20 -top-24 h-64 w-64 rounded-full bg-[#800000]/10 blur-3xl" />
      <div className="absolute -bottom-20 -right-16 h-64 w-64 rounded-full bg-[#ffb000]/25 blur-3xl" />

      <div className="relative w-full max-w-md rounded-3xl border border-[#ffd98a] bg-white/95 p-8 shadow-2xl shadow-[#800000]/15 backdrop-blur">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#800000]">MDM Relocation</p>
        <h1 className="mt-2 text-3xl font-extrabold text-[#800000]">Booking Data Analytics</h1>
        <p className="mt-3 text-sm leading-6 text-[#6b1b1b]">
          Sign in with your authorized Google account to access the admin dashboard.
        </p>
        <p className="mt-2 text-xs text-[#8c3b3b]">
          Sign-in uses Google popup first, with redirect fallback if the browser blocks popups.
        </p>

        {error && (
          <div className="mt-5 rounded-lg border border-[#ffb000]/50 bg-[#fff6e1] px-4 py-3 text-sm text-[#6b1b1b]">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isSigningIn}
          className="mt-7 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#800000] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#661010] disabled:cursor-not-allowed disabled:opacity-70"
        >
          <span>{isSigningIn ? "Signing in..." : "Sign in with Google"}</span>
        </button>

        <p className="mt-5 text-xs text-[#8c3b3b]">Your email must be present in authorized_users to continue.</p>

        <div className="mt-4 rounded-lg border border-[#800000]/20 bg-[#fffaf2] px-4 py-3 text-left text-xs text-[#6b1b1b]">
          <p className="font-semibold text-[#800000]">If sign-in fails on localhost:</p>
          <p>1. Firebase Console to Authentication to Sign-in method: enable Google.</p>
          <p>2. Authentication to Settings to Authorized domains: ensure localhost is listed.</p>
          <p>3. Project support email should be set in Firebase Authentication settings.</p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
