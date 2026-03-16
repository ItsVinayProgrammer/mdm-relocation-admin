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

const formatDateOnly = (value?: { toDate?: () => Date }) => {
  if (!value?.toDate) {
    return "Pending Date";
  }
  return value.toDate().toLocaleDateString(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const actionIcon = (action: string) => {
  const normalized = action.toLowerCase();
  if (normalized.includes("delete") || normalized.includes("removed")) {
    return "🗑️";
  }
  if (normalized.includes("user") || normalized.includes("login")) {
    return "👤";
  }
  if (normalized.includes("export")) {
    return "📥";
  }
  return "•";
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
      limit(50)
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

  const groupedLogs = useMemo(() => {
    const groups: Array<{ date: string; entries: ActivityLogItem[] }> = [];
    const index = new Map<string, number>();

    filteredLogs.forEach((entry) => {
      const dayLabel = formatDateOnly(entry.createdAt);
      if (!index.has(dayLabel)) {
        index.set(dayLabel, groups.length);
        groups.push({ date: dayLabel, entries: [] });
      }
      groups[index.get(dayLabel)!].entries.push(entry);
    });

    return groups;
  }, [filteredLogs]);

  return (
    <div className="min-h-screen bg-[#fff8ef] px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <AdminTopNav onLogout={onLogout} isSuperAdmin={isSuperAdmin} />

        <div className="rounded-2xl border border-[#ffd79e] bg-white/95 p-5 shadow-sm shadow-[#800000]/10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#800000]">Audit Trail</p>
              <h2 className="mt-1 text-2xl font-extrabold text-[#800000]">Admin Activity Logs</h2>
              <p className="mt-1 text-sm text-[#6b1b1b]">Recent 50 events. Grouped by date for faster audit review.</p>
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
                  <th className="px-3 py-2 font-semibold">When</th>
                  <th className="px-3 py-2 font-semibold">Who</th>
                  <th className="px-3 py-2 font-semibold">Activity</th>
                  <th className="px-3 py-2 font-semibold">Target</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {groupedLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-[#8c3b3b]">No activity logs found.</td>
                  </tr>
                ) : (
                  groupedLogs.map((group) => (
                    <React.Fragment key={group.date}>
                      <tr className="border-t border-[#f1d4a6] bg-[#fff8ef]">
                        <td colSpan={5} className="px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[#8c3b3b]">
                          {group.date}
                        </td>
                      </tr>
                      {group.entries.map((entry) => {
                        const actionLower = (entry.action || "").toLowerCase();
                        const isNegative =
                          entry.status === "error" ||
                          actionLower.includes("delete") ||
                          actionLower.includes("removed") ||
                          actionLower.includes("failed");

                        return (
                          <tr key={entry.id} className="border-t border-[#ffe7c1]">
                            <td className="px-3 py-2 text-xs text-[#4a1f1f]">{formatDateTime(entry.createdAt)}</td>
                            <td className="px-3 py-2 text-xs text-[#4a1f1f]">{entry.email || "Unknown"}</td>
                            <td className={`px-3 py-2 text-xs font-semibold ${isNegative ? "text-[#b91c1c]" : "text-[#166534]"}`}>
                              {actionIcon(entry.action || "")} {entry.action || "-"}
                            </td>
                            <td className="px-3 py-2 text-xs text-[#4a1f1f]">{entry.target || "-"}</td>
                            <td className="px-3 py-2">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                isNegative ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
                              }`}>
                                {isNegative ? "failed" : (entry.status || "success")}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-5 grid gap-3 md:hidden">
            {groupedLogs.length === 0 ? (
              <div className="rounded-xl border border-[#ffe1b3] bg-[#fffaf2] px-4 py-8 text-center text-[#8c3b3b]">
                No activity logs found.
              </div>
            ) : (
              groupedLogs.map((group) => (
                <div key={group.date}>
                  <p className="mb-2 mt-3 text-xs font-bold uppercase tracking-[0.12em] text-[#8c3b3b]">{group.date}</p>
                  <div className="grid gap-2">
                    {group.entries.map((entry) => {
                      const actionLower = (entry.action || "").toLowerCase();
                      const isNegative =
                        entry.status === "error" ||
                        actionLower.includes("delete") ||
                        actionLower.includes("removed") ||
                        actionLower.includes("failed");

                      return (
                        <div key={entry.id} className="rounded-xl border border-[#ffe1b3] bg-[#fffdf9] p-3 shadow-sm">
                          <p className="text-[11px] text-[#8c3b3b]">{formatDateTime(entry.createdAt)}</p>
                          <p className="mt-1 break-all text-xs font-semibold text-[#4a1f1f]">{entry.email || "Unknown"}</p>
                          <p className={`mt-1 text-xs font-semibold ${isNegative ? "text-[#b91c1c]" : "text-[#166534]"}`}>
                            {actionIcon(entry.action || "")} {entry.action || "-"}
                          </p>
                          <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
                            <span className="rounded-full bg-[#fff1d8] px-2 py-0.5 font-semibold text-[#6b1b1b]">{entry.target || "-"}</span>
                            <span className={`rounded-full px-2 py-0.5 font-semibold ${
                              isNegative ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
                            }`}>
                              {isNegative ? "failed" : (entry.status || "success")}
                            </span>
                          </div>
                        </div>
                      );
                    })}
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
