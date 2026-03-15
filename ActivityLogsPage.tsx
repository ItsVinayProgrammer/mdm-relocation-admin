import React, { useEffect, useMemo, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import AdminTopNav from "./AdminTopNav";
import { db } from "./firebaseConfig";
import { logAdminActivity } from "./activityLogger";

interface ActivityLogsPageProps {
  onLogout: () => Promise<void>;
  isSuperAdmin: boolean;
}

interface ActivityLogItem {
  id: string;
  email: string;
  action: string;
  target: string;
  status: string;
  createdAt?: { toDate?: () => Date };
}

const formatDateTime = (value?: { toDate?: () => Date }) => {
  if (!value?.toDate) {
    return "Pending timestamp";
  }

  return value.toDate().toLocaleString();
};

const ActivityLogsPage: React.FC<ActivityLogsPageProps> = ({ onLogout, isSuperAdmin }) => {
  const [logs, setLogs] = useState<ActivityLogItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (!db) {
      setError("Firestore is not configured. Please verify VITE_FIREBASE_* values.");
      return;
    }

    void logAdminActivity({ action: "Viewed Activity Logs" });

    const logsQuery = query(
      collection(db, "admin_activity_logs"),
      orderBy("createdAt", "desc"),
      limit(300)
    );

    const unsubscribe = onSnapshot(
      logsQuery,
      (snapshot) => {
        const list = snapshot.docs.map((entry) => ({
          id: entry.id,
          ...(entry.data() as Omit<ActivityLogItem, "id">),
        }));
        setLogs(list);
      },
      (snapshotError) => {
        console.error("Failed to load activity logs:", snapshotError);
        setError("Failed to load activity logs.");
      }
    );

    return () => unsubscribe();
  }, []);

  const filteredLogs = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return logs;
    }

    return logs.filter((entry) =>
      [entry.email, entry.action, entry.target, entry.status]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [logs, searchTerm]);

  return (
    <div className="min-h-screen bg-[#fff8ef] px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <AdminTopNav onLogout={onLogout} isSuperAdmin={isSuperAdmin} />

        <div className="rounded-2xl border border-[#ffd79e] bg-white/95 p-5 shadow-sm shadow-[#800000]/10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#800000]">Audit Trail</p>
              <h2 className="mt-1 text-2xl font-extrabold text-[#800000]">Admin Activity Logs</h2>
              <p className="mt-1 text-sm text-[#6b1b1b]">Track who logged in, when, and what activity was performed.</p>
            </div>
            <div className="rounded-lg border border-[#ffe1b3] bg-[#fff8ef] px-3 py-2 text-xs font-semibold text-[#8c3b3b]">
              Showing {filteredLogs.length} of {logs.length} events
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-[#fca5a5] bg-[#fff1f2] px-4 py-3 text-sm text-[#991b1b]">
              {error}
            </div>
          )}

          <div className="mt-5">
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by email, action, target, or status"
              className="min-h-11 w-full rounded-xl border border-[#ffd79e] bg-[#fffdf9] px-4 py-3 text-sm text-[#4a1f1f] outline-none transition focus:border-[#800000]"
            />
          </div>

          <div className="mt-5 hidden overflow-x-auto rounded-xl border border-[#ffe1b3] md:block">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="bg-[#fff1d8] text-left text-[#6b1b1b]">
                  <th className="px-4 py-3 font-semibold">When</th>
                  <th className="px-4 py-3 font-semibold">Who</th>
                  <th className="px-4 py-3 font-semibold">Activity</th>
                  <th className="px-4 py-3 font-semibold">Target</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-[#8c3b3b]">No activity logs found.</td>
                  </tr>
                ) : (
                  filteredLogs.map((entry) => (
                    <tr key={entry.id} className="border-t border-[#ffe7c1]">
                      <td className="px-4 py-3 text-[#4a1f1f]">{formatDateTime(entry.createdAt)}</td>
                      <td className="px-4 py-3 text-[#4a1f1f]">{entry.email || "Unknown"}</td>
                      <td className="px-4 py-3 text-[#4a1f1f]">{entry.action || "-"}</td>
                      <td className="px-4 py-3 text-[#4a1f1f]">{entry.target || "-"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          entry.status === "error"
                            ? "bg-red-50 text-red-700"
                            : "bg-green-50 text-green-700"
                        }`}>
                          {entry.status || "success"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-5 grid gap-3 md:hidden">
            {filteredLogs.length === 0 ? (
              <div className="rounded-xl border border-[#ffe1b3] bg-[#fffaf2] px-4 py-8 text-center text-[#8c3b3b]">
                No activity logs found.
              </div>
            ) : (
              filteredLogs.map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-[#ffe1b3] bg-[#fffdf9] p-4 shadow-sm transition hover:shadow-md">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8c3b3b]">{formatDateTime(entry.createdAt)}</p>
                  <p className="mt-2 break-all text-sm font-semibold text-[#4a1f1f]">{entry.email || "Unknown"}</p>
                  <p className="mt-2 text-sm text-[#4a1f1f]">{entry.action || "-"}</p>
                  <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                    <span className="rounded-full bg-[#fff1d8] px-2.5 py-1 font-semibold text-[#6b1b1b]">{entry.target || "-"}</span>
                    <span className={`rounded-full px-2.5 py-1 font-semibold ${
                      entry.status === "error" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
                    }`}>
                      {entry.status || "success"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActivityLogsPage;
