import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebaseConfig";

interface ActivityPayload {
  action: string;
  target?: string;
  status?: "success" | "error";
  metadata?: Record<string, unknown>;
  actorEmail?: string;
}

const VIEWED_DEDUP_WINDOW_MS = 5 * 60 * 1000;
const VIEWED_DEDUP_KEY = "mdmViewedEventDedup";

const shouldSkipViewedEvent = (email: string, action: string): boolean => {
  if (typeof window === "undefined") {
    return false;
  }

  if (!action.toLowerCase().startsWith("viewed")) {
    return false;
  }

  const dedupId = `${email}::${action}`;
  const now = Date.now();

  try {
    const raw = window.localStorage.getItem(VIEWED_DEDUP_KEY);
    const cache = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    const lastSeen = cache[dedupId] ?? 0;

    if (now - lastSeen < VIEWED_DEDUP_WINDOW_MS) {
      return true;
    }

    cache[dedupId] = now;
    window.localStorage.setItem(VIEWED_DEDUP_KEY, JSON.stringify(cache));
  } catch {
    return false;
  }

  return false;
};

export const logAdminActivity = async ({
  action,
  target = "dashboard",
  status = "success",
  metadata,
  actorEmail,
}: ActivityPayload): Promise<void> => {
  if (!db) {
    return;
  }

  const currentUser = auth?.currentUser;
  const email = (actorEmail ?? currentUser?.email ?? "").trim().toLowerCase();

  if (!email) {
    return;
  }

  if (shouldSkipViewedEvent(email, action)) {
    return;
  }

  try {
    await addDoc(collection(db, "admin_activity_logs"), {
      email,
      action,
      target,
      status,
      metadata: metadata ?? {},
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Failed to write activity log:", error);
  }
};
