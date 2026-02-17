import { Router, type Request, type Response } from "express";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { db } from "../lib/db.js";
import {
  games,
  sets,
  points,
  teams,
  clubs,
  standings,
  createGameSchema,
  scorePointSchema,
  VOLLEYBALL,
  WS_EVENTS,
} from "@volleycoach/shared";
import type {
  ApiResponse,
  GameSummary,
  GameDetail,
  SetDetail,
  LiveScoreUpdate,
} from "@volleycoach/shared";
import { requireAuth } from "../middleware/auth.js";
import { requireTier } from "../middleware/tier-gate.js";
import { broadcastToGame } from "../realtime/websocket.js";

const router = Router();

/**
 * Helper: Build a GameSummary from a game record.
 */
async function buildGameSummary(game: typeof games.$inferSelect): Promise<GameSummary> {
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
}

/**
 * GET /api/games
 * List games with optional filters: status, teamId, startDate, endDate.
 */
router.get("/api/games", async (req: Request, res: Response) => {
  try {
    const {
      status,
      teamId,
      startDate,
      endDate,
      page = "1",
      limit = "20",
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];

    if (status && typeof status === "string") {
      conditions.push(eq(games.status, status as typeof games.status.enumValues[number]));
    }

    if (teamId) {
      const tid = parseInt(teamId as string, 10);
      if (!isNaN(tid)) {
        // Games where the team is either home or away - we filter in JS after fetch
        // since Drizzle OR is a bit verbose, we just fetch broadly and filter
      }
    }

    if (startDate && typeof startDate === "string") {
      conditions.push(gte(games.scheduledAt, new Date(startDate)));
    }

    if (endDate && typeof endDate === "string") {
      conditions.push(lte(games.scheduledAt, new Date(endDate)));
    }

    let whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    let gameResults = await db
      .select()
      .from(games)
      .where(whereClause)
      .orderBy(desc(games.scheduledAt))
      .limit(limitNum + 1) // Fetch one extra to check hasMore
      .offset(offset);

    // If teamId filter, apply it in JS (home or away)
    if (teamId) {
      const tid = parseInt(teamId as string, 10);
      if (!isNaN(tid)) {
        gameResults = gameResults.filter(
          (g) => g.homeTeamId === tid || g.awayTeamId === tid
        );
      }
    }

    const hasMore = gameResults.length > limitNum;
    if (hasMore) gameResults.pop();

    const gameSummaries: GameSummary[] = await Promise.all(
      gameResults.map(buildGameSummary)
    );

    res.json({
      success: true,
      data: gameSummaries,
      meta: {
        page: pageNum,
        limit: limitNum,
        hasMore,
      },
    } satisfies ApiResponse<GameSummary[]>);
  } catch (err) {
    console.error("[Games] Error listing games:", err);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to list games." },
    } satisfies ApiResponse);
  }
});

/**
 * GET /api/games/:id
 * Get full game detail including all sets.
 */
router.get("/api/games/:id", async (req: Request, res: Response) => {
  try {
    const gameId = parseInt(req.params.id, 10);
    if (isNaN(gameId)) {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_ID", message: "Invalid game ID." },
      } satisfies ApiResponse);
      return;
    }

    const [game] = await db
      .select()
      .from(games)
      .where(eq(games.id, gameId))
      .limit(1);

    if (!game) {
      res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Game not found." },
      } satisfies ApiResponse);
      return;
    }

    const summary = await buildGameSummary(game);

    // Get sets
    const setResults = await db
      .select()
      .from(sets)
      .where(eq(sets.gameId, gameId))
      .orderBy(sets.setNumber);

    const setDetails: SetDetail[] = setResults.map((s) => ({
      setNumber: s.setNumber,
      homePoints: s.homePoints,
      awayPoints: s.awayPoints,
      status: s.status,
      winnerTeamId: s.winnerTeamId,
    }));

    const detail: GameDetail = {
      ...summary,
      sets: setDetails,
      liveStream: null, // Live stream details fetched separately via streaming routes
    };

    res.json({
      success: true,
      data: detail,
    } satisfies ApiResponse<GameDetail>);
  } catch (err) {
    console.error("[Games] Error fetching game:", err);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to fetch game." },
    } satisfies ApiResponse);
  }
});

/**
 * POST /api/games
 * Create a new game. Requires starter tier or above.
 */
router.post(
  "/api/games",
  requireAuth,
  requireTier("starter"),
  async (req: Request, res: Response) => {
    try {
      const validation = createGameSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid game data.",
            details: validation.error.flatten(),
          },
        } satisfies ApiResponse);
        return;
      }

      const data = validation.data;

      // Verify both teams exist
      const [homeTeam] = await db
        .select()
        .from(teams)
        .where(eq(teams.id, data.homeTeamId))
        .limit(1);
      const [awayTeam] = await db
        .select()
        .from(teams)
        .where(eq(teams.id, data.awayTeamId))
        .limit(1);

      if (!homeTeam || !awayTeam) {
        res.status(404).json({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "One or both teams not found.",
          },
        } satisfies ApiResponse);
        return;
      }

      if (data.homeTeamId === data.awayTeamId) {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "A team cannot play against itself.",
          },
        } satisfies ApiResponse);
        return;
      }

      const [newGame] = await db
        .insert(games)
        .values({
          homeTeamId: data.homeTeamId,
          awayTeamId: data.awayTeamId,
          scheduledAt: new Date(data.scheduledAt),
          venue: data.venue ?? null,
          seasonId: data.seasonId ?? null,
          tournamentId: data.tournamentId ?? null,
          isPlayoff: data.isPlayoff,
          status: "scheduled",
          homeScore: 0,
          awayScore: 0,
        })
        .returning();

      res.status(201).json({
        success: true,
        data: newGame,
      } satisfies ApiResponse);
    } catch (err) {
      console.error("[Games] Error creating game:", err);
      res.status(500).json({
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to create game." },
      } satisfies ApiResponse);
    }
  }
);

/**
 * POST /api/games/:id/start
 * Start a game. Changes status to "live" and creates the first set.
 */
router.post(
  "/api/games/:id/start",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const gameId = parseInt(req.params.id, 10);
      if (isNaN(gameId)) {
        res.status(400).json({
          success: false,
          error: { code: "INVALID_ID", message: "Invalid game ID." },
        } satisfies ApiResponse);
        return;
      }

      const [game] = await db
        .select()
        .from(games)
        .where(eq(games.id, gameId))
        .limit(1);

      if (!game) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Game not found." },
        } satisfies ApiResponse);
        return;
      }

      if (game.status !== "scheduled") {
        res.status(400).json({
          success: false,
          error: {
            code: "INVALID_STATE",
            message: `Cannot start a game with status "${game.status}". Only scheduled games can be started.`,
          },
        } satisfies ApiResponse);
        return;
      }

      // Update game status to live
      await db
        .update(games)
        .set({ status: "live", startedAt: new Date() })
        .where(eq(games.id, gameId));

      // Create the first set
      const [firstSet] = await db
        .insert(sets)
        .values({
          gameId,
          setNumber: 1,
          homePoints: 0,
          awayPoints: 0,
          status: "in_progress",
          startedAt: new Date(),
        })
        .returning();

      broadcastToGame(gameId, WS_EVENTS.GAME_STATUS_CHANGED, {
        gameId,
        status: "live",
        setNumber: 1,
      });

      res.json({
        success: true,
        data: {
          gameId,
          status: "live",
          currentSet: firstSet,
        },
      } satisfies ApiResponse);
    } catch (err) {
      console.error("[Games] Error starting game:", err);
      res.status(500).json({
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to start game." },
      } satisfies ApiResponse);
    }
  }
);

/**
 * POST /api/games/:id/score
 * Score a point in a live game. Implements volleyball scoring rules:
 * - Sets 1-4: first to 25 points, win by 2
 * - Set 5: first to 15 points, win by 2
 * - Best of 5 sets (first to 3 set wins)
 * - Auto set transitions
 */
router.post(
  "/api/games/:id/score",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const gameId = parseInt(req.params.id, 10);
      if (isNaN(gameId)) {
        res.status(400).json({
          success: false,
          error: { code: "INVALID_ID", message: "Invalid game ID." },
        } satisfies ApiResponse);
        return;
      }

      const body = { ...req.body, gameId };
      const validation = scorePointSchema.safeParse(body);
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid score data.",
            details: validation.error.flatten(),
          },
        } satisfies ApiResponse);
        return;
      }

      const { setId, scoringTeamId, playerId, pointType } = validation.data;

      // Fetch game
      const [game] = await db
        .select()
        .from(games)
        .where(eq(games.id, gameId))
        .limit(1);

      if (!game) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Game not found." },
        } satisfies ApiResponse);
        return;
      }

      if (game.status !== "live") {
        res.status(400).json({
          success: false,
          error: {
            code: "INVALID_STATE",
            message: "Can only score points in a live game.",
          },
        } satisfies ApiResponse);
        return;
      }

      // Validate scoring team is part of this game
      if (
        scoringTeamId !== game.homeTeamId &&
        scoringTeamId !== game.awayTeamId
      ) {
        res.status(400).json({
          success: false,
          error: {
            code: "INVALID_TEAM",
            message: "Scoring team is not part of this game.",
          },
        } satisfies ApiResponse);
        return;
      }

      // Fetch current set
      const [currentSet] = await db
        .select()
        .from(sets)
        .where(eq(sets.id, setId))
        .limit(1);

      if (!currentSet || currentSet.gameId !== gameId) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Set not found for this game." },
        } satisfies ApiResponse);
        return;
      }

      if (currentSet.status !== "in_progress") {
        res.status(400).json({
          success: false,
          error: {
            code: "INVALID_STATE",
            message: "This set is not in progress.",
          },
        } satisfies ApiResponse);
        return;
      }

      // Calculate new scores
      const isHomeScoring = scoringTeamId === game.homeTeamId;
      const newHomePoints = currentSet.homePoints + (isHomeScoring ? 1 : 0);
      const newAwayPoints = currentSet.awayPoints + (!isHomeScoring ? 1 : 0);

      // Record the point
      await db.insert(points).values({
        setId,
        scoringTeamId,
        playerId: playerId ?? null,
        pointType,
        homeScoreAfter: newHomePoints,
        awayScoreAfter: newAwayPoints,
      });

      // Update set scores
      await db
        .update(sets)
        .set({
          homePoints: newHomePoints,
          awayPoints: newAwayPoints,
        })
        .where(eq(sets.id, setId));

      // Check if this set is won
      const isFinalSet = currentSet.setNumber === VOLLEYBALL.MAX_SETS;
      const pointsToWin = isFinalSet
        ? VOLLEYBALL.POINTS_TO_WIN_FINAL_SET
        : VOLLEYBALL.POINTS_TO_WIN_SET;

      const leadingPoints = Math.max(newHomePoints, newAwayPoints);
      const trailingPoints = Math.min(newHomePoints, newAwayPoints);
      const lead = leadingPoints - trailingPoints;
      const setWon =
        leadingPoints >= pointsToWin && lead >= VOLLEYBALL.MIN_LEAD_TO_WIN;

      // Count current set wins
      const allSets = await db
        .select()
        .from(sets)
        .where(eq(sets.gameId, gameId))
        .orderBy(sets.setNumber);

      let homeSetsWon = 0;
      let awaySetsWon = 0;
      for (const s of allSets) {
        if (s.status === "completed" && s.winnerTeamId) {
          if (s.winnerTeamId === game.homeTeamId) homeSetsWon++;
          else awaySetsWon++;
        }
      }

      let gameEnded = false;
      let setEnded = false;

      if (setWon) {
        setEnded = true;
        const setWinnerTeamId =
          newHomePoints > newAwayPoints ? game.homeTeamId : game.awayTeamId;

        // Mark set as completed
        await db
          .update(sets)
          .set({
            status: "completed",
            winnerTeamId: setWinnerTeamId,
            endedAt: new Date(),
          })
          .where(eq(sets.id, setId));

        // Update set win counts
        if (setWinnerTeamId === game.homeTeamId) homeSetsWon++;
        else awaySetsWon++;

        // Update game set scores
        await db
          .update(games)
          .set({
            homeScore: homeSetsWon,
            awayScore: awaySetsWon,
          })
          .where(eq(games.id, gameId));

        // Broadcast set end
        broadcastToGame(gameId, WS_EVENTS.GAME_SET_ENDED, {
          gameId,
          setNumber: currentSet.setNumber,
          homePoints: newHomePoints,
          awayPoints: newAwayPoints,
          winnerTeamId: setWinnerTeamId,
          homeSetsWon,
          awaySetsWon,
        });

        // Check if match is won (best of 5 = first to 3 sets)
        if (
          homeSetsWon >= VOLLEYBALL.SETS_TO_WIN_MATCH ||
          awaySetsWon >= VOLLEYBALL.SETS_TO_WIN_MATCH
        ) {
          gameEnded = true;
          const matchWinnerTeamId =
            homeSetsWon >= VOLLEYBALL.SETS_TO_WIN_MATCH
              ? game.homeTeamId
              : game.awayTeamId;

          await db
            .update(games)
            .set({
              status: "completed",
              winnerTeamId: matchWinnerTeamId,
              endedAt: new Date(),
            })
            .where(eq(games.id, gameId));

          broadcastToGame(gameId, WS_EVENTS.GAME_ENDED, {
            gameId,
            winnerTeamId: matchWinnerTeamId,
            homeSetsWon,
            awaySetsWon,
            finalScore: `${homeSetsWon}-${awaySetsWon}`,
          });
        } else {
          // Create next set
          const nextSetNumber = currentSet.setNumber + 1;
          await db.insert(sets).values({
            gameId,
            setNumber: nextSetNumber,
            homePoints: 0,
            awayPoints: 0,
            status: "in_progress",
            startedAt: new Date(),
          });
        }
      }

      // Broadcast score update
      const scoreUpdate: LiveScoreUpdate = {
        gameId,
        setNumber: currentSet.setNumber,
        homePoints: newHomePoints,
        awayPoints: newAwayPoints,
        homeSetsWon,
        awaySetsWon,
        pointType,
        scoringPlayerId: playerId ?? null,
        timestamp: new Date().toISOString(),
      };

      broadcastToGame(gameId, WS_EVENTS.GAME_POINT_SCORED, scoreUpdate);

      res.json({
        success: true,
        data: {
          ...scoreUpdate,
          setWon: setEnded,
          gameEnded,
        },
      } satisfies ApiResponse);
    } catch (err) {
      console.error("[Games] Error scoring point:", err);
      res.status(500).json({
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to score point." },
      } satisfies ApiResponse);
    }
  }
);

/**
 * POST /api/games/:id/end
 * Manually end a game. Updates standings for both teams.
 */
router.post(
  "/api/games/:id/end",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const gameId = parseInt(req.params.id, 10);
      if (isNaN(gameId)) {
        res.status(400).json({
          success: false,
          error: { code: "INVALID_ID", message: "Invalid game ID." },
        } satisfies ApiResponse);
        return;
      }

      const [game] = await db
        .select()
        .from(games)
        .where(eq(games.id, gameId))
        .limit(1);

      if (!game) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Game not found." },
        } satisfies ApiResponse);
        return;
      }

      if (game.status !== "live") {
        res.status(400).json({
          success: false,
          error: {
            code: "INVALID_STATE",
            message: "Can only end a live game.",
          },
        } satisfies ApiResponse);
        return;
      }

      // Get all completed sets
      const allSets = await db
        .select()
        .from(sets)
        .where(eq(sets.gameId, gameId))
        .orderBy(sets.setNumber);

      let homeSetsWon = 0;
      let awaySetsWon = 0;
      let totalHomePoints = 0;
      let totalAwayPoints = 0;

      for (const s of allSets) {
        totalHomePoints += s.homePoints;
        totalAwayPoints += s.awayPoints;
        if (s.status === "completed" && s.winnerTeamId) {
          if (s.winnerTeamId === game.homeTeamId) homeSetsWon++;
          else awaySetsWon++;
        }
        // Mark any in-progress set as completed
        if (s.status === "in_progress") {
          const setWinner =
            s.homePoints > s.awayPoints ? game.homeTeamId : game.awayTeamId;
          await db
            .update(sets)
            .set({
              status: "completed",
              winnerTeamId: setWinner,
              endedAt: new Date(),
            })
            .where(eq(sets.id, s.id));

          if (setWinner === game.homeTeamId) homeSetsWon++;
          else awaySetsWon++;
        }
      }

      const winnerTeamId =
        homeSetsWon >= awaySetsWon ? game.homeTeamId : game.awayTeamId;
      const loserTeamId =
        winnerTeamId === game.homeTeamId ? game.awayTeamId : game.homeTeamId;

      // Update game record
      await db
        .update(games)
        .set({
          status: "completed",
          homeScore: homeSetsWon,
          awayScore: awaySetsWon,
          winnerTeamId,
          endedAt: new Date(),
        })
        .where(eq(games.id, gameId));

      // Update standings for both teams (if seasonId exists)
      if (game.seasonId) {
        await updateStandings(
          winnerTeamId,
          game.seasonId,
          true,
          homeSetsWon >= awaySetsWon ? homeSetsWon : awaySetsWon,
          homeSetsWon >= awaySetsWon ? awaySetsWon : homeSetsWon,
          winnerTeamId === game.homeTeamId ? totalHomePoints : totalAwayPoints,
          winnerTeamId === game.homeTeamId ? totalAwayPoints : totalHomePoints
        );

        await updateStandings(
          loserTeamId,
          game.seasonId,
          false,
          homeSetsWon < awaySetsWon ? homeSetsWon : awaySetsWon,
          homeSetsWon < awaySetsWon ? awaySetsWon : homeSetsWon,
          loserTeamId === game.homeTeamId ? totalHomePoints : totalAwayPoints,
          loserTeamId === game.homeTeamId ? totalAwayPoints : totalHomePoints
        );
      }

      broadcastToGame(gameId, WS_EVENTS.GAME_ENDED, {
        gameId,
        winnerTeamId,
        homeSetsWon,
        awaySetsWon,
        finalScore: `${homeSetsWon}-${awaySetsWon}`,
      });

      res.json({
        success: true,
        data: {
          gameId,
          status: "completed",
          winnerTeamId,
          homeScore: homeSetsWon,
          awayScore: awaySetsWon,
        },
      } satisfies ApiResponse);
    } catch (err) {
      console.error("[Games] Error ending game:", err);
      res.status(500).json({
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to end game." },
      } satisfies ApiResponse);
    }
  }
);

/**
 * Helper: Update or insert standings for a team after a game ends.
 */
async function updateStandings(
  teamId: number,
  seasonId: number,
  isWin: boolean,
  setsWon: number,
  setsLost: number,
  pointsScored: number,
  pointsAllowed: number
): Promise<void> {
  // Try to find existing standing
  const [existing] = await db
    .select()
    .from(standings)
    .where(and(eq(standings.teamId, teamId), eq(standings.seasonId, seasonId)))
    .limit(1);

  if (existing) {
    const newWins = existing.wins + (isWin ? 1 : 0);
    const newLosses = existing.losses + (isWin ? 0 : 1);
    const totalGames = newWins + newLosses;
    const winPct = totalGames > 0 ? (newWins / totalGames).toFixed(4) : "0";

    await db
      .update(standings)
      .set({
        wins: newWins,
        losses: newLosses,
        setsWon: existing.setsWon + setsWon,
        setsLost: existing.setsLost + setsLost,
        pointsScored: existing.pointsScored + pointsScored,
        pointsAllowed: existing.pointsAllowed + pointsAllowed,
        winPercentage: winPct,
        lastUpdated: new Date(),
      })
      .where(eq(standings.id, existing.id));
  } else {
    const totalGames = 1;
    const winPct = isWin ? "1.0000" : "0.0000";

    await db.insert(standings).values({
      teamId,
      seasonId,
      wins: isWin ? 1 : 0,
      losses: isWin ? 0 : 1,
      setsWon,
      setsLost,
      pointsScored,
      pointsAllowed,
      winPercentage: winPct,
    });
  }
}

export default router;
