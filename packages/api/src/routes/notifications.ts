import { Router, type Request, type Response } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../lib/db.js";
import { notifications, pushTokens } from "@volleycoach/shared";
import type { ApiResponse } from "@volleycoach/shared";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// ── Types ──────────────────────────────────────────────────────

interface NotificationListItem {
  id: number;
  type: string;
  title: string;
  body: string;
  data: unknown;
  isRead: boolean;
  createdAt: string;
}

// ── GET /api/notifications ─────────────────────────────────────
// List the current user's notifications (paginated).

router.get(
  "/api/notifications",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const { page = "1", limit = "20" } = req.query;
      const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
      const limitNum = Math.min(
        50,
        Math.max(1, parseInt(limit as string, 10) || 20)
      );
      const offset = (pageNum - 1) * limitNum;

      const results = await db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, user.id))
        .orderBy(desc(notifications.createdAt))
        .limit(limitNum)
        .offset(offset);

      const items: NotificationListItem[] = results.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        data: n.data,
        isRead: n.isRead,
        createdAt: n.createdAt.toISOString(),
      }));

      // Get unread count
      const unreadResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, user.id),
            eq(notifications.isRead, false)
          )
        );

      const unreadCount = unreadResult[0]?.count ?? 0;

      res.json({
        success: true,
        data: items,
        meta: {
          page: pageNum,
          limit: limitNum,
          hasMore: results.length === limitNum,
          total: unreadCount,
        },
      } satisfies ApiResponse);
    } catch (err) {
      console.error("[Notifications] Error listing notifications:", err);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch notifications.",
        },
      } satisfies ApiResponse);
    }
  }
);

// ── PUT /api/notifications/:id/read ────────────────────────────
// Mark a single notification as read.

router.put(
  "/api/notifications/:id/read",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const notificationId = parseInt(req.params.id, 10);

      if (isNaN(notificationId)) {
        res.status(400).json({
          success: false,
          error: {
            code: "INVALID_ID",
            message: "Invalid notification ID.",
          },
        } satisfies ApiResponse);
        return;
      }

      // Verify ownership and update
      const [updated] = await db
        .update(notifications)
        .set({ isRead: true })
        .where(
          and(
            eq(notifications.id, notificationId),
            eq(notifications.userId, user.id)
          )
        )
        .returning();

      if (!updated) {
        res.status(404).json({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Notification not found.",
          },
        } satisfies ApiResponse);
        return;
      }

      res.json({
        success: true,
        data: { id: updated.id, isRead: true },
      } satisfies ApiResponse);
    } catch (err) {
      console.error("[Notifications] Error marking notification as read:", err);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to update notification.",
        },
      } satisfies ApiResponse);
    }
  }
);

// ── PUT /api/notifications/read-all ────────────────────────────
// Mark all of the current user's notifications as read.

router.put(
  "/api/notifications/read-all",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const user = req.user!;

      await db
        .update(notifications)
        .set({ isRead: true })
        .where(
          and(
            eq(notifications.userId, user.id),
            eq(notifications.isRead, false)
          )
        );

      res.json({
        success: true,
        data: { message: "All notifications marked as read." },
      } satisfies ApiResponse);
    } catch (err) {
      console.error("[Notifications] Error marking all as read:", err);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to update notifications.",
        },
      } satisfies ApiResponse);
    }
  }
);

// ── POST /api/notifications/register-token ─────────────────────
// Register a push notification token for the current user.

router.post(
  "/api/notifications/register-token",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const { token, platform } = req.body;

      if (!token || typeof token !== "string") {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Push token is required.",
          },
        } satisfies ApiResponse);
        return;
      }

      if (!platform || !["ios", "android", "web"].includes(platform)) {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message:
              "Platform is required and must be one of: ios, android, web.",
          },
        } satisfies ApiResponse);
        return;
      }

      // Check if the token already exists for this user
      const existing = await db
        .select()
        .from(pushTokens)
        .where(
          and(
            eq(pushTokens.userId, user.id),
            eq(pushTokens.token, token)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        // Re-activate the token if it was previously deactivated
        if (!existing[0].isActive) {
          await db
            .update(pushTokens)
            .set({ isActive: true })
            .where(eq(pushTokens.id, existing[0].id));
        }

        res.json({
          success: true,
          data: { id: existing[0].id, registered: true },
        } satisfies ApiResponse);
        return;
      }

      // Insert new token
      const [newToken] = await db
        .insert(pushTokens)
        .values({
          userId: user.id,
          token,
          platform: platform as "ios" | "android" | "web",
          isActive: true,
        })
        .returning();

      res.status(201).json({
        success: true,
        data: { id: newToken.id, registered: true },
      } satisfies ApiResponse);
    } catch (err) {
      console.error("[Notifications] Error registering push token:", err);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to register push token.",
        },
      } satisfies ApiResponse);
    }
  }
);

// ── DELETE /api/notifications/token/:token ──────────────────────
// Unregister (deactivate) a push notification token.

router.delete(
  "/api/notifications/token/:token",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const tokenValue = req.params.token;

      if (!tokenValue) {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Token parameter is required.",
          },
        } satisfies ApiResponse);
        return;
      }

      // Deactivate the token instead of deleting it
      const [updated] = await db
        .update(pushTokens)
        .set({ isActive: false })
        .where(
          and(
            eq(pushTokens.userId, user.id),
            eq(pushTokens.token, tokenValue)
          )
        )
        .returning();

      if (!updated) {
        res.status(404).json({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Push token not found.",
          },
        } satisfies ApiResponse);
        return;
      }

      res.json({
        success: true,
        data: { unregistered: true },
      } satisfies ApiResponse);
    } catch (err) {
      console.error("[Notifications] Error unregistering push token:", err);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to unregister push token.",
        },
      } satisfies ApiResponse);
    }
  }
);

export default router;
