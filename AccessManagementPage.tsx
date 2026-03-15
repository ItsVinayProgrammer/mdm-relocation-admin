import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "./firebaseConfig";
import AdminTopNav from "./AdminTopNav";
import { logAdminActivity } from "./activityLogger";

interface AccessManagementPageProps {
  onLogout: () => Promise<void>;
  superAdminEmail: string;
}

interface AuthorizedUser {
  id: string;
  email: string;
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SUPER_ADMIN_EMAIL = (import.meta.env.VITE_SUPER_ADMIN_EMAIL ?? "itsvinayprogrammer@gmail.com")
  .trim()
  .toLowerCase();

const AccessManagementPage: React.FC<AccessManagementPageProps> = ({ onLogout, superAdminEmail }) => {
  const [users, setUsers] = useState<AuthorizedUser[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [emailToDelete, setEmailToDelete] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    if (!db) {
      setError("Firestore is not configured. Please verify VITE_FIREBASE_* values.");
      return;
    }

    void logAdminActivity({ action: "Viewed Admin Settings", target: "authorized_users" });

    const unsubscribe = onSnapshot(
      collection(db, "authorized_users"),
      (snapshot) => {
        const list = snapshot.docs
          .map((userDoc) => ({
            id: userDoc.id,
            email: String(userDoc.data().email ?? userDoc.id),
          }))
          .sort((a, b) => a.email.localeCompare(b.email));
        setUsers(list);
      },
      (snapshotError) => {
        console.error("Failed to load authorized users:", snapshotError);
        setError("Failed to load authorized users.");
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 2500);

    return () => clearTimeout(timer);
  }, [toastMessage]);

  const normalizedEmail = useMemo(() => newEmail.trim().toLowerCase(), [newEmail]);
  const superAdminEmailNormalized = useMemo(() => SUPER_ADMIN_EMAIL, []);

  const filteredUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return users;
    }

    return users.filter((userRecord) => userRecord.email.toLowerCase().includes(term));
  }, [users, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / itemsPerPage));
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredUsers.slice(start, start + itemsPerPage);
  }, [filteredUsers, currentPage, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, itemsPerPage]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleAddUser = async () => {
    if (!db) {
      setError("Firestore is not configured.");
      return;
    }

    if (!emailRegex.test(normalizedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await setDoc(
        doc(db, "authorized_users", normalizedEmail),
        {
          email: normalizedEmail,
          updatedAt: serverTimestamp(),
          managedBy: superAdminEmail,
        },
        { merge: true }
      );
      setNewEmail("");
      void logAdminActivity({
        action: "Added authorized user",
        target: "authorized_users",
        metadata: { email: normalizedEmail },
      });
      setToastMessage("User added successfully.");
    } catch (addError) {
      console.error("Failed to add authorized user:", addError);
      void logAdminActivity({
        action: "Added authorized user",
        target: "authorized_users",
        status: "error",
        metadata: { email: normalizedEmail },
      });
      setError("Failed to add user.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!db || !emailToDelete) {
      return;
    }

    if (emailToDelete === superAdminEmailNormalized) {
      setError("Super Admin account cannot be removed.");
      setEmailToDelete(null);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await deleteDoc(doc(db, "authorized_users", emailToDelete));
      void logAdminActivity({
        action: "Removed authorized user",
        target: "authorized_users",
        metadata: { email: emailToDelete },
      });
      setToastMessage("User removed successfully.");
      setEmailToDelete(null);
    } catch (deleteError) {
      console.error("Failed to remove authorized user:", deleteError);
      void logAdminActivity({
        action: "Removed authorized user",
        target: "authorized_users",
        status: "error",
        metadata: { email: emailToDelete },
      });
      setError("Failed to remove user.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fff8ef] px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <AdminTopNav onLogout={onLogout} isSuperAdmin />

        <div className="rounded-2xl border border-[#ffd79e] bg-white/90 p-6 shadow-lg shadow-[#800000]/10">
          <h2 className="text-xl font-bold text-[#800000]">User Access Management</h2>
          <p className="mt-1 text-sm text-[#6b1b1b]">
            Manage authorized emails in Firestore collection: authorized_users
          </p>

          {error && (
            <div className="mt-4 rounded-lg border border-[#fca5a5] bg-[#fff1f2] px-4 py-3 text-sm text-[#991b1b]">
              {error}
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <input
              type="email"
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
              placeholder="Enter email to authorize"
              className="min-h-11 w-full rounded-xl border border-[#ffd79e] px-4 py-3 text-sm outline-none transition focus:border-[#800000]"
            />
            <button
              type="button"
              onClick={handleAddUser}
              disabled={isSubmitting}
              className="min-h-11 rounded-xl bg-[#800000] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#661010] disabled:cursor-not-allowed disabled:opacity-70"
            >
              Add User
            </button>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search authorized emails"
              className="min-h-11 w-full rounded-xl border border-[#ffd79e] px-4 py-3 text-sm outline-none transition focus:border-[#800000]"
            />
            <select
              value={itemsPerPage}
              onChange={(event) => setItemsPerPage(Number(event.target.value))}
              className="min-h-11 rounded-xl border border-[#ffd79e] bg-white px-4 py-3 text-sm text-[#6b1b1b] outline-none transition focus:border-[#800000]"
            >
              {[10, 20, 30, 50].map((option) => (
                <option key={option} value={option}>{option} per page</option>
              ))}
            </select>
          </div>

          <div className="mt-6 hidden overflow-x-auto rounded-xl border border-[#ffe1b3] md:block">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="bg-[#fff1d8] text-left text-[#6b1b1b]">
                  <th className="px-4 py-3 font-semibold">Authorized Email</th>
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-4 py-6 text-center text-[#8c3b3b]">
                      No authorized users found.
                    </td>
                  </tr>
                )}

                {paginatedUsers.map((userRecord) => (
                  <tr key={userRecord.id} className="border-t border-[#ffe7c1]">
                    <td className="px-4 py-3 text-[#4a1f1f]">{userRecord.email}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setEmailToDelete(userRecord.id)}
                        disabled={userRecord.id === superAdminEmailNormalized}
                        className={`min-h-11 rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                          userRecord.id === superAdminEmailNormalized
                            ? "cursor-not-allowed border-[#d1d5db] bg-[#f8fafc] text-[#94a3b8]"
                            : "border-[#d97706] bg-[#fff7ed] text-[#9a3412] hover:bg-[#ffedd5]"
                        }`}
                      >
                        {userRecord.id === superAdminEmailNormalized ? "Protected" : "Remove"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 grid gap-3 md:hidden">
            {filteredUsers.length === 0 ? (
              <div className="rounded-xl border border-[#ffe1b3] bg-[#fffaf2] px-4 py-6 text-center text-[#8c3b3b]">
                No authorized users found.
              </div>
            ) : (
              paginatedUsers.map((userRecord) => (
                <div key={userRecord.id} className="rounded-2xl border border-[#ffe1b3] bg-[#fffdf9] p-4 shadow-sm transition hover:shadow-md">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8c3b3b]">Authorized Email</p>
                  <p className="mt-2 break-all text-sm font-semibold text-[#4a1f1f]">{userRecord.email}</p>
                  <button
                    type="button"
                    onClick={() => setEmailToDelete(userRecord.id)}
                    disabled={userRecord.id === superAdminEmailNormalized}
                    className={`mt-4 flex min-h-11 w-full items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                      userRecord.id === superAdminEmailNormalized
                        ? "cursor-not-allowed border-[#d1d5db] bg-[#f8fafc] text-[#94a3b8]"
                        : "border-[#d97706] bg-[#fff7ed] text-[#9a3412] hover:bg-[#ffedd5]"
                    }`}
                  >
                    {userRecord.id === superAdminEmailNormalized ? "Super Admin Protected" : "Remove Access"}
                  </button>
                </div>
              ))
            )}
          </div>

          {totalPages > 1 && (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                className="min-h-11 rounded-lg border border-[#ffd79e] bg-white px-4 py-2 text-sm font-semibold text-[#800000] transition hover:bg-[#fff7ed] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-2 text-sm font-semibold text-[#6b1b1b]">Page {currentPage} of {totalPages}</span>
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage === totalPages}
                className="min-h-11 rounded-lg border border-[#ffd79e] bg-white px-4 py-2 text-sm font-semibold text-[#800000] transition hover:bg-[#fff7ed] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      {toastMessage && (
        <div className="fixed right-4 top-4 z-40 rounded-lg border border-[#86efac] bg-[#f0fdf4] px-4 py-3 text-sm font-semibold text-[#166534] shadow-lg">
          {toastMessage}
        </div>
      )}

      {emailToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4">
          <div className="w-full max-w-md rounded-2xl border border-[#fbbf24] bg-white p-6 shadow-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b45309]">Warning</p>
            <h3 className="mt-2 text-lg font-bold text-[#7c2d12]">Remove User Access?</h3>
            <p className="mt-3 text-sm text-[#7c2d12]">
              This will revoke dashboard access for <span className="font-semibold">{emailToDelete}</span>.
            </p>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEmailToDelete(null)}
                className="min-h-11 rounded-lg border border-[#e2e8f0] px-4 py-2 text-sm font-semibold text-[#475569] transition hover:bg-[#f8fafc]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={isSubmitting}
                className="min-h-11 rounded-lg bg-[#b45309] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#92400e] disabled:cursor-not-allowed disabled:opacity-70"
              >
                Confirm Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccessManagementPage;
