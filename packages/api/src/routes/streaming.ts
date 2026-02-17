import { Router, type Request, type Response } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../lib/db.js";
import {
  liveStreams,
  clubs,
  users,
  games,
  teams,
  createStreamSchema,
  clubMemberships,
  WS_EVENTS,
} from "@volleycoach/shared";
import type { ApiResponse, LiveStreamInfo, GameSummary } from "@volleycoach/shared";
import { requireAuth } from "../middleware/auth.js";
import { requireTier } from "../middleware/tier-gate.js";
import { broadcastToStream, getStreamViewerCount } from "../realtime/websocket.js";

const router = Router();

/**
 * Helper: Build LiveStreamInfo from a stream record.
 */
async function buildStreamInfo(
  stream: typeof liveStreams.$inferSelect
): Promise<LiveStreamInfo> {
  // Get streamer name
  const [streamer] = await db
    .select({ fullName: users.fullName })
    .from(users)
    .where(eq(users.id, stream.streamerId))
    .limit(1);

  // Get club name
  const [club] = await db
    .select({ name: clubs.name })
    .from(clubs)
    .where(eq(clubs.id, stream.clubId))
    .limit(1);

  // Get game summary if linked
  let gameSummary: GameSummary | null = null;
  if (stream.gameId) {
    const [game] = await db
      .select()
      .from(games)
      .where(eq(games.id, stream.gameId))
      .limit(1);

    if (game) {
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

      gameSummary = {
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
        hasStream: true,
      };
    }
  }

  return {
    id: stream.id,
    title: stream.title,
    playbackId: stream.muxPlaybackId,
    status: stream.status,
    viewerCount: stream.status === "live" ? getStreamViewerCount(stream.id) : 0,
    startedAt: stream.startedAt?.toISOString() ?? null,
    streamerName: streamer?.fullName ?? "Unknown",
    clubName: club?.name ?? "Unknown",
    game: gameSummary,
  };
}

/**
 * GET /api/streams
 * List active/live streams (public).
 */
router.get("/api/streams", async (req: Request, res: Response) => {
  try {
    const { status = "live" } = req.query;

    let streamResults;
    if (status === "all") {
      streamResults = await db
        .select()
        .from(liveStreams)
        .orderBy(liveStreams.createdAt)
        .limit(50);
    } else {
      streamResults = await db
        .select()
        .from(liveStreams)
        .where(
          eq(
            liveStreams.status,
            status as typeof liveStreams.status.enumValues[number]
          )
        )
        .orderBy(liveStreams.createdAt)
        .limit(50);
    }

    const streams: LiveStreamInfo[] = await Promise.all(
      streamResults.map(buildStreamInfo)
    );

    res.json({
      success: true,
      data: streams,
    } satisfies ApiResponse<LiveStreamInfo[]>);
  } catch (err) {
    console.error("[Streaming] Error listing streams:", err);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to list streams." },
    } satisfies ApiResponse);
  }
});

/**
 * GET /api/streams/:id
 * Get details for a specific stream.
 */
router.get("/api/streams/:id", async (req: Request, res: Response) => {
  try {
    const streamId = parseInt(req.params.id, 10);
    if (isNaN(streamId)) {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_ID", message: "Invalid stream ID." },
      } satisfies ApiResponse);
      return;
    }

    const [stream] = await db
      .select()
      .from(liveStreams)
      .where(eq(liveStreams.id, streamId))
      .limit(1);

    if (!stream) {
      res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Stream not found." },
      } satisfies ApiResponse);
      return;
    }

    const info = await buildStreamInfo(stream);

    res.json({
      success: true,
      data: info,
    } satisfies ApiResponse<LiveStreamInfo>);
  } catch (err) {
    console.error("[Streaming] Error fetching stream:", err);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to fetch stream." },
    } satisfies ApiResponse);
  }
});

/**
 * POST /api/streams
 * Create a new stream. Requires pro tier or above.
 */
router.post(
  "/api/streams",
  requireAuth,
  requireTier("pro"),
  async (req: Request, res: Response) => {
    try {
      const validation = createStreamSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid stream data.",
            details: validation.error.flatten(),
          },
        } satisfies ApiResponse);
        return;
      }

      const user = req.user!;
      const data = validation.data;

      // Verify club exists and user is a member
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

      const [membership] = await db
        .select()
        .from(clubMemberships)
        .where(
          and(
            eq(clubMemberships.clubId, data.clubId),
            eq(clubMemberships.userId, user.id)
          )
        )
        .limit(1);

      if (!membership) {
        res.status(403).json({
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "You must be a member of the club to create a stream.",
          },
        } satisfies ApiResponse);
        return;
      }

      const [newStream] = await db
        .insert(liveStreams)
        .values({
          title: data.title,
          clubId: data.clubId,
          gameId: data.gameId ?? null,
          streamerId: user.id,
          status: "idle",
          isPublic: data.isPublic,
          viewerCount: 0,
        })
        .returning();

      // If linked to a game, update the game's liveStreamId
      if (data.gameId) {
        await db
          .update(games)
          .set({ liveStreamId: newStream.id })
          .where(eq(games.id, data.gameId));
      }

      res.status(201).json({
        success: true,
        data: newStream,
      } satisfies ApiResponse);
    } catch (err) {
      console.error("[Streaming] Error creating stream:", err);
      res.status(500).json({
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to create stream." },
      } satisfies ApiResponse);
    }
  }
);

/**
 * POST /api/streams/:id/start
 * Mark a stream as live.
 */
router.post(
  "/api/streams/:id/start",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const streamId = parseInt(req.params.id, 10);
      if (isNaN(streamId)) {
        res.status(400).json({
          success: false,
          error: { code: "INVALID_ID", message: "Invalid stream ID." },
        } satisfies ApiResponse);
        return;
      }

      const user = req.user!;

      const [stream] = await db
        .select()
        .from(liveStreams)
        .where(eq(liveStreams.id, streamId))
        .limit(1);

      if (!stream) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Stream not found." },
        } satisfies ApiResponse);
        return;
      }

      if (stream.streamerId !== user.id) {
        res.status(403).json({
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Only the stream creator can start the stream.",
          },
        } satisfies ApiResponse);
        return;
      }

      if (stream.status === "live") {
        res.status(400).json({
          success: false,
          error: {
            code: "INVALID_STATE",
            message: "Stream is already live.",
          },
        } satisfies ApiResponse);
        return;
      }

      const [updated] = await db
        .update(liveStreams)
        .set({
          status: "live",
          startedAt: new Date(),
        })
        .where(eq(liveStreams.id, streamId))
        .returning();

      broadcastToStream(streamId, WS_EVENTS.STREAM_STARTED, {
        streamId,
        title: updated.title,
        startedAt: updated.startedAt?.toISOString() ?? null,
      });

      res.json({
        success: true,
        data: updated,
      } satisfies ApiResponse);
    } catch (err) {
      console.error("[Streaming] Error starting stream:", err);
      res.status(500).json({
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to start stream." },
      } satisfies ApiResponse);
    }
  }
);

/**
 * POST /api/streams/:id/end
 * End a live stream.
 */
router.post(
  "/api/streams/:id/end",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const streamId = parseInt(req.params.id, 10);
      if (isNaN(streamId)) {
        res.status(400).json({
          success: false,
          error: { code: "INVALID_ID", message: "Invalid stream ID." },
        } satisfies ApiResponse);
        return;
      }

      const user = req.user!;

      const [stream] = await db
        .select()
        .from(liveStreams)
        .where(eq(liveStreams.id, streamId))
        .limit(1);

      if (!stream) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Stream not found." },
        } satisfies ApiResponse);
        return;
      }

      if (stream.streamerId !== user.id) {
        res.status(403).json({
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Only the stream creator can end the stream.",
          },
        } satisfies ApiResponse);
        return;
      }

      if (stream.status === "ended") {
        res.status(400).json({
          success: false,
          error: {
            code: "INVALID_STATE",
            message: "Stream has already ended.",
          },
        } satisfies ApiResponse);
        return;
      }

      const endedAt = new Date();
      const durationSeconds = stream.startedAt
        ? Math.floor((endedAt.getTime() - stream.startedAt.getTime()) / 1000)
        : 0;

      const [updated] = await db
        .update(liveStreams)
        .set({
          status: "ended",
          endedAt,
          duration: durationSeconds,
          viewerCount: 0,
        })
        .where(eq(liveStreams.id, streamId))
        .returning();

      broadcastToStream(streamId, WS_EVENTS.STREAM_ENDED, {
        streamId,
        endedAt: endedAt.toISOString(),
        duration: durationSeconds,
      });

      res.json({
        success: true,
        data: updated,
      } satisfies ApiResponse);
    } catch (err) {
      console.error("[Streaming] Error ending stream:", err);
      res.status(500).json({
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to end stream." },
      } satisfies ApiResponse);
    }
  }
);

export default router;
