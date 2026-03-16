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
import { logAdminActivity } from "./activityLogger";

interface LoginPageProps {
  user: User | null;
  isAuthLoading: boolean;
}

const ACCESS_DENIED_MESSAGE =
  "Access Denied: Your email is not authorized. Please contact the administrator.";

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
    return ACCESS_DENIED_MESSAGE;
  };

  const handleGoogleSignIn = async () => {
    if (!auth) {
      setError(ACCESS_DENIED_MESSAGE);
      return;
    }

    try {
      setError(null);
      setIsSigningIn(true);
      void logAdminActivity({ action: "Login attempt", target: "auth", metadata: { method: "google-popup" } });
      const result = await signInWithPopup(auth, googleProvider);
      void logAdminActivity({
        action: "Login attempt",
        target: "auth",
        metadata: { method: "google-popup", outcome: "success" },
        actorEmail: result.user.email ?? undefined,
      });
    } catch (signInError) {
      console.error("Google sign-in failed:", signInError);
      const authCode = signInError instanceof FirebaseError ? signInError.code : undefined;

      const fallbackEmail =
        signInError instanceof FirebaseError && typeof signInError.customData?.email === "string"
          ? signInError.customData.email
          : undefined;
      void logAdminActivity({
        action: "Login attempt",
        target: "auth",
        status: "error",
        metadata: { method: "google-popup", outcome: "error", code: authCode ?? "unknown" },
        actorEmail: fallbackEmail,
      });

      if (authCode === "auth/popup-blocked" || authCode === "auth/cancelled-popup-request") {
        try {
          setError(null);
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
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#f7f2ea] via-[#f2ebe2] to-[#e7ded1] px-6 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(128,0,0,0.16),_transparent_42%),radial-gradient(circle_at_bottom_right,_rgba(176,116,0,0.2),_transparent_45%)]" />
      <div className="pointer-events-none absolute -left-20 top-10 h-72 w-72 rounded-full bg-[#800000]/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-10 h-72 w-72 rounded-full bg-[#ffb000]/25 blur-3xl" />

      <div className="relative w-full max-w-md rounded-3xl border border-white/45 bg-white/30 p-8 shadow-2xl shadow-[#800000]/20 backdrop-blur-xl">
        <img
          src="/mdm-logo.png"
          alt="MDM Relocation"
          className="mx-auto h-20 w-20 rounded-full border border-[#f0cf95] bg-[#fff8eb] p-0.5 object-cover shadow-md"
        />
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#7a1010]">MDM Relocation</p>
        <h1 className="mt-3 text-3xl font-extrabold leading-tight text-[#3d0f0f]">MDM Operations Console</h1>
        <p className="mt-3 text-sm leading-6 text-[#5b2a2a]">Secure Access for Authorized Personnel Only.</p>

        {error && <p className="mt-5 text-sm font-medium text-[#a30000]">{ACCESS_DENIED_MESSAGE}</p>}

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isSigningIn}
          className="mt-8 flex min-h-12 w-full items-center justify-center gap-3 rounded-xl bg-[#800000] px-5 py-3 text-base font-semibold text-white shadow-lg shadow-[#800000]/30 transition duration-300 hover:-translate-y-0.5 hover:bg-[#690000] hover:shadow-xl hover:shadow-[#800000]/35 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-75"
        >
          {isSigningIn ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              <span>Authenticating...</span>
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
                <path
                  fill="#EA4335"
                  d="M12 10.2v3.9h5.5c-.2 1.3-1.7 3.9-5.5 3.9-3.3 0-6.1-2.8-6.1-6.2s2.8-6.2 6.1-6.2c1.9 0 3.2.8 3.9 1.5l2.7-2.6C17 2.9 14.8 2 12 2 6.9 2 2.8 6.1 2.8 11.2S6.9 20.4 12 20.4c6.9 0 9.1-4.9 9.1-7.5 0-.5-.1-.9-.1-1.3H12z"
                />
              </svg>
              <span>Sign in with Google</span>
            </>
          )}
        </button>

        <p className="mt-4 text-center text-xs text-[#5f3a3a]">Only verified admin accounts can continue.</p>
      </div>

      <div className="relative mt-6 text-center text-xs text-[#5f3a3a]/90">
        <p>© 2024 MDM Relocation. All rights reserved.</p>
      </div>
    </div>
  );
};

export default LoginPage;
