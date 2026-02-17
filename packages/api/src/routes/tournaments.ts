import { Router, type Request, type Response } from "express";
import { eq, and, count } from "drizzle-orm";
import { z } from "zod";
import { db } from "../lib/db.js";
import {
  tournaments,
  tournamentTeams,
  teams,
  clubs,
  createTournamentSchema,
} from "@volleycoach/shared";
import type { ApiResponse } from "@volleycoach/shared";
import { requireAuth } from "../middleware/auth.js";
import { requireTier } from "../middleware/tier-gate.js";
import {
  generatePoolPlaySchedule,
  generateBracketFromPools,
  getTournamentBracket,
} from "../services/tournament-service.js";

const router = Router();

// ── Validation Schemas ─────────────────────────────────────

const addTeamSchema = z.object({
  teamId: z.number().int().positive(),
  poolName: z.string().min(1).max(10).optional(),
  seed: z.number().int().positive().optional(),
});

// ── Routes ─────────────────────────────────────────────────

/**
 * GET /api/tournaments
 * List tournaments with optional filters: status, clubId.
 */
router.get("/api/tournaments", async (req: Request, res: Response) => {
  try {
    const { status, clubId, page = "1", limit = "20" } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(
      50,
      Math.max(1, parseInt(limit as string, 10) || 20)
    );
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];

    if (status && typeof status === "string") {
      conditions.push(
        eq(
          tournaments.status,
          status as (typeof tournaments.status.enumValues)[number]
        )
      );
    }

    if (clubId && typeof clubId === "string") {
      const cid = parseInt(clubId, 10);
      if (!isNaN(cid)) {
        conditions.push(eq(tournaments.clubId, cid));
      }
    }

    const whereClause =
      conditions.length > 0 ? and(...conditions) : undefined;

    const tournamentResults = await db
      .select()
      .from(tournaments)
      .where(whereClause)
      .orderBy(tournaments.startDate)
      .limit(limitNum + 1)
      .offset(offset);

    const hasMore = tournamentResults.length > limitNum;
    if (hasMore) tournamentResults.pop();

    // Enrich each tournament with team count
    const enriched = await Promise.all(
      tournamentResults.map(async (t) => {
        const [teamCountResult] = await db
          .select({ total: count() })
          .from(tournamentTeams)
          .where(eq(tournamentTeams.tournamentId, t.id));

        let clubName: string | null = null;
        if (t.clubId) {
          const [club] = await db
            .select({ name: clubs.name })
            .from(clubs)
            .where(eq(clubs.id, t.clubId))
            .limit(1);
          clubName = club?.name ?? null;
        }

        return {
          ...t,
          teamCount: Number(teamCountResult?.total ?? 0),
          clubName,
        };
      })
    );

    res.json({
      success: true,
      data: enriched,
      meta: {
        page: pageNum,
        limit: limitNum,
        hasMore,
      },
    } satisfies ApiResponse);
  } catch (err) {
    console.error("[Tournaments] Error listing tournaments:", err);
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to list tournaments.",
      },
    } satisfies ApiResponse);
  }
});

/**
 * GET /api/tournaments/:id
 * Get tournament with teams and bracket.
 */
router.get("/api/tournaments/:id", async (req: Request, res: Response) => {
  try {
    const tournamentId = parseInt(req.params.id, 10);
    if (isNaN(tournamentId)) {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_ID", message: "Invalid tournament ID." },
      } satisfies ApiResponse);
      return;
    }

    const [tournament] = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.id, tournamentId))
      .limit(1);

    if (!tournament) {
      res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Tournament not found." },
      } satisfies ApiResponse);
      return;
    }

    // Get club name
    let clubName: string | null = null;
    if (tournament.clubId) {
      const [club] = await db
        .select({ name: clubs.name })
        .from(clubs)
        .where(eq(clubs.id, tournament.clubId))
        .limit(1);
      clubName = club?.name ?? null;
    }

    // Get all teams in this tournament
    const ttResults = await db
      .select({
        id: tournamentTeams.id,
        teamId: tournamentTeams.teamId,
        poolName: tournamentTeams.poolName,
        seed: tournamentTeams.seed,
        teamName: teams.name,
        ageGroup: teams.ageGroup,
        clubId: teams.clubId,
      })
      .from(tournamentTeams)
      .innerJoin(teams, eq(tournamentTeams.teamId, teams.id))
      .where(eq(tournamentTeams.tournamentId, tournamentId));

    // Get club names for each team
    const clubIds = [...new Set(ttResults.map((t) => t.clubId))];
    const clubMap = new Map<number, string>();
    for (const cid of clubIds) {
      const [club] = await db
        .select({ id: clubs.id, name: clubs.name })
        .from(clubs)
        .where(eq(clubs.id, cid))
        .limit(1);
      if (club) clubMap.set(club.id, club.name);
    }

    const teamsWithClub = ttResults.map((t) => ({
      id: t.id,
      teamId: t.teamId,
      teamName: t.teamName,
      ageGroup: t.ageGroup,
      clubName: clubMap.get(t.clubId) ?? "Unknown",
      poolName: t.poolName,
      seed: t.seed,
    }));

    // Get bracket if tournament is in progress or completed
    let bracket = null;
    if (
      tournament.status === "in_progress" ||
      tournament.status === "completed"
    ) {
      try {
        bracket = await getTournamentBracket(tournamentId);
      } catch (bracketErr) {
        // Bracket may not exist yet; this is not an error
        console.warn(
          "[Tournaments] Could not load bracket for tournament",
          tournamentId,
          bracketErr
        );
      }
    }

    res.json({
      success: true,
      data: {
        ...tournament,
        clubName,
        teams: teamsWithClub,
        bracket,
      },
    } satisfies ApiResponse);
  } catch (err) {
    console.error("[Tournaments] Error fetching tournament:", err);
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to fetch tournament.",
      },
    } satisfies ApiResponse);
  }
});

/**
 * POST /api/tournaments
 * Create a new tournament. Requires club tier.
 */
router.post(
  "/api/tournaments",
  requireAuth,
  requireTier("club"),
  async (req: Request, res: Response) => {
    try {
      const validation = createTournamentSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid tournament data.",
            details: validation.error.flatten(),
          },
        } satisfies ApiResponse);
        return;
      }

      const data = validation.data;

      // Validate dates
      if (new Date(data.endDate) <= new Date(data.startDate)) {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "endDate must be after startDate.",
          },
        } satisfies ApiResponse);
        return;
      }

      // If clubId is provided, verify it exists
      if (data.clubId) {
        const [club] = await db
          .select()
          .from(clubs)
          .where(eq(clubs.id, data.clubId))
          .limit(1);

        if (!club) {
          res.status(404).json({
            success: false,
            error: { code: "NOT_FOUND", message: "Club not found." },
          } satisfies ApiResponse);
          return;
        }
      }

      const [newTournament] = await db
        .insert(tournaments)
        .values({
          name: data.name,
          startDate: data.startDate,
          endDate: data.endDate,
          location: data.location ?? null,
          format: data.format,
          maxTeams: data.maxTeams ?? null,
          clubId: data.clubId ?? null,
          status: "registration",
        })
        .returning();

      res.status(201).json({
        success: true,
        data: newTournament,
      } satisfies ApiResponse);
    } catch (err) {
      console.error("[Tournaments] Error creating tournament:", err);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to create tournament.",
        },
      } satisfies ApiResponse);
    }
  }
);

/**
 * POST /api/tournaments/:id/teams
 * Add a team to a tournament.
 */
router.post(
  "/api/tournaments/:id/teams",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const tournamentId = parseInt(req.params.id, 10);
      if (isNaN(tournamentId)) {
        res.status(400).json({
          success: false,
          error: { code: "INVALID_ID", message: "Invalid tournament ID." },
        } satisfies ApiResponse);
        return;
      }

      const validation = addTeamSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid team data.",
            details: validation.error.flatten(),
          },
        } satisfies ApiResponse);
        return;
      }

      const { teamId, poolName, seed } = validation.data;

      // Verify tournament exists and is in registration
      const [tournament] = await db
        .select()
        .from(tournaments)
        .where(eq(tournaments.id, tournamentId))
        .limit(1);

      if (!tournament) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Tournament not found." },
        } satisfies ApiResponse);
        return;
      }

      if (tournament.status !== "registration") {
        res.status(400).json({
          success: false,
          error: {
            code: "INVALID_STATE",
            message:
              "Teams can only be added when tournament is in registration.",
          },
        } satisfies ApiResponse);
        return;
      }

      // Verify team exists
      const [team] = await db
        .select()
        .from(teams)
        .where(eq(teams.id, teamId))
        .limit(1);

      if (!team) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Team not found." },
        } satisfies ApiResponse);
        return;
      }

      // Check if team is already in the tournament
      const [existing] = await db
        .select()
        .from(tournamentTeams)
        .where(
          and(
            eq(tournamentTeams.tournamentId, tournamentId),
            eq(tournamentTeams.teamId, teamId)
          )
        )
        .limit(1);

      if (existing) {
        res.status(409).json({
          success: false,
          error: {
            code: "ALREADY_EXISTS",
            message: "Team is already registered for this tournament.",
          },
        } satisfies ApiResponse);
        return;
      }

      // Check max teams limit
      if (tournament.maxTeams) {
        const [teamCountResult] = await db
          .select({ total: count() })
          .from(tournamentTeams)
          .where(eq(tournamentTeams.tournamentId, tournamentId));

        if (Number(teamCountResult?.total ?? 0) >= tournament.maxTeams) {
          res.status(400).json({
            success: false,
            error: {
              code: "TOURNAMENT_FULL",
              message: `Tournament has reached its maximum of ${tournament.maxTeams} teams.`,
            },
          } satisfies ApiResponse);
          return;
        }
      }

      const [newEntry] = await db
        .insert(tournamentTeams)
        .values({
          tournamentId,
          teamId,
          poolName: poolName ?? null,
          seed: seed ?? null,
        })
        .returning();

      res.status(201).json({
        success: true,
        data: newEntry,
      } satisfies ApiResponse);
    } catch (err) {
      console.error("[Tournaments] Error adding team:", err);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to add team to tournament.",
        },
      } satisfies ApiResponse);
    }
  }
);

/**
 * POST /api/tournaments/:id/generate-schedule
 * Generate pool play round-robin schedule for a tournament.
 */
router.post(
  "/api/tournaments/:id/generate-schedule",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const tournamentId = parseInt(req.params.id, 10);
      if (isNaN(tournamentId)) {
        res.status(400).json({
          success: false,
          error: { code: "INVALID_ID", message: "Invalid tournament ID." },
        } satisfies ApiResponse);
        return;
      }

      const result = await generatePoolPlaySchedule(tournamentId);

      res.json({
        success: true,
        data: {
          tournamentId,
          gamesCreated: result.gamesCreated,
          message: `Successfully generated ${result.gamesCreated} pool play games.`,
        },
      } satisfies ApiResponse);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to generate schedule.";
      console.error("[Tournaments] Error generating schedule:", err);

      // Determine appropriate status code
      const statusCode = message.includes("not found")
        ? 404
        : message.includes("only be generated") ||
            message.includes("At least 2")
          ? 400
          : 500;

      res.status(statusCode).json({
        success: false,
        error: {
          code:
            statusCode === 404
              ? "NOT_FOUND"
              : statusCode === 400
                ? "INVALID_STATE"
                : "INTERNAL_ERROR",
          message,
        },
      } satisfies ApiResponse);
    }
  }
);

/**
 * POST /api/tournaments/:id/generate-bracket
 * Generate single-elimination bracket from completed pool play results.
 */
router.post(
  "/api/tournaments/:id/generate-bracket",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const tournamentId = parseInt(req.params.id, 10);
      if (isNaN(tournamentId)) {
        res.status(400).json({
          success: false,
          error: { code: "INVALID_ID", message: "Invalid tournament ID." },
        } satisfies ApiResponse);
        return;
      }

      const result = await generateBracketFromPools(tournamentId);

      res.json({
        success: true,
        data: {
          tournamentId,
          bracketGames: result.bracketGames,
          message: `Successfully generated elimination bracket with ${result.bracketGames} games.`,
        },
      } satisfies ApiResponse);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to generate bracket.";
      console.error("[Tournaments] Error generating bracket:", err);

      const statusCode = message.includes("not found")
        ? 404
        : message.includes("only be generated") ||
            message.includes("Not enough teams") ||
            message.includes("No completed")
          ? 400
          : 500;

      res.status(statusCode).json({
        success: false,
        error: {
          code:
            statusCode === 404
              ? "NOT_FOUND"
              : statusCode === 400
                ? "INVALID_STATE"
                : "INTERNAL_ERROR",
          message,
        },
      } satisfies ApiResponse);
    }
  }
);

export default router;
