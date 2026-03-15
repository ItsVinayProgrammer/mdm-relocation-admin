import React from "react";

interface AccessDeniedPageProps {
  email: string;
  onLogout: () => Promise<void>;
}

const AccessDeniedPage: React.FC<AccessDeniedPageProps> = ({ email, onLogout }) => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fff8ef] px-6">
      <div className="w-full max-w-lg rounded-2xl border border-[#ffb000]/50 bg-white p-8 text-center shadow-xl shadow-[#800000]/15">
        <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-[#800000]">MDM Admin Security</p>
        <h1 className="text-3xl font-extrabold text-[#800000]">Access Denied</h1>
        <p className="mt-4 text-sm leading-6 text-[#6b1b1b]">
          The account <span className="font-semibold">{email}</span> is authenticated but is not authorized
          for this dashboard.
        </p>
        <button
          type="button"
          onClick={onLogout}
          className="mt-8 inline-flex min-h-11 items-center justify-center rounded-lg bg-[#800000] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#651010]"
        >
          Logout
        </button>
      </div>
    </div>
  );
};

export default AccessDeniedPage;
