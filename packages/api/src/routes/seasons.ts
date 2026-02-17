import { Router, type Request, type Response } from "express";
import { eq, and, count, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../lib/db.js";
import { seasons, teams, games } from "@volleycoach/shared";
import type { ApiResponse } from "@volleycoach/shared";
import { requireAuth } from "../middleware/auth.js";
import { requireTier } from "../middleware/tier-gate.js";

const router = Router();

// ── Validation Schemas ─────────────────────────────────────

const createSeasonSchema = z.object({
  name: z.string().min(1, "Season name is required").max(200),
  startDate: z.string().refine(
    (val) => !isNaN(Date.parse(val)),
    "startDate must be a valid date string"
  ),
  endDate: z.string().refine(
    (val) => !isNaN(Date.parse(val)),
    "endDate must be a valid date string"
  ),
}).refine(
  (data) => new Date(data.endDate) > new Date(data.startDate),
  {
    message: "endDate must be after startDate",
    path: ["endDate"],
  }
);

const updateSeasonSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  startDate: z.string().refine(
    (val) => !isNaN(Date.parse(val)),
    "startDate must be a valid date string"
  ).optional(),
  endDate: z.string().refine(
    (val) => !isNaN(Date.parse(val)),
    "endDate must be a valid date string"
  ).optional(),
  isActive: z.boolean().optional(),
});

// ── Routes ─────────────────────────────────────────────────

/**
 * GET /api/seasons
 * List all seasons. Optionally filter by isActive query param.
 */
router.get("/api/seasons", async (req: Request, res: Response) => {
  try {
    const { isActive } = req.query;

    let whereClause;
    if (isActive === "true") {
      whereClause = eq(seasons.isActive, true);
    } else if (isActive === "false") {
      whereClause = eq(seasons.isActive, false);
    }

    const seasonResults = await db
      .select()
      .from(seasons)
      .where(whereClause)
      .orderBy(seasons.startDate);

    res.json({
      success: true,
      data: seasonResults,
    } satisfies ApiResponse);
  } catch (err) {
    console.error("[Seasons] Error listing seasons:", err);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to list seasons." },
    } satisfies ApiResponse);
  }
});

/**
 * GET /api/seasons/:id
 * Get season by ID with team count and game count.
 */
router.get("/api/seasons/:id", async (req: Request, res: Response) => {
  try {
    const seasonId = parseInt(req.params.id, 10);
    if (isNaN(seasonId)) {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_ID", message: "Invalid season ID." },
      } satisfies ApiResponse);
      return;
    }

    const [season] = await db
      .select()
      .from(seasons)
      .where(eq(seasons.id, seasonId))
      .limit(1);

    if (!season) {
      res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Season not found." },
      } satisfies ApiResponse);
      return;
    }

    // Count teams associated with this season
    const [teamCountResult] = await db
      .select({ total: count() })
      .from(teams)
      .where(eq(teams.seasonId, seasonId));

    // Count games associated with this season
    const [gameCountResult] = await db
      .select({ total: count() })
      .from(games)
      .where(eq(games.seasonId, seasonId));

    res.json({
      success: true,
      data: {
        ...season,
        teamCount: Number(teamCountResult?.total ?? 0),
        gameCount: Number(gameCountResult?.total ?? 0),
      },
    } satisfies ApiResponse);
  } catch (err) {
    console.error("[Seasons] Error fetching season:", err);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to fetch season." },
    } satisfies ApiResponse);
  }
});

/**
 * POST /api/seasons
 * Create a new season. Requires starter tier or above.
 */
router.post(
  "/api/seasons",
  requireAuth,
  requireTier("starter"),
  async (req: Request, res: Response) => {
    try {
      const validation = createSeasonSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid season data.",
            details: validation.error.flatten(),
          },
        } satisfies ApiResponse);
        return;
      }

      const data = validation.data;

      const [newSeason] = await db
        .insert(seasons)
        .values({
          name: data.name,
          startDate: data.startDate,
          endDate: data.endDate,
          isActive: true,
        })
        .returning();

      res.status(201).json({
        success: true,
        data: newSeason,
      } satisfies ApiResponse);
    } catch (err) {
      console.error("[Seasons] Error creating season:", err);
      res.status(500).json({
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to create season." },
      } satisfies ApiResponse);
    }
  }
);

/**
 * PUT /api/seasons/:id
 * Update a season. Requires authentication.
 */
router.put(
  "/api/seasons/:id",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const seasonId = parseInt(req.params.id, 10);
      if (isNaN(seasonId)) {
        res.status(400).json({
          success: false,
          error: { code: "INVALID_ID", message: "Invalid season ID." },
        } satisfies ApiResponse);
        return;
      }

      // Verify season exists
      const [existing] = await db
        .select()
        .from(seasons)
        .where(eq(seasons.id, seasonId))
        .limit(1);

      if (!existing) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Season not found." },
        } satisfies ApiResponse);
        return;
      }

      const validation = updateSeasonSchema.safeParse(req.body);
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

      // If both dates are provided, validate endDate > startDate
      const effectiveStartDate = data.startDate ?? existing.startDate;
      const effectiveEndDate = data.endDate ?? existing.endDate;
      if (new Date(effectiveEndDate) <= new Date(effectiveStartDate)) {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "endDate must be after startDate.",
          },
        } satisfies ApiResponse);
        return;
      }

      const updateData: Record<string, unknown> = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.startDate !== undefined) updateData.startDate = data.startDate;
      if (data.endDate !== undefined) updateData.endDate = data.endDate;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;

      const [updated] = await db
        .update(seasons)
        .set(updateData)
        .where(eq(seasons.id, seasonId))
        .returning();

      res.json({
        success: true,
        data: updated,
      } satisfies ApiResponse);
    } catch (err) {
      console.error("[Seasons] Error updating season:", err);
      res.status(500).json({
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to update season." },
      } satisfies ApiResponse);
    }
  }
);

/**
 * PUT /api/seasons/:id/activate
 * Set a season as active and deactivate all other seasons.
 */
router.put(
  "/api/seasons/:id/activate",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const seasonId = parseInt(req.params.id, 10);
      if (isNaN(seasonId)) {
        res.status(400).json({
          success: false,
          error: { code: "INVALID_ID", message: "Invalid season ID." },
        } satisfies ApiResponse);
        return;
      }

      // Verify season exists
      const [season] = await db
        .select()
        .from(seasons)
        .where(eq(seasons.id, seasonId))
        .limit(1);

      if (!season) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Season not found." },
        } satisfies ApiResponse);
        return;
      }

      // Deactivate all seasons
      await db
        .update(seasons)
        .set({ isActive: false });

      // Activate the target season
      const [activated] = await db
        .update(seasons)
        .set({ isActive: true })
        .where(eq(seasons.id, seasonId))
        .returning();

      res.json({
        success: true,
        data: activated,
      } satisfies ApiResponse);
    } catch (err) {
      console.error("[Seasons] Error activating season:", err);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to activate season.",
        },
      } satisfies ApiResponse);
    }
  }
);

export default router;
