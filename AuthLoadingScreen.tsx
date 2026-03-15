import React from "react";

interface AuthLoadingScreenProps {
  message?: string;
}

const AuthLoadingScreen: React.FC<AuthLoadingScreenProps> = ({
  message = "Checking your session...",
}) => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fff8ef] px-6">
      <div className="w-full max-w-md rounded-2xl border border-[#ffdf99] bg-white p-8 text-center shadow-lg shadow-[#800000]/10">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-[#ffd477] border-t-[#800000]" />
        <h1 className="text-2xl font-bold tracking-tight text-[#800000]">MDM Relocation</h1>
        <p className="mt-2 text-sm text-[#6b1b1b]">{message}</p>
      </div>
    </div>
  );
};

export default AuthLoadingScreen;
