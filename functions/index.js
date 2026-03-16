import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { logger } from "firebase-functions";
import { onDocumentCreated } from "firebase-functions/v2/firestore";

initializeApp();

const db = getFirestore();
const messaging = getMessaging();

const BOOKINGS_PATH = process.env.BOOKINGS_PATH || "bookings/{bookingId}";
const TOKENS_COLLECTION = "admin_notification_tokens";
const AUTHORIZED_USERS_COLLECTION = "authorized_users";
const ADMIN_DASHBOARD_URL = "https://admin.mdmrelocation.com/";

const readField = (payload, keys, fallback = "Unknown") => {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return fallback;
};

export const notifyAdminsOnNewBooking = onDocumentCreated(BOOKINGS_PATH, async (event) => {
  const booking = event.data?.data() || {};

  const serviceType = readField(booking, ["service-type", "serviceType", "service"]);
  const pickup = readField(booking, ["from-location", "pickup", "pickupLocation"]);
  const drop = readField(booking, ["to-location", "drop", "dropLocation"]);

  const notificationTitle = "New Booking Request!";
  const notificationBody = `${serviceType} from ${pickup} to ${drop}.`;

  const [authorizedUsersSnapshot, tokenSnapshot] = await Promise.all([
    db.collection(AUTHORIZED_USERS_COLLECTION).get(),
    db.collection(TOKENS_COLLECTION).where("enabled", "==", true).get(),
  ]);

  const authorizedEmails = new Set(
    authorizedUsersSnapshot.docs.map((doc) => doc.id.trim().toLowerCase())
  );

  const tokenRecords = tokenSnapshot.docs
    .map((tokenDoc) => ({ id: tokenDoc.id, ...tokenDoc.data() }))
    .filter((record) => {
      if (typeof record.token !== "string" || !record.token.trim()) {
        return false;
      }

      if (typeof record.email !== "string" || !record.email.trim()) {
        return false;
      }

      return authorizedEmails.has(record.email.trim().toLowerCase());
    });

  if (tokenRecords.length === 0) {
    logger.info("No eligible notification tokens found.");
    return;
  }

  const response = await messaging.sendEachForMulticast({
    tokens: tokenRecords.map((record) => record.token),
    notification: {
      title: notificationTitle,
      body: notificationBody,
    },
    data: {
      url: ADMIN_DASHBOARD_URL,
    },
    webpush: {
      fcmOptions: {
        link: ADMIN_DASHBOARD_URL,
      },
      notification: {
        title: notificationTitle,
        body: notificationBody,
        icon: `${ADMIN_DASHBOARD_URL}mdm-logo.png`,
        badge: `${ADMIN_DASHBOARD_URL}mdm-logo.png`,
      },
    },
  });

  if (response.failureCount === 0) {
    logger.info(`Push notification sent to ${response.successCount} devices.`);
    return;
  }

  const deletions = [];
  response.responses.forEach((result, index) => {
    if (!result.success) {
      const errCode = result.error?.code || "unknown";
      const record = tokenRecords[index];

      logger.warn(`Failed to send to token ${record.id}: ${errCode}`);

      if (
        errCode === "messaging/registration-token-not-registered" ||
        errCode === "messaging/invalid-registration-token"
      ) {
        deletions.push(db.collection(TOKENS_COLLECTION).doc(record.id).delete());
      }
    }
  });

  if (deletions.length > 0) {
    await Promise.all(deletions);
    logger.info(`Cleaned up ${deletions.length} invalid notification tokens.`);
  }
});
