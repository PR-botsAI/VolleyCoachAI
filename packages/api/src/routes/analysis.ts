import { Router, type Request, type Response } from "express";
import { eq, desc } from "drizzle-orm";
import { db } from "../lib/db.js";
import {
  videos,
  analysisReports,
  analysisErrors,
  analysisExercises,
  analysisPlayerStats,
  subscriptions,
  players,
  initiateUploadSchema,
  analysisConfigSchema,
} from "@volleycoach/shared";
import type {
  ApiResponse,
  FullAnalysisReport,
  AnalysisErrorItem,
  AnalysisExerciseItem,
  AnalysisPlayerStatItem,
} from "@volleycoach/shared";
import { requireAuth } from "../middleware/auth.js";
import { requireTier, checkAILimit } from "../middleware/tier-gate.js";
import { generateResumableUploadUrl, getPublicUrl } from "../lib/storage.js";
import { nanoid } from "nanoid";
import { Queue } from "bullmq";
import { redis } from "../lib/redis.js";

// Initialize the BullMQ queue for video analysis jobs
const analysisQueue = new Queue("video-analysis", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

const router = Router();

/**
 * POST /api/upload/init
 * Initiate a GCS resumable upload for video analysis.
 * Returns a resumable upload URL and creates a video record in the database.
 * Requires pro tier and checks AI analysis limits.
 */
router.post(
  "/api/upload/init",
  requireAuth,
  requireTier("pro"),
  checkAILimit,
  async (req: Request, res: Response) => {
    try {
      const validation = initiateUploadSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid upload data.",
            details: validation.error.flatten(),
          },
        } satisfies ApiResponse);
        return;
      }

      const user = req.user!;
      const { filename, mimeType, fileSize, teamId, clubId } = validation.data;

      // Generate a unique file path for GCS
      const fileId = nanoid(16);
      const extension = filename.split(".").pop() || "mp4";
      const gcsPath = `videos/${user.id}/${fileId}.${extension}`;

      // Create the video record in the database
      const [video] = await db
        .insert(videos)
        .values({
          userId: user.id,
          filename: `${fileId}.${extension}`,
          originalName: filename,
          fileSize,
          mimeType,
          gcsPath,
          status: "uploading",
          teamId: teamId ?? null,
          clubId: clubId ?? null,
          isFromStream: false,
          analysisComplete: false,
        })
        .returning();

      // Generate the resumable upload URL
      const uploadUrl = await generateResumableUploadUrl(
        gcsPath,
        mimeType,
        fileSize
      );

      res.status(201).json({
        success: true,
        data: {
          videoId: video.id,
          uploadUrl,
          gcsPath,
          expiresIn: 3600, // Upload URL valid for 1 hour
        },
      } satisfies ApiResponse);
    } catch (err) {
      console.error("[Analysis] Error initiating upload:", err);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to initiate upload.",
        },
      } satisfies ApiResponse);
    }
  }
);

/**
 * POST /api/upload/complete
 * Called when the client finishes uploading a video to GCS.
 * Updates the video status and enqueues an analysis job.
 */
router.post(
  "/api/upload/complete",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { videoId } = req.body;
      if (!videoId || typeof videoId !== "number") {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "videoId (number) is required.",
          },
        } satisfies ApiResponse);
        return;
      }

      const configValidation = analysisConfigSchema.safeParse(
        req.body.config || {}
      );
      const analysisConfig = configValidation.success
        ? configValidation.data
        : { analysisType: "full", focusAreas: undefined };

      const user = req.user!;

      // Fetch and verify video ownership
      const [video] = await db
        .select()
        .from(videos)
        .where(eq(videos.id, videoId))
        .limit(1);

      if (!video) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Video not found." },
        } satisfies ApiResponse);
        return;
      }

      if (video.userId !== user.id) {
        res.status(403).json({
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "You can only complete uploads for your own videos.",
          },
        } satisfies ApiResponse);
        return;
      }

      // Update video status
      const gcsUrl = getPublicUrl(video.gcsPath!);
      await db
        .update(videos)
        .set({
          status: "uploaded",
          gcsUrl,
        })
        .where(eq(videos.id, videoId));

      // Increment the AI analysis usage counter
      await db
        .update(subscriptions)
        .set({
          aiAnalysesUsed: eq(subscriptions.userId, user.id)
            ? subscriptions.aiAnalysesUsed
            : 0,
        })
        .where(eq(subscriptions.userId, user.id));

      // Use raw SQL for the increment since Drizzle doesn't have a clean .increment()
      await db.execute(
        `UPDATE subscriptions SET ai_analyses_used = ai_analyses_used + 1 WHERE user_id = '${user.id}'`
      );

      // Enqueue analysis job
      const job = await analysisQueue.add(
        "analyze-video",
        {
          videoId,
          userId: user.id,
          gcsUrl,
          gcsPath: video.gcsPath,
          analysisType: analysisConfig.analysisType,
          focusAreas: analysisConfig.focusAreas,
          tier: user.tier,
        },
        {
          priority: user.tier === "club" ? 1 : 2,
          jobId: `video-${videoId}`,
        }
      );

      res.json({
        success: true,
        data: {
          videoId,
          jobId: job.id,
          status: "uploaded",
          message:
            "Video upload complete. Analysis has been queued and will begin shortly.",
        },
      } satisfies ApiResponse);
    } catch (err) {
      console.error("[Analysis] Error completing upload:", err);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to complete upload.",
        },
      } satisfies ApiResponse);
    }
  }
);

/**
 * GET /api/analysis/:id
 * Get the full analysis report for a video.
 */
router.get(
  "/api/analysis/:id",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const reportId = parseInt(req.params.id, 10);
      if (isNaN(reportId)) {
        res.status(400).json({
          success: false,
          error: { code: "INVALID_ID", message: "Invalid analysis ID." },
        } satisfies ApiResponse);
        return;
      }

      const [report] = await db
        .select()
        .from(analysisReports)
        .where(eq(analysisReports.id, reportId))
        .limit(1);

      if (!report) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Analysis report not found." },
        } satisfies ApiResponse);
        return;
      }

      // Verify ownership
      const user = req.user!;
      if (report.userId !== user.id) {
        res.status(403).json({
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "You can only view your own analysis reports.",
          },
        } satisfies ApiResponse);
        return;
      }

      // Fetch errors
      const errorResults = await db
        .select()
        .from(analysisErrors)
        .where(eq(analysisErrors.analysisId, reportId));

      const errors: AnalysisErrorItem[] = errorResults.map((e) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        severity: e.severity,
        category: e.category,
        timeRange: e.timeRange,
        frequency: e.frequency,
        playerDescription: e.playerDescription,
        videoTimestamp: e.videoTimestamp,
      }));

      // Fetch exercises
      const exerciseResults = await db
        .select()
        .from(analysisExercises)
        .where(eq(analysisExercises.analysisId, reportId));

      const exercises: AnalysisExerciseItem[] = exerciseResults.map((e) => ({
        id: e.id,
        name: e.name,
        description: e.description,
        duration: e.duration,
        sets: e.sets,
        targetArea: e.targetArea,
        difficulty: e.difficulty,
        videoUrl: e.videoUrl,
      }));

      // Fetch player stats
      const statsResults = await db
        .select()
        .from(analysisPlayerStats)
        .where(eq(analysisPlayerStats.analysisId, reportId));

      const playerStats: AnalysisPlayerStatItem[] = await Promise.all(
        statsResults.map(async (s) => {
          const [player] = await db
            .select()
            .from(players)
            .where(eq(players.id, s.playerId))
            .limit(1);

          return {
            id: s.id,
            playerId: s.playerId,
            playerName: player
              ? `${player.firstName} ${player.lastName}`
              : "Unknown Player",
            reception: s.reception,
            attack: s.attack,
            blocking: s.blocking,
            serving: s.serving,
            setting: s.setting,
            defense: s.defense,
            overallRating: s.overallRating ? parseFloat(s.overallRating) : null,
          };
        })
      );

      const fullReport: FullAnalysisReport = {
        id: report.id,
        videoId: report.videoId,
        overallScore: report.overallScore
          ? parseFloat(report.overallScore)
          : null,
        summary: report.summary,
        analysisType: report.analysisType,
        focusAreas: report.focusAreas ?? [],
        playCount: report.playCount,
        errorCount: report.errorCount,
        processingTime: report.processingTime,
        createdAt: report.createdAt.toISOString(),
        errors,
        exercises,
        playerStats,
      };

      res.json({
        success: true,
        data: fullReport,
      } satisfies ApiResponse<FullAnalysisReport>);
    } catch (err) {
      console.error("[Analysis] Error fetching report:", err);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch analysis report.",
        },
      } satisfies ApiResponse);
    }
  }
);

/**
 * GET /api/analysis
 * List the current user's analysis reports.
 */
router.get(
  "/api/analysis",
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

      const reports = await db
        .select({
          id: analysisReports.id,
          videoId: analysisReports.videoId,
          overallScore: analysisReports.overallScore,
          summary: analysisReports.summary,
          analysisType: analysisReports.analysisType,
          playCount: analysisReports.playCount,
          errorCount: analysisReports.errorCount,
          processingTime: analysisReports.processingTime,
          createdAt: analysisReports.createdAt,
          videoFilename: videos.originalName,
          videoStatus: videos.status,
          videoThumbnail: videos.thumbnailUrl,
        })
        .from(analysisReports)
        .innerJoin(videos, eq(analysisReports.videoId, videos.id))
        .where(eq(analysisReports.userId, user.id))
        .orderBy(desc(analysisReports.createdAt))
        .limit(limitNum)
        .offset(offset);

      const result = reports.map((r) => ({
        id: r.id,
        videoId: r.videoId,
        overallScore: r.overallScore ? parseFloat(r.overallScore) : null,
        summary: r.summary,
        analysisType: r.analysisType,
        playCount: r.playCount,
        errorCount: r.errorCount,
        processingTime: r.processingTime,
        createdAt: r.createdAt.toISOString(),
        videoFilename: r.videoFilename,
        videoStatus: r.videoStatus,
        videoThumbnail: r.videoThumbnail,
      }));

      res.json({
        success: true,
        data: result,
        meta: {
          page: pageNum,
          limit: limitNum,
          hasMore: reports.length === limitNum,
        },
      } satisfies ApiResponse);
    } catch (err) {
      console.error("[Analysis] Error listing reports:", err);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to list analysis reports.",
        },
      } satisfies ApiResponse);
    }
  }
);

export default router;
