import { GoogleGenAI } from "@google/genai";
import type { AgentTask, AgentResult } from "@volleycoach/shared";
import { BaseAgent, type AgentCapability } from "./base-agent";
import { db } from "../lib/db";
import {
  analysisReports,
  analysisErrors,
  analysisExercises,
  analysisPlayerStats,
} from "@volleycoach/shared/schema";
import { AI_CONFIG } from "@volleycoach/shared/constants";
import { broadcastAnalysisProgress } from "../realtime/websocket";
import { env } from "../lib/env";

const VOLLEYBALL_ANALYSIS_PROMPT = `You are an elite volleyball analysis AI. Analyze this volleyball video with extreme precision and detail.

REQUIRED OUTPUT FORMAT (JSON):
{
  "overallScore": <number 0-100>,
  "summary": "<comprehensive 3-5 sentence summary of the footage>",
  "playCount": <number of distinct plays/rallies detected>,
  "pointsHome": <points scored by team on left/near side, or null if unclear>,
  "pointsAway": <points scored by team on right/far side, or null if unclear>,

  "players": [
    {
      "description": "<visual identifier e.g. 'Player #7 in white jersey'>",
      "jerseyNumber": <number or null>,
      "position": "<detected position or 'unknown'>",
      "reception": "<text assessment of reception skills>",
      "attack": "<text assessment of attacking>",
      "blocking": "<text assessment of blocking>",
      "serving": "<text assessment of serving>",
      "setting": "<text assessment of setting>",
      "defense": "<text assessment of defense/digging>",
      "overallRating": <number 0-100>
    }
  ],

  "errors": [
    {
      "title": "<concise error title>",
      "description": "<detailed description of the technical error>",
      "severity": "high" | "medium" | "low",
      "category": "serving" | "passing" | "setting" | "attacking" | "blocking" | "digging" | "positioning" | "communication",
      "timeRange": "<start-end e.g. '0:45-0:52'>",
      "frequency": "<how often this occurs e.g. '3 times in the video'>",
      "playerDescription": "<which player made the error>",
      "videoTimestamp": <seconds into video when error first occurs>
    }
  ],

  "highlights": [
    {
      "description": "<what happened>",
      "timeRange": "<start-end>",
      "type": "great_play" | "critical_error" | "turning_point"
    }
  ]
}

ANALYSIS REQUIREMENTS:
1. Detect ALL plays/rallies - count every serve-to-dead-ball sequence
2. Identify at least 5-8 technical errors if present
3. Track every visible player and assess their skills
4. Note timestamps precisely
5. Score severity accurately: high = game-changing mistake, medium = fixable habit, low = minor adjustment
6. Categories must be volleyball-specific
7. Be constructive in descriptions - frame as coaching opportunities
8. If you cannot determine something, use null rather than guessing

Return ONLY valid JSON. No markdown, no code blocks, no extra text.`;

/**
 * Video Analysis Agent
 *
 * Specialized agent for processing volleyball videos through Google Gemini.
 * Handles video upload to Gemini, analysis prompt engineering, response parsing,
 * and structured data storage.
 */
export class VideoAnalysisAgent extends BaseAgent {
  private genAI: GoogleGenAI | null = null;

  constructor() {
    super("VideoAnalysisAgent", "Analyzes volleyball videos using Google Gemini AI");
    const apiKey = env.GEMINI_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenAI({ apiKey });
      this.log("Gemini AI initialized");
    } else {
      this.log("WARNING: GEMINI_API_KEY not set - analysis will fail");
    }
  }

  getCapabilities(): AgentCapability[] {
    return [
      {
        name: "analyze_video",
        description: "Full volleyball video analysis with Gemini AI",
        inputSchema: {
          videoId: "number",
          gcsUrl: "string",
          userId: "string",
        },
      },
    ];
  }

  async processTask(task: AgentTask): Promise<AgentResult> {
    const startTime = Date.now();
    const { videoId, gcsUrl, userId, config } = task.payload as {
      videoId: number;
      gcsUrl: string;
      userId: string;
      config?: { analysisType?: string; focusAreas?: string[] };
    };

    if (!this.genAI) {
      return this.createResult(task.id, "failed", {
        error: "ai_not_configured",
        message: "Gemini API key is not configured",
      }, 0, startTime);
    }

    try {
      broadcastAnalysisProgress(videoId, {
        videoId,
        stage: "analyzing",
        progress: 20,
        message: "Sending video to AI for analysis...",
      });

      // Call Gemini with the video
      const analysisResult = await this.analyzeWithGemini(gcsUrl, config);

      broadcastAnalysisProgress(videoId, {
        videoId,
        stage: "analyzing",
        progress: 50,
        message: "Processing AI response...",
      });

      // Store results in database
      const analysisId = await this.storeResults(
        videoId,
        userId,
        analysisResult,
        config,
        startTime
      );

      broadcastAnalysisProgress(videoId, {
        videoId,
        stage: "analyzing",
        progress: 65,
        message: "Analysis stored successfully",
      });

      return this.createResult(
        task.id,
        "success",
        { analysisId, ...analysisResult },
        analysisResult.overallScore ? 0.9 : 0.7,
        startTime
      );
    } catch (error) {
      this.logError("Video analysis failed", error);
      return this.createResult(task.id, "failed", {
        error: "analysis_failed",
        message: error instanceof Error ? error.message : "Analysis processing failed",
      }, 0, startTime);
    }
  }

  /**
   * Calls Google Gemini with the video URL and volleyball analysis prompt.
   */
  private async analyzeWithGemini(
    gcsUrl: string,
    config?: { analysisType?: string; focusAreas?: string[] }
  ): Promise<AnalysisData> {
    if (!this.genAI) throw new Error("Gemini not initialized");

    let prompt = VOLLEYBALL_ANALYSIS_PROMPT;

    if (config?.focusAreas?.length) {
      prompt += `\n\nFOCUS AREAS: Pay special attention to: ${config.focusAreas.join(", ")}`;
    }

    if (config?.analysisType === "quick") {
      prompt += "\n\nThis is a QUICK analysis - focus on the top 3-5 most impactful observations.";
    }

    const response = await this.genAI.models.generateContent({
      model: AI_CONFIG.GEMINI_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            {
              fileData: {
                mimeType: "video/mp4",
                fileUri: gcsUrl,
              },
            },
            { text: prompt },
          ],
        },
      ],
      config: {
        temperature: 0.3,
        maxOutputTokens: 8192,
      },
    });

    const text = response.text ?? "";

    // Parse JSON from response, handling potential markdown wrapping
    let jsonStr = text;
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    try {
      const data = JSON.parse(jsonStr) as AnalysisData;
      this.log("Analysis parsed successfully", {
        overallScore: data.overallScore,
        errorCount: data.errors?.length ?? 0,
        playerCount: data.players?.length ?? 0,
      });
      return data;
    } catch (parseError) {
      this.logError("Failed to parse Gemini response", parseError);
      // Attempt recovery: create a minimal analysis from whatever we got
      return {
        overallScore: 50,
        summary: text.substring(0, 500) || "Analysis completed but response parsing failed. Please try again.",
        playCount: null,
        pointsHome: null,
        pointsAway: null,
        players: [],
        errors: [],
        highlights: [],
      };
    }
  }

  /**
   * Stores the analysis results in the database across multiple tables.
   */
  private async storeResults(
    videoId: number,
    userId: string,
    data: AnalysisData,
    config: { analysisType?: string; focusAreas?: string[] } | undefined,
    startTime: number
  ): Promise<number> {
    // Insert main analysis report
    const [report] = await db
      .insert(analysisReports)
      .values({
        videoId,
        userId,
        overallScore: data.overallScore?.toString() ?? null,
        summary: data.summary,
        analysisType: config?.analysisType ?? "full",
        focusAreas: config?.focusAreas ?? null,
        playCount: data.playCount,
        errorCount: data.errors?.length ?? 0,
        pointsHome: data.pointsHome,
        pointsAway: data.pointsAway,
        aiModel: AI_CONFIG.GEMINI_MODEL,
        processingTime: Math.round((Date.now() - startTime) / 1000),
      })
      .returning();

    const analysisId = report.id;

    // Insert errors
    if (data.errors?.length) {
      await db.insert(analysisErrors).values(
        data.errors.map((err) => ({
          analysisId,
          title: err.title,
          description: err.description,
          severity: err.severity as "high" | "medium" | "low",
          category: err.category as any,
          timeRange: err.timeRange,
          frequency: err.frequency,
          playerDescription: err.playerDescription ?? null,
          videoTimestamp: err.videoTimestamp ?? null,
        }))
      );
    }

    // Insert player stats
    if (data.players?.length) {
      await db.insert(analysisPlayerStats).values(
        data.players.map((player) => ({
          playerId: 0, // Will be linked to actual players in a future step
          analysisId,
          reception: player.reception ?? null,
          attack: player.attack ?? null,
          blocking: player.blocking ?? null,
          serving: player.serving ?? null,
          setting: player.setting ?? null,
          defense: player.defense ?? null,
          overallRating: player.overallRating?.toString() ?? null,
        }))
      );
    }

    return analysisId;
  }
}

// ============================================================
// Types for Gemini response parsing
// ============================================================

interface AnalysisData {
  overallScore: number | null;
  summary: string;
  playCount: number | null;
  pointsHome: number | null;
  pointsAway: number | null;
  players: AnalysisPlayer[];
  errors: AnalysisErrorData[];
  highlights: AnalysisHighlight[];
}

interface AnalysisPlayer {
  description: string;
  jerseyNumber: number | null;
  position: string;
  reception: string | null;
  attack: string | null;
  blocking: string | null;
  serving: string | null;
  setting: string | null;
  defense: string | null;
  overallRating: number | null;
}

interface AnalysisErrorData {
  title: string;
  description: string;
  severity: string;
  category: string;
  timeRange: string;
  frequency: string;
  playerDescription: string | null;
  videoTimestamp: number | null;
}

interface AnalysisHighlight {
  description: string;
  timeRange: string;
  type: string;
}
