import { doc, getDoc, serverTimestamp, setDoc, deleteDoc } from "firebase/firestore";
import { getMessaging, getToken, isSupported as isMessagingSupported } from "firebase/messaging";
import { app, db } from "./firebaseConfig";

const TOKEN_STORAGE_KEY = "mdmAdminPushToken";
const TOKEN_COLLECTION = "admin_notification_tokens";

const toTokenDocId = (token: string) => encodeURIComponent(token);

export const canUsePushNotifications = async (): Promise<boolean> => {
  if (!db || !app) {
    return false;
  }

  if (typeof window === "undefined") {
    return false;
  }

  if (!("serviceWorker" in navigator) || !("Notification" in window)) {
    return false;
  }

  return isMessagingSupported();
};

export const getStoredPushToken = (): string | null => {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
};

export const isCurrentDeviceSubscribed = async (): Promise<boolean> => {
  const token = getStoredPushToken();
  if (!db || !token) {
    return false;
  }

  const tokenDoc = await getDoc(doc(db, TOKEN_COLLECTION, toTokenDocId(token)));
  return tokenDoc.exists() && tokenDoc.data().enabled !== false;
};

export const enablePushNotificationsForDevice = async (email: string): Promise<void> => {
  if (!db || !app) {
    throw new Error("Notifications are not configured.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Permission not granted.");
  }

  const serviceWorkerRegistration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
  if (!vapidKey) {
    throw new Error("Missing VAPID key.");
  }

  const messaging = getMessaging(app);
  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration,
  });

  if (!token) {
    throw new Error("Unable to generate a push token.");
  }

  const tokenDocId = toTokenDocId(token);
  await setDoc(
    doc(db, TOKEN_COLLECTION, tokenDocId),
    {
      token,
      email: email.trim().toLowerCase(),
      enabled: true,
      platform: navigator.platform,
      userAgent: navigator.userAgent,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
};

export const disablePushNotificationsForDevice = async (): Promise<void> => {
  if (!db) {
    return;
  }

  const token = getStoredPushToken();
  if (!token) {
    return;
  }

  await deleteDoc(doc(db, TOKEN_COLLECTION, toTokenDocId(token)));
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
};
