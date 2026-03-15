import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebaseConfig";

interface ActivityPayload {
  action: string;
  target?: string;
  status?: "success" | "error";
  metadata?: Record<string, unknown>;
}

export const logAdminActivity = async ({
  action,
  target = "dashboard",
  status = "success",
  metadata,
}: ActivityPayload): Promise<void> => {
  if (!db) {
    return;
  }

  const currentUser = auth?.currentUser;
  const email = currentUser?.email?.trim().toLowerCase();

  if (!email) {
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
