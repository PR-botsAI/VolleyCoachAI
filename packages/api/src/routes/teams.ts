import { Router, type Request, type Response } from "express";
import { eq, and, count } from "drizzle-orm";
import { db } from "../lib/db.js";
import {
  teams,
  teamRosters,
  players,
  clubs,
  clubMemberships,
  users,
  standings,
  games,
  createTeamSchema,
} from "@volleycoach/shared";
import type { ApiResponse, TeamWithRoster, RosterPlayer, GameSummary } from "@volleycoach/shared";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

/**
 * GET /api/teams/:id
 * Get a team with its full roster, upcoming games, and season info.
 */
router.get("/api/teams/:id", async (req: Request, res: Response) => {
  try {
    const teamId = parseInt(req.params.id, 10);
    if (isNaN(teamId)) {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_ID", message: "Invalid team ID." },
      } satisfies ApiResponse);
      return;
    }

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

    // Get head coach name
    let headCoachName: string | null = null;
    if (team.headCoachId) {
      const [coach] = await db
        .select({ fullName: users.fullName })
        .from(users)
        .where(eq(users.id, team.headCoachId))
        .limit(1);
      headCoachName = coach?.fullName ?? null;
    }

    // Get roster
    const rosterResults = await db
      .select({
        id: players.id,
        firstName: players.firstName,
        lastName: players.lastName,
        jerseyNumber: players.jerseyNumber,
        position: players.position,
        photoUrl: players.photoUrl,
        status: teamRosters.status,
      })
      .from(teamRosters)
      .innerJoin(players, eq(teamRosters.playerId, players.id))
      .where(eq(teamRosters.teamId, teamId));

    const roster: RosterPlayer[] = rosterResults.map((r) => ({
      id: r.id,
      firstName: r.firstName,
      lastName: r.lastName,
      jerseyNumber: r.jerseyNumber,
      position: r.position,
      photoUrl: r.photoUrl,
      status: r.status,
    }));

    // Get win/loss record
    const standingResult = await db
      .select()
      .from(standings)
      .where(eq(standings.teamId, teamId))
      .limit(1);
    const standing = standingResult[0];

    // Get upcoming games (scheduled, for this team)
    const upcomingGameResults = await db
      .select()
      .from(games)
      .where(
        and(
          eq(games.status, "scheduled"),
          eq(games.homeTeamId, teamId)
        )
      )
      .limit(5);

    const awayGameResults = await db
      .select()
      .from(games)
      .where(
        and(
          eq(games.status, "scheduled"),
          eq(games.awayTeamId, teamId)
        )
      )
      .limit(5);

    const allUpcomingGames = [...upcomingGameResults, ...awayGameResults]
      .sort(
        (a, b) =>
          new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
      )
      .slice(0, 5);

    const upcomingGames: GameSummary[] = await Promise.all(
      allUpcomingGames.map(async (game) => {
        const [homeTeam] = await db
          .select({ id: teams.id, name: teams.name, clubId: teams.clubId })
          .from(teams)
          .where(eq(teams.id, game.homeTeamId))
          .limit(1);

        const [awayTeam] = await db
          .select({ id: teams.id, name: teams.name, clubId: teams.clubId })
          .from(teams)
          .where(eq(teams.id, game.awayTeamId))
          .limit(1);

        const [homeClub] = await db
          .select({ name: clubs.name })
          .from(clubs)
          .where(eq(clubs.id, homeTeam.clubId))
          .limit(1);

        const [awayClub] = await db
          .select({ name: clubs.name })
          .from(clubs)
          .where(eq(clubs.id, awayTeam.clubId))
          .limit(1);

        return {
          id: game.id,
          homeTeam: {
            id: homeTeam.id,
            name: homeTeam.name,
            clubName: homeClub?.name ?? "Unknown",
          },
          awayTeam: {
            id: awayTeam.id,
            name: awayTeam.name,
            clubName: awayClub?.name ?? "Unknown",
          },
          homeScore: game.homeScore,
          awayScore: game.awayScore,
          status: game.status,
          scheduledAt: game.scheduledAt.toISOString(),
          venue: game.venue,
          isLive: game.status === "live",
          hasStream: game.liveStreamId !== null,
        };
      })
    );

    // Get season info
    let season: { id: number; name: string } | null = null;
    if (team.seasonId) {
      const seasonResult = await db.query.seasons.findFirst({
        where: (s, { eq: e }) => e(s.id, team.seasonId!),
      });
      if (seasonResult) {
        season = { id: seasonResult.id, name: seasonResult.name };
      }
    }

    const result: TeamWithRoster = {
      id: team.id,
      name: team.name,
      ageGroup: team.ageGroup,
      gender: team.gender,
      division: team.division,
      headCoachName,
      playerCount: roster.length,
      record: {
        wins: standing?.wins ?? 0,
        losses: standing?.losses ?? 0,
      },
      roster,
      upcomingGames,
      season,
    };

    res.json({
      success: true,
      data: result,
    } satisfies ApiResponse<TeamWithRoster>);
  } catch (err) {
    console.error("[Teams] Error fetching team:", err);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to fetch team." },
    } satisfies ApiResponse);
  }
});

/**
 * POST /api/clubs/:clubId/teams
 * Create a new team within a club.
 */
router.post(
  "/api/clubs/:clubId/teams",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const clubId = parseInt(req.params.clubId, 10);
      if (isNaN(clubId)) {
        res.status(400).json({
          success: false,
          error: { code: "INVALID_ID", message: "Invalid club ID." },
        } satisfies ApiResponse);
        return;
      }

      const user = req.user!;

      // Verify user is owner, admin, or coach of the club
      const [membership] = await db
        .select()
        .from(clubMemberships)
        .where(
          and(
            eq(clubMemberships.clubId, clubId),
            eq(clubMemberships.userId, user.id)
          )
        )
        .limit(1);

      if (
        !membership ||
        !["owner", "admin", "coach"].includes(membership.role)
      ) {
        res.status(403).json({
          success: false,
          error: {
            code: "FORBIDDEN",
            message:
              "You must be an owner, admin, or coach to create a team.",
          },
        } satisfies ApiResponse);
        return;
      }

      const validation = createTeamSchema.safeParse(req.body);
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

      const data = validation.data;

      const [newTeam] = await db
        .insert(teams)
        .values({
          clubId,
          name: data.name,
          ageGroup: data.ageGroup,
          gender: data.gender,
          division: data.division ?? null,
          maxRosterSize: data.maxRosterSize,
          headCoachId: user.role === "coach" ? user.id : null,
          isActive: true,
        })
        .returning();

      res.status(201).json({
        success: true,
        data: newTeam,
      } satisfies ApiResponse);
    } catch (err) {
      console.error("[Teams] Error creating team:", err);
      res.status(500).json({
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to create team." },
      } satisfies ApiResponse);
    }
  }
);

/**
 * PUT /api/teams/:id
 * Update a team. Requires club owner/admin/coach role.
 */
router.put(
  "/api/teams/:id",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const teamId = parseInt(req.params.id, 10);
      if (isNaN(teamId)) {
        res.status(400).json({
          success: false,
          error: { code: "INVALID_ID", message: "Invalid team ID." },
        } satisfies ApiResponse);
        return;
      }

      const user = req.user!;

      // Fetch team to get clubId
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

      // Verify club membership role
      const [membership] = await db
        .select()
        .from(clubMemberships)
        .where(
          and(
            eq(clubMemberships.clubId, team.clubId),
            eq(clubMemberships.userId, user.id)
          )
        )
        .limit(1);

      if (
        !membership ||
        !["owner", "admin", "coach"].includes(membership.role)
      ) {
        res.status(403).json({
          success: false,
          error: {
            code: "FORBIDDEN",
            message:
              "You must be an owner, admin, or coach to update this team.",
          },
        } satisfies ApiResponse);
        return;
      }

      const validation = createTeamSchema.partial().safeParse(req.body);
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
        .update(teams)
        .set(validation.data)
        .where(eq(teams.id, teamId))
        .returning();

      res.json({ success: true, data: updated } satisfies ApiResponse);
    } catch (err) {
      console.error("[Teams] Error updating team:", err);
      res.status(500).json({
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to update team." },
      } satisfies ApiResponse);
    }
  }
);

/**
 * POST /api/teams/:id/roster
 * Add a player to the team roster.
 */
router.post(
  "/api/teams/:id/roster",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const teamId = parseInt(req.params.id, 10);
      if (isNaN(teamId)) {
        res.status(400).json({
          success: false,
          error: { code: "INVALID_ID", message: "Invalid team ID." },
        } satisfies ApiResponse);
        return;
      }

      const { playerId, status = "active" } = req.body;
      if (!playerId || typeof playerId !== "number") {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "playerId (number) is required.",
          },
        } satisfies ApiResponse);
        return;
      }

      const user = req.user!;

      // Fetch team
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

      // Verify club membership role
      const [membership] = await db
        .select()
        .from(clubMemberships)
        .where(
          and(
            eq(clubMemberships.clubId, team.clubId),
            eq(clubMemberships.userId, user.id)
          )
        )
        .limit(1);

      if (
        !membership ||
        !["owner", "admin", "coach"].includes(membership.role)
      ) {
        res.status(403).json({
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "You must be an owner, admin, or coach to manage the roster.",
          },
        } satisfies ApiResponse);
        return;
      }

      // Check roster capacity
      const [rosterCount] = await db
        .select({ total: count() })
        .from(teamRosters)
        .where(eq(teamRosters.teamId, teamId));

      if (Number(rosterCount?.total ?? 0) >= team.maxRosterSize) {
        res.status(409).json({
          success: false,
          error: {
            code: "ROSTER_FULL",
            message: `The roster is full (max ${team.maxRosterSize} players).`,
          },
        } satisfies ApiResponse);
        return;
      }

      // Verify player exists
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

      const [rosterEntry] = await db
        .insert(teamRosters)
        .values({
          teamId,
          playerId,
          status: status as "active" | "injured" | "inactive" | "tryout",
          joinedDate: new Date().toISOString().split("T")[0],
        })
        .onConflictDoNothing()
        .returning();

      if (!rosterEntry) {
        res.status(409).json({
          success: false,
          error: {
            code: "ALREADY_ON_ROSTER",
            message: "This player is already on the roster.",
          },
        } satisfies ApiResponse);
        return;
      }

      res.status(201).json({
        success: true,
        data: rosterEntry,
      } satisfies ApiResponse);
    } catch (err) {
      console.error("[Teams] Error adding to roster:", err);
      res.status(500).json({
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to add player to roster." },
      } satisfies ApiResponse);
    }
  }
);

/**
 * DELETE /api/teams/:id/roster/:playerId
 * Remove a player from the team roster.
 */
router.delete(
  "/api/teams/:id/roster/:playerId",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const teamId = parseInt(req.params.id, 10);
      const playerId = parseInt(req.params.playerId, 10);

      if (isNaN(teamId) || isNaN(playerId)) {
        res.status(400).json({
          success: false,
          error: { code: "INVALID_ID", message: "Invalid team or player ID." },
        } satisfies ApiResponse);
        return;
      }

      const user = req.user!;

      // Fetch team
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

      // Verify club membership role
      const [membership] = await db
        .select()
        .from(clubMemberships)
        .where(
          and(
            eq(clubMemberships.clubId, team.clubId),
            eq(clubMemberships.userId, user.id)
          )
        )
        .limit(1);

      if (
        !membership ||
        !["owner", "admin", "coach"].includes(membership.role)
      ) {
        res.status(403).json({
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "You must be an owner, admin, or coach to manage the roster.",
          },
        } satisfies ApiResponse);
        return;
      }

      const deleted = await db
        .delete(teamRosters)
        .where(
          and(
            eq(teamRosters.teamId, teamId),
            eq(teamRosters.playerId, playerId)
          )
        )
        .returning();

      if (deleted.length === 0) {
        res.status(404).json({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Player is not on this team's roster.",
          },
        } satisfies ApiResponse);
        return;
      }

      res.json({
        success: true,
        data: { removed: true, teamId, playerId },
      } satisfies ApiResponse);
    } catch (err) {
      console.error("[Teams] Error removing from roster:", err);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to remove player from roster.",
        },
      } satisfies ApiResponse);
    }
  }
);

export default router;
