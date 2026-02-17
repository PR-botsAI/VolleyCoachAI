import { nanoid } from "nanoid";
import type {
  AgentTask,
  AgentResult,
  OrchestratorMessage,
} from "@volleycoach/shared";
import { TIERS, type TierKey } from "@volleycoach/shared/constants";
import { BaseAgent, type AgentCapability } from "./base-agent";
import { VideoAnalysisAgent } from "./video-agent";
import { CoachingAgent } from "./coaching-agent";
import { broadcastAnalysisProgress, sendNotification } from "../realtime/websocket";
import { db } from "../lib/db";
import { eq, sql } from "drizzle-orm";
import { videos, subscriptions } from "@volleycoach/shared/schema";

/**
 * Master Orchestrator Agent
 *
 * Central coordinator for all AI tasks. Receives high-level requests,
 * decomposes them into subtasks, routes to specialist agents,
 * aggregates results, and returns unified responses.
 */
export class Orchestrator extends BaseAgent {
  private videoAgent: VideoAnalysisAgent;
  private coachingAgent: CoachingAgent;
  private taskLog: Map<string, OrchestratorMessage[]> = new Map();

  constructor() {
    super("Orchestrator", "Master AI agent coordinator for VolleyCoach platform");
    this.videoAgent = new VideoAnalysisAgent();
    this.coachingAgent = new CoachingAgent();
    this.log("Orchestrator initialized with agents:", {
      videoAgent: this.videoAgent.name,
      coachingAgent: this.coachingAgent.name,
    });
  }

  getCapabilities(): AgentCapability[] {
    return [
      {
        name: "video_analysis",
        description: "Full volleyball video analysis with error detection, player tracking, and scoring",
        inputSchema: { videoId: "number", gcsUrl: "string", config: "object" },
      },
      {
        name: "coaching_plan",
        description: "Generate personalized coaching plans from analysis results",
        inputSchema: { analysisId: "number", teamId: "number" },
      },
      {
        name: "player_assessment",
        description: "Comprehensive player skill assessment across multiple analyses",
        inputSchema: { playerId: "number", timeRange: "string" },
      },
    ];
  }

  /**
   * Main entry point for all orchestrated tasks.
   */
  async processTask(task: AgentTask): Promise<AgentResult> {
    const startTime = Date.now();
    this.log(`Processing task: ${task.type}`, { taskId: task.id, priority: task.priority });

    // Verify tier access
    const tierConfig = TIERS[task.tier];
    if (!tierConfig.canUseAICoach && task.type === "video_analysis") {
      return this.createResult(task.id, "failed", {
        error: "upgrade_required",
        message: "AI Coach requires Pro or Club subscription",
        requiredTier: "pro",
      }, 1.0, startTime);
    }

    try {
      switch (task.type) {
        case "video_analysis":
          return await this.handleVideoAnalysis(task, startTime);
        case "coaching_plan":
          return await this.handleCoachingPlan(task, startTime);
        case "player_assessment":
          return await this.handlePlayerAssessment(task, startTime);
        default:
          return this.createResult(task.id, "failed", {
            error: "unknown_task_type",
            message: `Unknown task type: ${task.type}`,
          }, 0, startTime);
      }
    } catch (error) {
      this.logError(`Task ${task.id} failed`, error);
      return this.createResult(task.id, "failed", {
        error: "processing_error",
        message: error instanceof Error ? error.message : "Unknown error",
      }, 0, startTime);
    }
  }

  /**
   * Full video analysis pipeline:
   * 1. Update video status to "analyzing"
   * 2. Send to Video Analysis Agent
   * 3. Pass results to Coaching Agent for drill generation
   * 4. Store everything in database
   * 5. Notify user
   */
  private async handleVideoAnalysis(
    task: AgentTask,
    startTime: number
  ): Promise<AgentResult> {
    const { videoId, gcsUrl, config } = task.payload as {
      videoId: number;
      gcsUrl: string;
      config?: { analysisType?: string; focusAreas?: string[] };
    };

    // Step 1: Update video status
    await db
      .update(videos)
      .set({ status: "analyzing" })
      .where(eq(videos.id, videoId));

    broadcastAnalysisProgress(videoId, {
      videoId,
      stage: "analyzing",
      progress: 10,
      message: "Starting AI analysis...",
    });

    // Step 2: Run video analysis
    this.log("Routing to Video Analysis Agent");
    const videoResult = await this.videoAgent.processTask({
      ...task,
      type: "video_analysis",
      payload: { videoId, gcsUrl, userId: task.userId, config },
    });

    if (videoResult.status === "failed") {
      await db
        .update(videos)
        .set({ status: "failed" })
        .where(eq(videos.id, videoId));

      broadcastAnalysisProgress(videoId, {
        videoId,
        stage: "error",
        progress: 0,
        message: "Analysis failed. Please try again.",
      });

      return videoResult;
    }

    broadcastAnalysisProgress(videoId, {
      videoId,
      stage: "analyzing",
      progress: 70,
      message: "Generating coaching recommendations...",
    });

    // Step 3: Generate coaching recommendations
    const analysisData = videoResult.data as { analysisId: number };
    const coachingResult = await this.coachingAgent.processTask({
      ...task,
      type: "coaching_plan",
      payload: { analysisId: analysisData.analysisId, videoId },
    });

    // Step 4: Mark video as complete
    await db
      .update(videos)
      .set({ status: "complete", analysisComplete: true })
      .where(eq(videos.id, videoId));

    // Step 5: Increment AI usage counter
    await db
      .update(subscriptions)
      .set({
        aiAnalysesUsed: sql`ai_analyses_used + 1`,
      })
      .where(eq(subscriptions.userId, task.userId));

    broadcastAnalysisProgress(videoId, {
      videoId,
      stage: "complete",
      progress: 100,
      message: "Analysis complete! View your results.",
    });

    // Step 6: Send push notification
    sendNotification(task.userId, {
      type: "analysis_ready",
      title: "Analysis Ready",
      body: "Your volleyball video analysis is complete. Tap to view results.",
      data: { videoId, analysisId: analysisData.analysisId },
    });

    return this.createResult(
      task.id,
      "success",
      {
        analysisId: analysisData.analysisId,
        coachingPlan: coachingResult.data,
        videoId,
      },
      videoResult.confidence,
      startTime
    );
  }

  /**
   * Standalone coaching plan generation from an existing analysis.
   */
  private async handleCoachingPlan(
    task: AgentTask,
    startTime: number
  ): Promise<AgentResult> {
    const result = await this.coachingAgent.processTask(task);
    return this.createResult(
      task.id,
      result.status,
      result.data,
      result.confidence,
      startTime
    );
  }

  /**
   * Player assessment across multiple analyses.
   */
  private async handlePlayerAssessment(
    task: AgentTask,
    startTime: number
  ): Promise<AgentResult> {
    const { playerId } = task.payload as { playerId: number };

    // Get all analysis stats for this player
    const stats = await db.query.analysisPlayerStats.findMany({
      where: eq(
        (await import("@volleycoach/shared/schema")).analysisPlayerStats.playerId,
        playerId
      ),
      with: { analysis: true },
      orderBy: (s, { desc }) => [desc(s.id)],
      limit: 10,
    });

    if (stats.length === 0) {
      return this.createResult(task.id, "partial", {
        message: "No analysis data found for this player",
        playerId,
      }, 0.5, startTime);
    }

    // Calculate trend data
    const ratings = stats
      .map((s) => parseFloat(s.overallRating ?? "0"))
      .filter((r) => r > 0);

    const avgRating =
      ratings.length > 0
        ? ratings.reduce((a, b) => a + b, 0) / ratings.length
        : 0;

    const trend =
      ratings.length >= 2
        ? ratings[0] > ratings[ratings.length - 1]
          ? "improving"
          : "declining"
        : "insufficient_data";

    return this.createResult(
      task.id,
      "success",
      {
        playerId,
        averageRating: Math.round(avgRating * 10) / 10,
        trend,
        analysisCount: stats.length,
        latestStats: stats[0],
        historicalRatings: ratings,
      },
      0.85,
      startTime
    );
  }
}

// Singleton orchestrator instance
let orchestratorInstance: Orchestrator | null = null;

export function getOrchestrator(): Orchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new Orchestrator();
  }
  return orchestratorInstance;
}
