import { eq, and } from "drizzle-orm";
import { db } from "../lib/db.js";
import {
  notifications,
  pushTokens,
  notificationTypeEnum,
} from "@volleycoach/shared";
import type { Notification } from "@volleycoach/shared";

// ── Types ──────────────────────────────────────────────────────

type NotificationType =
  | "game_reminder"
  | "score_update"
  | "stream_live"
  | "analysis_ready"
  | "team_update"
  | "club_news"
  | "welcome";

interface NotificationPayload {
  title: string;
  body: string;
  type?: NotificationType;
  data?: Record<string, unknown>;
}

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
  channelId?: string;
  priority?: "default" | "normal" | "high";
}

interface ExpoPushTicket {
  id?: string;
  status: "ok" | "error";
  message?: string;
  details?: { error?: string };
}

// ── Constants ──────────────────────────────────────────────────

const EXPO_PUSH_API_URL = "https://exp.host/--/api/v2/push/send";
const MAX_BATCH_SIZE = 100; // Expo recommends max 100 per request

// ── Helpers ────────────────────────────────────────────────────

/**
 * Check if a string looks like a valid Expo push token.
 */
function isExpoPushToken(token: string): boolean {
  return (
    token.startsWith("ExponentPushToken[") ||
    token.startsWith("ExpoPushToken[")
  );
}

/**
 * Send a batch of push messages to the Expo Push API.
 */
async function sendExpoPushBatch(
  messages: ExpoPushMessage[]
): Promise<ExpoPushTicket[]> {
  try {
    const response = await fetch(EXPO_PUSH_API_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      console.error(
        `[Notifications] Expo Push API error: ${response.status} ${response.statusText}`
      );
      return messages.map(() => ({
        status: "error" as const,
        message: `HTTP ${response.status}`,
      }));
    }

    const result = (await response.json()) as { data: ExpoPushTicket[] };
    return result.data;
  } catch (err) {
    console.error("[Notifications] Failed to send push batch:", err);
    return messages.map(() => ({
      status: "error" as const,
      message: "Network error",
    }));
  }
}

// ── Core Functions ─────────────────────────────────────────────

/**
 * Send a push notification to a specific user.
 * Looks up all active push tokens for the user and sends via Expo Push API.
 * Also stores the notification in the database.
 */
export async function sendPushNotification(
  userId: string,
  payload: NotificationPayload
): Promise<{ notificationId: number; pushResults: ExpoPushTicket[] }> {
  const { title, body, type = "team_update", data } = payload;

  // 1. Store the notification in the database
  const [notification] = await db
    .insert(notifications)
    .values({
      userId,
      type,
      title,
      body,
      data: data ?? null,
      isRead: false,
    })
    .returning();

  // 2. Look up the user's active push tokens
  const tokens = await db
    .select()
    .from(pushTokens)
    .where(
      and(eq(pushTokens.userId, userId), eq(pushTokens.isActive, true))
    );

  if (tokens.length === 0) {
    return { notificationId: notification.id, pushResults: [] };
  }

  // 3. Build Expo push messages
  const messages: ExpoPushMessage[] = tokens
    .filter((t) => isExpoPushToken(t.token))
    .map((t) => ({
      to: t.token,
      title,
      body,
      data: {
        ...data,
        notificationId: notification.id,
        type,
      },
      sound: "default" as const,
      priority: "high" as const,
    }));

  if (messages.length === 0) {
    return { notificationId: notification.id, pushResults: [] };
  }

  // 4. Send in batches
  const allResults: ExpoPushTicket[] = [];

  for (let i = 0; i < messages.length; i += MAX_BATCH_SIZE) {
    const batch = messages.slice(i, i + MAX_BATCH_SIZE);
    const batchResults = await sendExpoPushBatch(batch);
    allResults.push(...batchResults);
  }

  // 5. Deactivate tokens that returned DeviceNotRegistered errors
  for (let i = 0; i < allResults.length; i++) {
    const ticket = allResults[i];
    if (
      ticket.status === "error" &&
      ticket.details?.error === "DeviceNotRegistered"
    ) {
      const tokenValue = messages[i].to;
      await db
        .update(pushTokens)
        .set({ isActive: false })
        .where(eq(pushTokens.token, tokenValue));

      console.warn(
        `[Notifications] Deactivated unregistered token: ${tokenValue.substring(0, 30)}...`
      );
    }
  }

  return { notificationId: notification.id, pushResults: allResults };
}

/**
 * Send push notifications to multiple users at once.
 * Efficient for broadcasting (e.g., game updates, stream notifications).
 */
export async function sendBulkNotifications(
  userIds: string[],
  payload: NotificationPayload
): Promise<{
  notificationCount: number;
  pushTicketCount: number;
  errors: number;
}> {
  const { title, body, type = "team_update", data } = payload;

  if (userIds.length === 0) {
    return { notificationCount: 0, pushTicketCount: 0, errors: 0 };
  }

  // 1. Insert notifications for all users in a single batch
  const notificationValues = userIds.map((userId) => ({
    userId,
    type: type as NotificationType,
    title,
    body,
    data: data ?? null,
    isRead: false as const,
  }));

  const insertedNotifications = await db
    .insert(notifications)
    .values(notificationValues)
    .returning({ id: notifications.id, userId: notifications.userId });

  // 2. Look up all active push tokens for these users
  // We query each user's tokens individually to avoid overly complex queries
  const allMessages: ExpoPushMessage[] = [];

  for (const { id: notificationId, userId } of insertedNotifications) {
    const tokens = await db
      .select()
      .from(pushTokens)
      .where(
        and(eq(pushTokens.userId, userId), eq(pushTokens.isActive, true))
      );

    for (const t of tokens) {
      if (isExpoPushToken(t.token)) {
        allMessages.push({
          to: t.token,
          title,
          body,
          data: {
            ...data,
            notificationId,
            type,
          },
          sound: "default",
          priority: "high",
        });
      }
    }
  }

  if (allMessages.length === 0) {
    return {
      notificationCount: insertedNotifications.length,
      pushTicketCount: 0,
      errors: 0,
    };
  }

  // 3. Send all messages in batches
  let errorCount = 0;

  for (let i = 0; i < allMessages.length; i += MAX_BATCH_SIZE) {
    const batch = allMessages.slice(i, i + MAX_BATCH_SIZE);
    const batchResults = await sendExpoPushBatch(batch);

    for (let j = 0; j < batchResults.length; j++) {
      const ticket = batchResults[j];
      if (ticket.status === "error") {
        errorCount++;

        // Deactivate invalid tokens
        if (ticket.details?.error === "DeviceNotRegistered") {
          const tokenValue = batch[j].to;
          await db
            .update(pushTokens)
            .set({ isActive: false })
            .where(eq(pushTokens.token, tokenValue));
        }
      }
    }
  }

  return {
    notificationCount: insertedNotifications.length,
    pushTicketCount: allMessages.length,
    errors: errorCount,
  };
}
