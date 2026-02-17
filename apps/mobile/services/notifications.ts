import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { router } from "expo-router";
import { api } from "./api";

// ── Types ──────────────────────────────────────────────────────

export type NotificationPermissionStatus = "granted" | "denied" | "undetermined";

interface DeepLinkData {
  type?: string;
  gameId?: number;
  analysisId?: number;
  videoId?: number;
  streamId?: number;
  clubId?: number;
  teamId?: number;
  notificationId?: number;
  [key: string]: unknown;
}

// ── Configuration ──────────────────────────────────────────────

// Configure how notifications are handled when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    priority: Notifications.AndroidNotificationPriority.HIGH,
  }),
});

// Set up Android notification channel
if (Platform.OS === "android") {
  Notifications.setNotificationChannelAsync("default", {
    name: "Default",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#4F46E5",
    sound: "default",
  });

  Notifications.setNotificationChannelAsync("game-updates", {
    name: "Game Updates",
    description: "Live score updates and game notifications",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#F97316",
    sound: "default",
  });

  Notifications.setNotificationChannelAsync("analysis", {
    name: "AI Analysis",
    description: "Video analysis completion notifications",
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: "#4F46E5",
    sound: "default",
  });
}

// ── Permission Helpers ─────────────────────────────────────────

/**
 * Check the current notification permission status without prompting.
 */
export async function getNotificationPermission(): Promise<NotificationPermissionStatus> {
  if (!Device.isDevice) {
    console.warn(
      "[Notifications] Push notifications require a physical device."
    );
    return "denied";
  }

  const { status } = await Notifications.getPermissionsAsync();
  return status as NotificationPermissionStatus;
}

/**
 * Request notification permissions from the user.
 */
async function requestPermission(): Promise<NotificationPermissionStatus> {
  if (!Device.isDevice) {
    return "denied";
  }

  const { status: existingStatus } =
    await Notifications.getPermissionsAsync();

  if (existingStatus === "granted") {
    return "granted";
  }

  const { status: newStatus } =
    await Notifications.requestPermissionsAsync();

  return newStatus as NotificationPermissionStatus;
}

// ── Token Registration ─────────────────────────────────────────

/**
 * Get the Expo push token for this device.
 */
async function getExpoPushToken(): Promise<string | null> {
  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    if (!projectId) {
      console.warn(
        "[Notifications] No EAS project ID found. Push tokens require an EAS project."
      );
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    return tokenData.data;
  } catch (err) {
    console.error("[Notifications] Failed to get Expo push token:", err);
    return null;
  }
}

/**
 * Register for push notifications.
 * Requests permission, gets the Expo push token, and registers it with the backend.
 * Returns the push token string on success, or null on failure.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // 1. Request permission
  const permission = await requestPermission();
  if (permission !== "granted") {
    console.log(
      "[Notifications] Permission not granted. Status:",
      permission
    );
    return null;
  }

  // 2. Get the Expo push token
  const token = await getExpoPushToken();
  if (!token) {
    return null;
  }

  // 3. Register the token with our backend
  try {
    const platform = Platform.OS === "ios" ? "ios" : "android";

    await api.post("/notifications/register-token", {
      token,
      platform,
    });

    console.log("[Notifications] Push token registered successfully.");
  } catch (err) {
    console.error(
      "[Notifications] Failed to register push token with backend:",
      err
    );
    // Don't fail entirely - the token is still valid locally
  }

  return token;
}

/**
 * Unregister a push token from the backend.
 */
export async function unregisterPushToken(token: string): Promise<void> {
  try {
    await api.delete(`/notifications/token/${encodeURIComponent(token)}`);
    console.log("[Notifications] Push token unregistered.");
  } catch (err) {
    console.error("[Notifications] Failed to unregister push token:", err);
  }
}

// ── Deep Linking ───────────────────────────────────────────────

/**
 * Handle a notification tap by navigating to the relevant screen
 * based on the notification's data payload.
 */
export function handleNotificationNavigation(data: DeepLinkData): void {
  const { type, gameId, analysisId, videoId, streamId, clubId, teamId } = data;

  switch (type) {
    case "game_reminder":
    case "score_update":
      if (gameId) {
        router.push(`/game/${gameId}`);
      }
      break;

    case "stream_live":
      if (streamId) {
        router.push(`/stream/${streamId}`);
      }
      break;

    case "analysis_ready":
      if (analysisId) {
        router.push(`/analysis/${analysisId}`);
      } else if (videoId) {
        router.push(`/analysis/${videoId}`);
      }
      break;

    case "team_update":
      if (teamId) {
        router.push(`/team/${teamId}`);
      }
      break;

    case "club_news":
      if (clubId) {
        router.push(`/club/${clubId}`);
      }
      break;

    default:
      // Default: go to home screen
      break;
  }
}

// ── Notification Listeners ─────────────────────────────────────

/**
 * Set up listeners for incoming notifications.
 * Returns a cleanup function that removes the listeners.
 *
 * - foregroundListener: Fires when a notification is received while the app is open
 * - responseListener: Fires when the user taps on a notification
 */
export function setupNotificationListeners(): () => void {
  // Handle notification received while app is in foreground
  const foregroundSubscription =
    Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data as DeepLinkData;
      console.log(
        "[Notifications] Received in foreground:",
        notification.request.content.title,
        data?.type
      );
      // The notification banner is shown automatically by the handler above.
      // Additional in-app handling could be added here (e.g., updating a badge count).
    });

  // Handle notification tap (app was in background or killed)
  const responseSubscription =
    Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content
        .data as DeepLinkData;
      console.log(
        "[Notifications] Tapped notification:",
        response.notification.request.content.title,
        data?.type
      );

      handleNotificationNavigation(data);
    });

  // Return cleanup function
  return () => {
    foregroundSubscription.remove();
    responseSubscription.remove();
  };
}

/**
 * Get the badge count currently set on the app icon.
 */
export async function getBadgeCount(): Promise<number> {
  return Notifications.getBadgeCountAsync();
}

/**
 * Set the badge count on the app icon.
 */
export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count);
}
