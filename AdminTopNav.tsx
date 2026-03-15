import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";

interface AdminTopNavProps {
  onLogout: () => Promise<void>;
  isSuperAdmin: boolean;
}

const AdminTopNav: React.FC<AdminTopNavProps> = ({ onLogout, isSuperAdmin }) => {
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const baseTabClass =
    "min-h-11 rounded-lg px-3 py-2 text-sm font-semibold transition-colors border flex items-center justify-center";

  return (
    <div className="mb-8 rounded-2xl border border-[#ffd79e] bg-white/90 p-4 shadow-sm shadow-[#800000]/10">
      <div className="flex items-start justify-between gap-4 sm:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#800000]">MDM Relocation</p>
          <h1 className="mt-1 text-xl font-extrabold text-[#800000] sm:text-2xl">Booking Data Analytics</h1>
        </div>

        <div className="flex items-center gap-2 sm:hidden">
          <button
            type="button"
            onClick={() => setIsMenuOpen((value) => !value)}
            aria-expanded={isMenuOpen}
            aria-label="Toggle navigation menu"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-[#f1d39f] bg-[#fff8eb] text-[#800000] transition hover:border-[#800000]/40"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d={isMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
            </svg>
          </button>
        </div>

        <div className="hidden items-center gap-2 sm:flex">
          <Link
            to="/"
            className={`${baseTabClass} ${
              location.pathname === "/"
                ? "border-[#800000] bg-[#800000] text-white"
                : "border-[#f1d39f] bg-[#fff8eb] text-[#6b1b1b] hover:border-[#800000]/40"
            }`}
          >
            Dashboard
          </Link>

          {isSuperAdmin && (
            <Link
              to="/admin-settings"
              className={`${baseTabClass} ${
                location.pathname === "/admin-settings"
                  ? "border-[#800000] bg-[#800000] text-white"
                  : "border-[#f1d39f] bg-[#fff8eb] text-[#6b1b1b] hover:border-[#800000]/40"
              }`}
            >
              Admin Settings
            </Link>
          )}

          <Link
            to="/activity-logs"
            className={`${baseTabClass} ${
              location.pathname === "/activity-logs"
                ? "border-[#800000] bg-[#800000] text-white"
                : "border-[#f1d39f] bg-[#fff8eb] text-[#6b1b1b] hover:border-[#800000]/40"
            }`}
          >
            Activity Logs
          </Link>

          <button
            type="button"
            onClick={onLogout}
            className="min-h-11 rounded-lg bg-[#800000] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#661010]"
          >
            Logout
          </button>
        </div>
      </div>

      <div className={`${isMenuOpen ? "mt-4 flex" : "hidden"} flex-col gap-2 sm:hidden`}>
        <Link
          to="/"
          onClick={() => setIsMenuOpen(false)}
          className={`${baseTabClass} ${
            location.pathname === "/"
              ? "border-[#800000] bg-[#800000] text-white"
              : "border-[#f1d39f] bg-[#fff8eb] text-[#6b1b1b] hover:border-[#800000]/40"
          }`}
        >
          Dashboard
        </Link>

        {isSuperAdmin && (
          <Link
            to="/admin-settings"
            onClick={() => setIsMenuOpen(false)}
            className={`${baseTabClass} ${
              location.pathname === "/admin-settings"
                ? "border-[#800000] bg-[#800000] text-white"
                : "border-[#f1d39f] bg-[#fff8eb] text-[#6b1b1b] hover:border-[#800000]/40"
            }`}
          >
            Admin Settings
          </Link>
        )}

        <Link
          to="/activity-logs"
          onClick={() => setIsMenuOpen(false)}
          className={`${baseTabClass} ${
            location.pathname === "/activity-logs"
              ? "border-[#800000] bg-[#800000] text-white"
              : "border-[#f1d39f] bg-[#fff8eb] text-[#6b1b1b] hover:border-[#800000]/40"
          }`}
        >
          Activity Logs
        </Link>

        <button
          type="button"
          onClick={onLogout}
          className="min-h-11 rounded-lg bg-[#800000] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#661010]"
        >
          Logout
        </button>
      </div>
    </div>
  );
};

export default AdminTopNav;
