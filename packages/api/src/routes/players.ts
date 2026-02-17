import { Router, type Request, type Response } from "express";
import { eq, desc } from "drizzle-orm";
import { db } from "../lib/db.js";
import {
  players,
  teamRosters,
  teams,
  clubs,
  analysisPlayerStats,
  analysisReports,
} from "@volleycoach/shared";
import { createPlayerSchema } from "@volleycoach/shared";
import type { ApiResponse } from "@volleycoach/shared";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

/**
 * GET /api/players/:id
 * Get a player's full profile including team roster info and recent stats.
 */
router.get("/api/players/:id", async (req: Request, res: Response) => {
  try {
    const playerId = parseInt(req.params.id, 10);
    if (isNaN(playerId)) {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_ID", message: "Invalid player ID." },
      } satisfies ApiResponse);
      return;
    }

    const [player] = await db
      .select()
      .from(players)
      .where(eq(players.id, playerId))
      .limit(1);

    if (!player) {
      res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Player not found." },
      } satisfies ApiResponse);
      return;
    }

    // Get teams this player is on
    const rosterEntries = await db
      .select({
        teamId: teamRosters.teamId,
        status: teamRosters.status,
        joinedDate: teamRosters.joinedDate,
        teamName: teams.name,
        ageGroup: teams.ageGroup,
        gender: teams.gender,
        clubId: teams.clubId,
      })
      .from(teamRosters)
      .innerJoin(teams, eq(teamRosters.teamId, teams.id))
      .where(eq(teamRosters.playerId, playerId));

    const teamAssociations = await Promise.all(
      rosterEntries.map(async (entry) => {
        const [club] = await db
          .select({ name: clubs.name, slug: clubs.slug })
          .from(clubs)
          .where(eq(clubs.id, entry.clubId))
          .limit(1);

        return {
          teamId: entry.teamId,
          teamName: entry.teamName,
          ageGroup: entry.ageGroup,
          gender: entry.gender,
          clubName: club?.name ?? "Unknown",
          clubSlug: club?.slug ?? "",
          rosterStatus: entry.status,
          joinedDate: entry.joinedDate,
        };
      })
    );

    // Get recent analysis stats for this player (last 5 analyses)
    const recentStats = await db
      .select({
        id: analysisPlayerStats.id,
        analysisId: analysisPlayerStats.analysisId,
        reception: analysisPlayerStats.reception,
        attack: analysisPlayerStats.attack,
        blocking: analysisPlayerStats.blocking,
        serving: analysisPlayerStats.serving,
        setting: analysisPlayerStats.setting,
        defense: analysisPlayerStats.defense,
        overallRating: analysisPlayerStats.overallRating,
        analysisCreatedAt: analysisReports.createdAt,
        analysisType: analysisReports.analysisType,
        videoId: analysisReports.videoId,
      })
      .from(analysisPlayerStats)
      .innerJoin(
        analysisReports,
        eq(analysisPlayerStats.analysisId, analysisReports.id)
      )
      .where(eq(analysisPlayerStats.playerId, playerId))
      .orderBy(desc(analysisReports.createdAt))
      .limit(5);

    const formattedStats = recentStats.map((s) => ({
      id: s.id,
      analysisId: s.analysisId,
      videoId: s.videoId,
      analysisType: s.analysisType,
      reception: s.reception,
      attack: s.attack,
      blocking: s.blocking,
      serving: s.serving,
      setting: s.setting,
      defense: s.defense,
      overallRating: s.overallRating ? parseFloat(s.overallRating) : null,
      analysisDate: s.analysisCreatedAt.toISOString(),
    }));

    res.json({
      success: true,
      data: {
        id: player.id,
        firstName: player.firstName,
        lastName: player.lastName,
        dateOfBirth: player.dateOfBirth,
        jerseyNumber: player.jerseyNumber,
        position: player.position,
        height: player.height,
        dominantHand: player.dominantHand,
        photoUrl: player.photoUrl,
        bio: player.bio,
        createdAt: player.createdAt.toISOString(),
        teams: teamAssociations,
        recentStats: formattedStats,
      },
    } satisfies ApiResponse);
  } catch (err) {
    console.error("[Players] Error fetching player:", err);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to fetch player." },
    } satisfies ApiResponse);
  }
});

/**
 * POST /api/players
 * Create a new player profile. Optionally link to the authenticated user.
 */
router.post(
  "/api/players",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const validation = createPlayerSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid player data.",
            details: validation.error.flatten(),
          },
        } satisfies ApiResponse);
        return;
      }

      const user = req.user!;
      const data = validation.data;

      // Check if linkToUser flag is set to associate with the authenticated user
      const linkToUser = req.body.linkToUser === true;

      const [newPlayer] = await db
        .insert(players)
        .values({
          userId: linkToUser ? user.id : null,
          firstName: data.firstName,
          lastName: data.lastName,
          dateOfBirth: data.dateOfBirth ?? null,
          jerseyNumber: data.jerseyNumber ?? null,
          position: data.position ?? null,
          height: data.height ?? null,
          dominantHand: data.dominantHand ?? null,
          bio: data.bio ?? null,
        })
        .returning();

      res.status(201).json({
        success: true,
        data: newPlayer,
      } satisfies ApiResponse);
    } catch (err) {
      console.error("[Players] Error creating player:", err);
      res.status(500).json({
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to create player." },
      } satisfies ApiResponse);
    }
  }
);

/**
 * PUT /api/players/:id
 * Update a player profile. Only the linked user (owner) or a coach/admin can update.
 */
router.put(
  "/api/players/:id",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const playerId = parseInt(req.params.id, 10);
      if (isNaN(playerId)) {
        res.status(400).json({
          success: false,
          error: { code: "INVALID_ID", message: "Invalid player ID." },
        } satisfies ApiResponse);
        return;
      }

      const user = req.user!;

      // Fetch existing player
      const [player] = await db
        .select()
        .from(players)
        .where(eq(players.id, playerId))
        .limit(1);

      if (!player) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Player not found." },
        } satisfies ApiResponse);
        return;
      }

      // Check if the user is the linked user or a coach/admin
      const isOwner = player.userId === user.id;
      const isCoachOrAdmin =
        user.role === "coach" ||
        user.role === "club_admin" ||
        user.role === "super_admin";

      if (!isOwner && !isCoachOrAdmin) {
        res.status(403).json({
          success: false,
          error: {
            code: "FORBIDDEN",
            message:
              "You can only update your own player profile or must be a coach/admin.",
          },
        } satisfies ApiResponse);
        return;
      }

      const validation = createPlayerSchema.partial().safeParse(req.body);
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

      const [updated] = await db
        .update(players)
        .set(validation.data)
        .where(eq(players.id, playerId))
        .returning();

      res.json({ success: true, data: updated } satisfies ApiResponse);
    } catch (err) {
      console.error("[Players] Error updating player:", err);
      res.status(500).json({
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to update player." },
      } satisfies ApiResponse);
    }
  }
);

export default router;
