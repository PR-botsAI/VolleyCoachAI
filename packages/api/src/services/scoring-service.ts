import { eq, and } from "drizzle-orm";
import { db } from "../lib/db";
import { games, sets, points } from "@volleycoach/shared/schema";
import { VOLLEYBALL, WS_EVENTS } from "@volleycoach/shared/constants";
import type { LiveScoreUpdate } from "@volleycoach/shared/types";
import { broadcastToGame } from "../realtime/websocket";

interface ScorePointInput {
  gameId: number;
  scoringTeamId: number;
  playerId?: number;
  pointType?: string;
}

interface ScoreResult {
  success: boolean;
  currentSet: {
    setNumber: number;
    homePoints: number;
    awayPoints: number;
    isSetOver: boolean;
    winnerTeamId: number | null;
  };
  game: {
    homeScore: number;
    awayScore: number;
    isGameOver: boolean;
    winnerTeamId: number | null;
  };
  liveUpdate: LiveScoreUpdate;
}

/**
 * Scores a single point in a volleyball game.
 * Implements official volleyball rules:
 * - Sets 1-4: first to 25, win by 2
 * - Set 5 (deciding): first to 15, win by 2
 * - Best of 5 sets
 * - Auto-transitions between sets
 */
export async function scorePoint(input: ScorePointInput): Promise<ScoreResult> {
  const game = await db.query.games.findFirst({
    where: eq(games.id, input.gameId),
    with: {
      sets: { orderBy: (s, { asc }) => [asc(s.setNumber)] },
    },
  });

  if (!game) throw new Error("Game not found");
  if (game.status !== "live") throw new Error("Game is not live");

  // Find or create current active set
  let currentSet = game.sets?.find((s) => s.status === "in_progress");

  if (!currentSet) {
    // Start next set
    const nextSetNumber = (game.sets?.length ?? 0) + 1;
    if (nextSetNumber > VOLLEYBALL.MAX_SETS) {
      throw new Error("Maximum sets reached");
    }

    const [newSet] = await db
      .insert(sets)
      .values({
        gameId: game.id,
        setNumber: nextSetNumber,
        homePoints: 0,
        awayPoints: 0,
        status: "in_progress",
        startedAt: new Date(),
      })
      .returning();

    currentSet = newSet;
  }

  // Determine which side scored
  const isHomeScoringTeam = input.scoringTeamId === game.homeTeamId;
  const newHomePoints = currentSet.homePoints + (isHomeScoringTeam ? 1 : 0);
  const newAwayPoints = currentSet.awayPoints + (isHomeScoringTeam ? 0 : 1);

  // Record the point
  await db.insert(points).values({
    setId: currentSet.id,
    scoringTeamId: input.scoringTeamId,
    playerId: input.playerId ?? null,
    pointType: (input.pointType as any) ?? "other",
    homeScoreAfter: newHomePoints,
    awayScoreAfter: newAwayPoints,
  });

  // Update set score
  await db
    .update(sets)
    .set({
      homePoints: newHomePoints,
      awayPoints: newAwayPoints,
    })
    .where(eq(sets.id, currentSet.id));

  // Check if set is over
  const isFinalSet = currentSet.setNumber === VOLLEYBALL.MAX_SETS;
  const targetPoints = isFinalSet
    ? VOLLEYBALL.POINTS_TO_WIN_FINAL_SET
    : VOLLEYBALL.POINTS_TO_WIN_SET;

  const maxPoints = Math.max(newHomePoints, newAwayPoints);
  const minPoints = Math.min(newHomePoints, newAwayPoints);
  const lead = maxPoints - minPoints;
  const isSetOver =
    maxPoints >= targetPoints && lead >= VOLLEYBALL.MIN_LEAD_TO_WIN;

  let setWinnerId: number | null = null;
  if (isSetOver) {
    setWinnerId =
      newHomePoints > newAwayPoints ? game.homeTeamId : game.awayTeamId;

    await db
      .update(sets)
      .set({
        status: "completed",
        winnerTeamId: setWinnerId,
        endedAt: new Date(),
      })
      .where(eq(sets.id, currentSet.id));
  }

  // Calculate sets won
  const completedSets = [
    ...(game.sets?.filter((s) => s.status === "completed") ?? []),
    ...(isSetOver
      ? [{ ...currentSet, winnerTeamId: setWinnerId, status: "completed" as const }]
      : []),
  ];

  const homeSetsWon = completedSets.filter(
    (s) => s.winnerTeamId === game.homeTeamId
  ).length;
  const awaySetsWon = completedSets.filter(
    (s) => s.winnerTeamId === game.awayTeamId
  ).length;

  // Check if match is over
  const isGameOver =
    homeSetsWon >= VOLLEYBALL.SETS_TO_WIN_MATCH ||
    awaySetsWon >= VOLLEYBALL.SETS_TO_WIN_MATCH;

  let matchWinnerId: number | null = null;
  if (isGameOver) {
    matchWinnerId =
      homeSetsWon >= VOLLEYBALL.SETS_TO_WIN_MATCH
        ? game.homeTeamId
        : game.awayTeamId;

    await db
      .update(games)
      .set({
        homeScore: homeSetsWon,
        awayScore: awaySetsWon,
        winnerTeamId: matchWinnerId,
        status: "completed",
        endedAt: new Date(),
      })
      .where(eq(games.id, game.id));
  } else {
    await db
      .update(games)
      .set({
        homeScore: homeSetsWon,
        awayScore: awaySetsWon,
      })
      .where(eq(games.id, game.id));
  }

  const liveUpdate: LiveScoreUpdate = {
    gameId: game.id,
    setNumber: currentSet.setNumber,
    homePoints: newHomePoints,
    awayPoints: newAwayPoints,
    homeSetsWon,
    awaySetsWon,
    pointType: input.pointType ?? null,
    scoringPlayerId: input.playerId ?? null,
    timestamp: new Date().toISOString(),
  };

  // Broadcast live score update via WebSocket
  broadcastToGame(game.id, WS_EVENTS.SCORE_UPDATE, liveUpdate);

  if (isSetOver) {
    broadcastToGame(game.id, WS_EVENTS.GAME_SET_ENDED, {
      gameId: game.id,
      setNumber: currentSet.setNumber,
      homePoints: newHomePoints,
      awayPoints: newAwayPoints,
      winnerTeamId: setWinnerId,
      homeSetsWon,
      awaySetsWon,
    });
  }

  if (isGameOver) {
    broadcastToGame(game.id, WS_EVENTS.GAME_ENDED, {
      gameId: game.id,
      winnerTeamId: matchWinnerId,
      finalScore: { home: homeSetsWon, away: awaySetsWon },
    });
  }

  return {
    success: true,
    currentSet: {
      setNumber: currentSet.setNumber,
      homePoints: newHomePoints,
      awayPoints: newAwayPoints,
      isSetOver,
      winnerTeamId: setWinnerId,
    },
    game: {
      homeScore: homeSetsWon,
      awayScore: awaySetsWon,
      isGameOver,
      winnerTeamId: matchWinnerId,
    },
    liveUpdate,
  };
}

/**
 * Starts a game - transitions from scheduled to live, creates first set.
 */
export async function startGame(gameId: number): Promise<void> {
  const game = await db.query.games.findFirst({
    where: eq(games.id, gameId),
  });

  if (!game) throw new Error("Game not found");
  if (game.status !== "scheduled") throw new Error("Game is not in scheduled state");

  await db
    .update(games)
    .set({ status: "live", startedAt: new Date() })
    .where(eq(games.id, gameId));

  // Create first set
  await db.insert(sets).values({
    gameId,
    setNumber: 1,
    homePoints: 0,
    awayPoints: 0,
    status: "in_progress",
    startedAt: new Date(),
  });

  broadcastToGame(gameId, WS_EVENTS.GAME_STATUS_CHANGED, {
    gameId,
    status: "live",
  });
}
