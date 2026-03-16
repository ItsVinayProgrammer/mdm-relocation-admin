import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { canUsePushNotifications, isCurrentDeviceSubscribed } from "./pushNotifications";

interface AdminTopNavProps {
  onLogout: () => Promise<void>;
  isSuperAdmin: boolean;
}

const AdminTopNav: React.FC<AdminTopNavProps> = ({ onLogout, isSuperAdmin }) => {
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [pushStatus, setPushStatus] = useState<"off" | "on" | "checking">("checking");

  useEffect(() => {
    let cancelled = false;

    const syncPushStatus = async () => {
      try {
        const supported = await canUsePushNotifications();
        if (!supported || cancelled) {
          if (!cancelled) {
            setPushStatus("off");
          }
          return;
        }

        const subscribed = await isCurrentDeviceSubscribed();
        if (!cancelled) {
          setPushStatus(subscribed ? "on" : "off");
        }
      } catch {
        if (!cancelled) {
          setPushStatus("off");
        }
      }
    };

    void syncPushStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  const pushBadgeClass =
    pushStatus === "on"
      ? "border-[#4ade80] bg-[#f0fdf4] text-[#166534]"
      : pushStatus === "checking"
        ? "border-[#fcd34d] bg-[#fffbeb] text-[#92400e]"
        : "border-[#fecaca] bg-[#fef2f2] text-[#991b1b]";

  const pushLabel =
    pushStatus === "on"
      ? "🔔 Push: On"
      : pushStatus === "checking"
        ? "🔔 Push: ..."
        : "🔔 Push: Off";

  const baseTabClass =
    "min-h-11 rounded-lg px-3 py-2 text-sm font-semibold transition-colors border flex items-center justify-center";

  return (
    <div className="mb-8 rounded-2xl border border-[#ffd79e] bg-white/90 p-4 shadow-sm shadow-[#800000]/10">
      <div className="flex items-start justify-between gap-4 sm:items-center">
        <div className="flex items-center gap-3">
          <img
            src="/mdm-logo.png"
            alt="MDM Relocation"
            className="h-16 w-16 rounded-full border border-[#f0cf95] bg-[#fff8eb] p-0.5 shadow-sm object-cover"
          />

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#800000]">MDM Relocation</p>
            <h1 className="mt-1 text-xl font-extrabold text-[#800000] sm:text-2xl">Booking Data Analytics</h1>
          </div>
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
            to="/dashboard"
            className={`${baseTabClass} ${
              location.pathname === "/dashboard" || location.pathname === "/"
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

          {isSuperAdmin && (
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
          )}

          <span className={`min-h-11 rounded-lg border px-3 py-2 text-xs font-bold ${pushBadgeClass}`}>
            {pushLabel}
          </span>

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
          to="/dashboard"
          onClick={() => setIsMenuOpen(false)}
          className={`${baseTabClass} ${
            location.pathname === "/dashboard" || location.pathname === "/"
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

        {isSuperAdmin && (
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
        )}

        <span className={`rounded-lg border px-3 py-2 text-center text-xs font-bold ${pushBadgeClass}`}>
          {pushLabel}
        </span>

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
