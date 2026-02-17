import { useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../services/api";
import { wsService } from "../services/websocket";
import {
  registerForPushNotifications,
  setupNotificationListeners,
  setBadgeCount,
} from "../services/notifications";
import { useAuthStore } from "../stores/auth";

// ── Types ──────────────────────────────────────────────────────

interface NotificationItem {
  id: number;
  type: string;
  title: string;
  body: string;
  data: unknown;
  isRead: boolean;
  createdAt: string;
}

interface NotificationsResponse {
  items: NotificationItem[];
  unreadCount: number;
}

// ── Hook ───────────────────────────────────────────────────────

export function useNotifications() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore(
    (s) => s.user !== null && s.firebaseIdToken !== null
  );
  const hasRegistered = useRef(false);

  // ── Register for push notifications on mount ────────────────

  useEffect(() => {
    if (!isAuthenticated || hasRegistered.current) return;

    hasRegistered.current = true;

    registerForPushNotifications().then((token) => {
      if (token) {
        console.log("[useNotifications] Registered with token.");
      }
    });
  }, [isAuthenticated]);

  // ── Set up notification listeners ───────────────────────────

  useEffect(() => {
    if (!isAuthenticated) return;

    const cleanup = setupNotificationListeners();
    return cleanup;
  }, [isAuthenticated]);

  // ── Listen for real-time notifications via WebSocket ────────

  useEffect(() => {
    if (!isAuthenticated) return;

    const unsubscribe = wsService.onNotification(() => {
      // Invalidate the notifications query to refresh the list
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    });

    return unsubscribe;
  }, [isAuthenticated, queryClient]);

  // ── Fetch notifications list ────────────────────────────────

  const {
    data: notificationsData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["notifications"],
    queryFn: async (): Promise<NotificationsResponse> => {
      const response = await api.get<NotificationItem[]>("/notifications", {
        params: { limit: 50 },
      });

      const items = response.data ?? [];
      const unreadCount = response.meta?.total ?? 0;

      // Update the app badge count
      setBadgeCount(unreadCount).catch(() => {
        /* ignore badge errors */
      });

      return { items, unreadCount };
    },
    enabled: isAuthenticated,
    staleTime: 1000 * 60, // 1 minute
    refetchInterval: 1000 * 60 * 5, // Refresh every 5 minutes
  });

  const notifications = notificationsData?.items ?? [];
  const unreadCount = notificationsData?.unreadCount ?? 0;

  // ── Mark a single notification as read ──────────────────────

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: number) => {
      await api.put(`/notifications/${notificationId}/read`);
      return notificationId;
    },
    onMutate: async (notificationId: number) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ["notifications"] });
      const previous =
        queryClient.getQueryData<NotificationsResponse>(["notifications"]);

      if (previous) {
        queryClient.setQueryData<NotificationsResponse>(["notifications"], {
          items: previous.items.map((n) =>
            n.id === notificationId ? { ...n, isRead: true } : n
          ),
          unreadCount: Math.max(0, previous.unreadCount - 1),
        });
      }

      return { previous };
    },
    onError: (_err, _id, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(["notifications"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  // ── Mark all notifications as read ──────────────────────────

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await api.put("/notifications/read-all");
    },
    onMutate: async () => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ["notifications"] });
      const previous =
        queryClient.getQueryData<NotificationsResponse>(["notifications"]);

      if (previous) {
        queryClient.setQueryData<NotificationsResponse>(["notifications"], {
          items: previous.items.map((n) => ({ ...n, isRead: true })),
          unreadCount: 0,
        });
      }

      // Clear the badge
      setBadgeCount(0).catch(() => {
        /* ignore */
      });

      return { previous };
    },
    onError: (_err, _vars, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(["notifications"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  // ── Stable callbacks ────────────────────────────────────────

  const markAsRead = useCallback(
    (notificationId: number) => {
      markAsReadMutation.mutate(notificationId);
    },
    [markAsReadMutation]
  );

  const markAllRead = useCallback(() => {
    markAllReadMutation.mutate();
  }, [markAllReadMutation]);

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllRead,
    refetch,
  };
}
