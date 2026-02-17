import { Router, type Request, type Response } from "express";
import { eq, and, gte, lte, count, sql } from "drizzle-orm";
import { db } from "../lib/db.js";
import {
  calendarEvents,
  calendarRsvps,
  teams,
  clubs,
  createCalendarEventSchema,
} from "@volleycoach/shared";
import type { ApiResponse, CalendarEventItem } from "@volleycoach/shared";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

/**
 * GET /api/calendar
 * Get calendar events for a date range. Requires authentication.
 * Query params: startDate, endDate (ISO strings), teamId (optional), clubId (optional)
 */
router.get(
  "/api/calendar",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const { startDate, endDate, teamId, clubId } = req.query;

      const conditions = [eq(calendarEvents.userId, user.id)];

      if (startDate && typeof startDate === "string") {
        conditions.push(gte(calendarEvents.startTime, new Date(startDate)));
      }

      if (endDate && typeof endDate === "string") {
        conditions.push(lte(calendarEvents.startTime, new Date(endDate)));
      }

      if (teamId) {
        const tid = parseInt(teamId as string, 10);
        if (!isNaN(tid)) {
          conditions.push(eq(calendarEvents.teamId, tid));
        }
      }

      if (clubId) {
        const cid = parseInt(clubId as string, 10);
        if (!isNaN(cid)) {
          conditions.push(eq(calendarEvents.clubId, cid));
        }
      }

      const events = await db
        .select()
        .from(calendarEvents)
        .where(and(...conditions))
        .orderBy(calendarEvents.startTime);

      const result: CalendarEventItem[] = await Promise.all(
        events.map(async (event) => {
          // Get team and club names
          let teamName: string | null = null;
          let clubName: string | null = null;

          if (event.teamId) {
            const [team] = await db
              .select({ name: teams.name })
              .from(teams)
              .where(eq(teams.id, event.teamId))
              .limit(1);
            teamName = team?.name ?? null;
          }

          if (event.clubId) {
            const [club] = await db
              .select({ name: clubs.name })
              .from(clubs)
              .where(eq(clubs.id, event.clubId))
              .limit(1);
            clubName = club?.name ?? null;
          }

          // Get user's RSVP status
          const [userRsvp] = await db
            .select()
            .from(calendarRsvps)
            .where(
              and(
                eq(calendarRsvps.eventId, event.id),
                eq(calendarRsvps.userId, user.id)
              )
            )
            .limit(1);

          // Get RSVP counts
          const rsvpResults = await db
            .select({
              status: calendarRsvps.status,
              total: count(),
            })
            .from(calendarRsvps)
            .where(eq(calendarRsvps.eventId, event.id))
            .groupBy(calendarRsvps.status);

          const rsvpCounts = { going: 0, maybe: 0, notGoing: 0 };
          for (const r of rsvpResults) {
            if (r.status === "going") rsvpCounts.going = Number(r.total);
            else if (r.status === "maybe") rsvpCounts.maybe = Number(r.total);
            else if (r.status === "not_going")
              rsvpCounts.notGoing = Number(r.total);
          }

          return {
            id: event.id,
            title: event.title,
            description: event.description,
            eventType: event.eventType,
            startTime: event.startTime.toISOString(),
            endTime: event.endTime?.toISOString() ?? null,
            location: event.location,
            isAllDay: event.isAllDay,
            color: event.color,
            teamName,
            clubName,
            gameId: event.gameId,
            rsvpStatus: userRsvp?.status ?? null,
            rsvpCounts,
          };
        })
      );

      res.json({
        success: true,
        data: result,
      } satisfies ApiResponse<CalendarEventItem[]>);
    } catch (err) {
      console.error("[Calendar] Error listing events:", err);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to list calendar events.",
        },
      } satisfies ApiResponse);
    }
  }
);

/**
 * POST /api/calendar
 * Create a new calendar event.
 */
router.post(
  "/api/calendar",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const validation = createCalendarEventSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid event data.",
            details: validation.error.flatten(),
          },
        } satisfies ApiResponse);
        return;
      }

      const user = req.user!;
      const data = validation.data;

      const [newEvent] = await db
        .insert(calendarEvents)
        .values({
          userId: user.id,
          title: data.title,
          description: data.description ?? null,
          eventType: data.eventType,
          startTime: new Date(data.startTime),
          endTime: data.endTime ? new Date(data.endTime) : null,
          location: data.location ?? null,
          isAllDay: data.isAllDay,
          teamId: data.teamId ?? null,
          clubId: data.clubId ?? null,
          reminderMinutes: data.reminderMinutes ?? null,
          color: data.color ?? null,
        })
        .returning();

      res.status(201).json({
        success: true,
        data: newEvent,
      } satisfies ApiResponse);
    } catch (err) {
      console.error("[Calendar] Error creating event:", err);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to create calendar event.",
        },
      } satisfies ApiResponse);
    }
  }
);

/**
 * PUT /api/calendar/:id
 * Update a calendar event. Only the event owner can update.
 */
router.put(
  "/api/calendar/:id",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.id, 10);
      if (isNaN(eventId)) {
        res.status(400).json({
          success: false,
          error: { code: "INVALID_ID", message: "Invalid event ID." },
        } satisfies ApiResponse);
        return;
      }

      const user = req.user!;

      // Verify ownership
      const [existing] = await db
        .select()
        .from(calendarEvents)
        .where(eq(calendarEvents.id, eventId))
        .limit(1);

      if (!existing) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Event not found." },
        } satisfies ApiResponse);
        return;
      }

      if (existing.userId !== user.id) {
        res.status(403).json({
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "You can only update your own events.",
          },
        } satisfies ApiResponse);
        return;
      }

      const validation = createCalendarEventSchema.partial().safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid update data.",
            details: validation.error.flatten(),
          },
        } satisfies ApiResponse);
        return;
      }

      const data = validation.data;
      const updateData: Record<string, unknown> = {};

      if (data.title !== undefined) updateData.title = data.title;
      if (data.description !== undefined)
        updateData.description = data.description;
      if (data.eventType !== undefined) updateData.eventType = data.eventType;
      if (data.startTime !== undefined)
        updateData.startTime = new Date(data.startTime);
      if (data.endTime !== undefined)
        updateData.endTime = data.endTime ? new Date(data.endTime) : null;
      if (data.location !== undefined) updateData.location = data.location;
      if (data.isAllDay !== undefined) updateData.isAllDay = data.isAllDay;
      if (data.teamId !== undefined) updateData.teamId = data.teamId;
      if (data.clubId !== undefined) updateData.clubId = data.clubId;
      if (data.reminderMinutes !== undefined)
        updateData.reminderMinutes = data.reminderMinutes;
      if (data.color !== undefined) updateData.color = data.color;

      const [updated] = await db
        .update(calendarEvents)
        .set(updateData)
        .where(eq(calendarEvents.id, eventId))
        .returning();

      res.json({ success: true, data: updated } satisfies ApiResponse);
    } catch (err) {
      console.error("[Calendar] Error updating event:", err);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to update calendar event.",
        },
      } satisfies ApiResponse);
    }
  }
);

/**
 * DELETE /api/calendar/:id
 * Delete a calendar event. Only the event owner can delete.
 */
router.delete(
  "/api/calendar/:id",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.id, 10);
      if (isNaN(eventId)) {
        res.status(400).json({
          success: false,
          error: { code: "INVALID_ID", message: "Invalid event ID." },
        } satisfies ApiResponse);
        return;
      }

      const user = req.user!;

      const [existing] = await db
        .select()
        .from(calendarEvents)
        .where(eq(calendarEvents.id, eventId))
        .limit(1);

      if (!existing) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Event not found." },
        } satisfies ApiResponse);
        return;
      }

      if (existing.userId !== user.id) {
        res.status(403).json({
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "You can only delete your own events.",
          },
        } satisfies ApiResponse);
        return;
      }

      await db
        .delete(calendarEvents)
        .where(eq(calendarEvents.id, eventId));

      res.json({
        success: true,
        data: { deleted: true, eventId },
      } satisfies ApiResponse);
    } catch (err) {
      console.error("[Calendar] Error deleting event:", err);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to delete calendar event.",
        },
      } satisfies ApiResponse);
    }
  }
);

/**
 * POST /api/calendar/:id/rsvp
 * RSVP to a calendar event. Body: { status: "going" | "maybe" | "not_going" }
 */
router.post(
  "/api/calendar/:id/rsvp",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.id, 10);
      if (isNaN(eventId)) {
        res.status(400).json({
          success: false,
          error: { code: "INVALID_ID", message: "Invalid event ID." },
        } satisfies ApiResponse);
        return;
      }

      const user = req.user!;
      const { status } = req.body;

      if (!status || !["going", "maybe", "not_going"].includes(status)) {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "status must be 'going', 'maybe', or 'not_going'.",
          },
        } satisfies ApiResponse);
        return;
      }

      // Verify event exists
      const [event] = await db
        .select()
        .from(calendarEvents)
        .where(eq(calendarEvents.id, eventId))
        .limit(1);

      if (!event) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Event not found." },
        } satisfies ApiResponse);
        return;
      }

      // Upsert RSVP
      const [existing] = await db
        .select()
        .from(calendarRsvps)
        .where(
          and(
            eq(calendarRsvps.eventId, eventId),
            eq(calendarRsvps.userId, user.id)
          )
        )
        .limit(1);

      let rsvp;
      if (existing) {
        [rsvp] = await db
          .update(calendarRsvps)
          .set({ status })
          .where(eq(calendarRsvps.id, existing.id))
          .returning();
      } else {
        [rsvp] = await db
          .insert(calendarRsvps)
          .values({
            eventId,
            userId: user.id,
            status,
          })
          .returning();
      }

      res.json({
        success: true,
        data: rsvp,
      } satisfies ApiResponse);
    } catch (err) {
      console.error("[Calendar] Error processing RSVP:", err);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to process RSVP.",
        },
      } satisfies ApiResponse);
    }
  }
);

export default router;
