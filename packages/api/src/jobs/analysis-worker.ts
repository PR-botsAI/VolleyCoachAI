import { Queue, Worker, type Job } from "bullmq";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { db } from "../lib/db.js";
import { redis } from "../lib/redis.js";
import { videos } from "@volleycoach/shared";
import type { TierKey, AgentTask } from "@volleycoach/shared";
import { getOrchestrator } from "../agents/orchestrator.js";
import { broadcastAnalysisProgress } from "../realtime/websocket.js";

/**
 * Job data payload for video analysis tasks.
 */
interface AnalysisJobData {
  videoId: number;
  userId: string;
  gcsUrl: string;
  gcsPath: string | null;
  analysisType: string;
  focusAreas?: string[];
  tier: TierKey;
}

/**
 * BullMQ queue for video analysis jobs.
 * Shared between the API (enqueue) and the worker (process).
 */
export const analysisQueue = new Queue<AnalysisJobData>("video-analysis", {
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

/**
 * Enqueue a video for AI analysis.
 * Called after a video upload is completed.
 *
 * @param data - The analysis job payload.
 * @param options - Optional job options (e.g., priority).
 * @returns The BullMQ job ID.
 */
export async function enqueueVideoAnalysis(
  data: AnalysisJobData,
  options?: { priority?: number }
): Promise<string> {
  const job = await analysisQueue.add("analyze-video", data, {
    priority: options?.priority ?? (data.tier === "club" ? 1 : 2),
    jobId: `video-${data.videoId}`,
  });

  console.log(
    `[AnalysisWorker] Enqueued video analysis: videoId=${data.videoId}, jobId=${job.id}`
  );

  return job.id!;
}

/**
 * BullMQ worker instance. Created lazily by startAnalysisWorker().
 */
let worker: Worker<AnalysisJobData> | null = null;

/**
 * Start the BullMQ worker that processes video analysis jobs.
 *
 * Configuration:
 *   - Concurrency: 2 (process up to 2 jobs simultaneously)
 *   - Rate limit: 10 jobs per hour (to control AI API costs)
 *   - Automatic retries with exponential backoff (configured on the queue)
 */
export function startAnalysisWorker(): Worker<AnalysisJobData> {
  if (worker) {
    console.log("[AnalysisWorker] Worker already running");
    return worker;
  }

  worker = new Worker<AnalysisJobData>(
    "video-analysis",
    async (job: Job<AnalysisJobData>) => {
      const {
        videoId,
        userId,
        gcsUrl,
        gcsPath,
        analysisType,
        focusAreas,
        tier,
      } = job.data;

      console.log(
        `[AnalysisWorker] Processing job ${job.id}: videoId=${videoId}, userId=${userId}`
      );

      // Broadcast that analysis is starting
      broadcastAnalysisProgress({
        videoId,
        stage: "processing",
        progress: 5,
        message: "Analysis job started. Preparing video...",
      });

      try {
        // Build an AgentTask for the orchestrator
        const task: AgentTask = {
          id: `task_${nanoid(12)}`,
          type: "video_analysis",
          userId,
          tier,
          payload: {
            videoId,
            gcsUrl,
            gcsPath,
            config: {
              analysisType,
              focusAreas,
            },
          },
          priority: tier === "club" ? "high" : "normal",
          createdAt: new Date().toISOString(),
        };

        // Delegate to the orchestrator agent
        const result = await getOrchestrator().processTask(task);

        if (result.status === "failed") {
          const errorData = result.data as { message?: string } | undefined;
          throw new Error(
            errorData?.message || "Analysis failed in orchestrator"
          );
        }

        // Broadcast completion
        broadcastAnalysisProgress({
          videoId,
          stage: "complete",
          progress: 100,
          message: "Analysis complete! View your results.",
          details: {
            analysisId: (result.data as Record<string, unknown>)?.analysisId,
            processingTimeMs: result.processingTimeMs,
          },
        });

        console.log(
          `[AnalysisWorker] Job ${job.id} completed successfully: videoId=${videoId}`
        );

        return result;
      } catch (error) {
        console.error(
          `[AnalysisWorker] Job ${job.id} failed: videoId=${videoId}`,
          error
        );

        // Update video status to failed in the database
        await db
          .update(videos)
          .set({ status: "failed" })
          .where(eq(videos.id, videoId));

        // Broadcast error to connected clients
        broadcastAnalysisProgress({
          videoId,
          stage: "error",
          progress: 0,
          message:
            error instanceof Error
              ? error.message
              : "Analysis failed. Please try again.",
        });

        throw error;
      }
    },
    {
      connection: redis,
      concurrency: 2,
      limiter: {
        max: 10,
        duration: 3_600_000, // 1 hour in milliseconds
      },
    }
  );

  // Worker event handlers
  worker.on("completed", (job: Job<AnalysisJobData>) => {
    console.log(
      `[AnalysisWorker] Job completed: ${job.id} (videoId=${job.data.videoId})`
    );
  });

  worker.on("failed", (job: Job<AnalysisJobData> | undefined, err: Error) => {
    console.error(
      `[AnalysisWorker] Job failed: ${job?.id} (videoId=${job?.data?.videoId})`,
      err.message
    );
  });

  worker.on("error", (err: Error) => {
    console.error("[AnalysisWorker] Worker error:", err.message);
  });

  worker.on("stalled", (jobId: string) => {
    console.warn(`[AnalysisWorker] Job stalled: ${jobId}`);
  });

  console.log(
    "[AnalysisWorker] Worker started (concurrency=2, rate_limit=10/hour)"
  );

  return worker;
}
