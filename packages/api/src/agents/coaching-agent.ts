import { GoogleGenAI } from "@google/genai";
import type { AgentTask, AgentResult } from "@volleycoach/shared";
import { BaseAgent, type AgentCapability } from "./base-agent";
import { db } from "../lib/db";
import { eq } from "drizzle-orm";
import {
  analysisReports,
  analysisErrors,
  analysisExercises,
} from "@volleycoach/shared/schema";
import { AI_CONFIG } from "@volleycoach/shared/constants";
import { env } from "../lib/env";

const COACHING_PROMPT = `You are an elite volleyball coach and training expert. Based on the following analysis of a volleyball video, generate personalized training exercises and drills.

ANALYSIS DATA:
{ANALYSIS_DATA}

DETECTED ERRORS:
{ERRORS_DATA}

Generate a comprehensive training response in this JSON format:
{
  "exercises": [
    {
      "name": "<drill/exercise name>",
      "description": "<detailed step-by-step instructions for performing this drill>",
      "duration": "<recommended time e.g. '10-15 minutes'>",
      "sets": "<recommended sets/reps e.g. '3 sets of 10 reps'>",
      "targetArea": "<skill area: serving|passing|setting|attacking|blocking|digging|positioning|general>",
      "difficulty": "beginner" | "intermediate" | "advanced",
      "relatedError": "<which error this exercise addresses>"
    }
  ],
  "weeklyPlan": {
    "monday": ["<exercise name>", "<exercise name>"],
    "tuesday": ["<exercise name>"],
    "wednesday": ["<exercise name>", "<exercise name>"],
    "thursday": ["<rest or light conditioning>"],
    "friday": ["<exercise name>", "<exercise name>"]
  },
  "coachingTips": [
    "<natural language coaching advice>",
    "<tip about team dynamics or communication>",
    "<mental/strategic tip>"
  ],
  "priorityFocus": "<the single most impactful area to improve>"
}

RULES:
1. Generate 5-10 exercises targeting identified weaknesses
2. Each exercise must be practical and executable in a gym/court setting
3. Include warm-up and cool-down recommendations
4. Vary difficulty levels
5. Make descriptions specific enough that a coach can run the drill
6. Weekly plan should be realistic (not overloaded)
7. Coaching tips should be actionable and encouraging
8. Return ONLY valid JSON`;

/**
 * Coaching Agent
 *
 * Generates personalized training plans, drills, and coaching recommendations
 * based on video analysis results.
 */
export class CoachingAgent extends BaseAgent {
  private genAI: GoogleGenAI | null = null;

  constructor() {
    super("CoachingAgent", "Generates volleyball training plans and coaching recommendations");
    const apiKey = env.GEMINI_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenAI({ apiKey });
      this.log("Gemini AI initialized for coaching");
    } else {
      this.log("WARNING: GEMINI_API_KEY not set - using fallback exercise library");
    }
  }

  getCapabilities(): AgentCapability[] {
    return [
      {
        name: "generate_training_plan",
        description: "Create personalized training plan from analysis results",
        inputSchema: { analysisId: "number" },
      },
      {
        name: "generate_exercises",
        description: "Generate targeted exercises for specific errors",
        inputSchema: { errors: "array", targetArea: "string" },
      },
    ];
  }

  async processTask(task: AgentTask): Promise<AgentResult> {
    const startTime = Date.now();
    const { analysisId, videoId } = task.payload as {
      analysisId: number;
      videoId?: number;
    };

    try {
      // Fetch analysis data
      const report = await db.query.analysisReports.findFirst({
        where: eq(analysisReports.id, analysisId),
        with: { errors: true },
      });

      if (!report) {
        return this.createResult(task.id, "failed", {
          error: "analysis_not_found",
          message: `Analysis ${analysisId} not found`,
        }, 0, startTime);
      }

      let exercises: ExerciseData[];
      let weeklyPlan: Record<string, string[]> = {};
      let coachingTips: string[] = [];
      let priorityFocus = "general";

      if (this.genAI) {
        // Use AI-powered exercise generation
        const result = await this.generateWithAI(report, report.errors);
        exercises = result.exercises;
        weeklyPlan = result.weeklyPlan;
        coachingTips = result.coachingTips;
        priorityFocus = result.priorityFocus;
      } else {
        // Fallback: use exercise library
        exercises = this.generateFromLibrary(report.errors);
        coachingTips = [
          "Focus on consistent form during practice drills",
          "Communicate with teammates before, during, and after plays",
          "Review game footage weekly to track improvement",
        ];
        priorityFocus = this.detectPriorityArea(report.errors);
      }

      // Store exercises in database
      if (exercises.length > 0) {
        await db.insert(analysisExercises).values(
          exercises.map((ex) => ({
            analysisId,
            name: ex.name,
            description: ex.description,
            duration: ex.duration,
            sets: ex.sets,
            targetArea: ex.targetArea,
            difficulty: ex.difficulty as "beginner" | "intermediate" | "advanced",
          }))
        );
      }

      return this.createResult(
        task.id,
        "success",
        {
          exerciseCount: exercises.length,
          exercises,
          weeklyPlan,
          coachingTips,
          priorityFocus,
        },
        this.genAI ? 0.88 : 0.7,
        startTime
      );
    } catch (error) {
      this.logError("Coaching plan generation failed", error);
      return this.createResult(task.id, "failed", {
        error: "coaching_failed",
        message: error instanceof Error ? error.message : "Failed to generate coaching plan",
      }, 0, startTime);
    }
  }

  /**
   * AI-powered exercise generation using Gemini.
   */
  private async generateWithAI(
    report: any,
    errors: any[]
  ): Promise<CoachingResult> {
    if (!this.genAI) throw new Error("Gemini not initialized");

    const prompt = COACHING_PROMPT
      .replace("{ANALYSIS_DATA}", JSON.stringify({
        overallScore: report.overallScore,
        summary: report.summary,
        analysisType: report.analysisType,
        focusAreas: report.focusAreas,
        playCount: report.playCount,
        errorCount: report.errorCount,
      }))
      .replace("{ERRORS_DATA}", JSON.stringify(
        errors.map((e) => ({
          title: e.title,
          description: e.description,
          severity: e.severity,
          category: e.category,
          frequency: e.frequency,
        }))
      ));

    const response = await this.genAI.models.generateContent({
      model: AI_CONFIG.GEMINI_MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { temperature: 0.5, maxOutputTokens: 4096 },
    });

    const text = response.text ?? "";
    let jsonStr = text;
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1].trim();

    try {
      return JSON.parse(jsonStr) as CoachingResult;
    } catch {
      this.log("Failed to parse AI coaching response, using fallback");
      return {
        exercises: this.generateFromLibrary(errors),
        weeklyPlan: {},
        coachingTips: ["Focus on the fundamentals identified in your analysis"],
        priorityFocus: this.detectPriorityArea(errors),
      };
    }
  }

  /**
   * Fallback exercise library when AI is not available.
   */
  private generateFromLibrary(errors: any[]): ExerciseData[] {
    const exercises: ExerciseData[] = [];
    const categories = new Set(errors.map((e) => e.category).filter(Boolean));

    const library: Record<string, ExerciseData[]> = {
      serving: [
        {
          name: "Target Serving Drill",
          description: "Place targets (towels or cones) in different zones of the court. Serve 10 balls to each zone, focusing on consistent toss height and contact point. Track accuracy percentage.",
          duration: "15 minutes",
          sets: "3 rounds of 10 serves per zone",
          targetArea: "serving",
          difficulty: "intermediate",
        },
        {
          name: "Float Serve Progression",
          description: "Start at the 3-meter line and serve over the net. Move back one step every 5 successful serves until reaching the baseline. Focus on clean hand contact without spin.",
          duration: "10 minutes",
          sets: "Until reaching baseline or 20 minutes",
          targetArea: "serving",
          difficulty: "beginner",
        },
      ],
      passing: [
        {
          name: "Platform Control Drill",
          description: "Partner tosses balls at varying heights and angles. Passer must return every ball to a target (setter position). Focus on keeping platform angle consistent and moving feet to the ball.",
          duration: "12 minutes",
          sets: "4 sets of 15 passes",
          targetArea: "passing",
          difficulty: "intermediate",
        },
      ],
      setting: [
        {
          name: "Wall Setting Repetitions",
          description: "Stand 2 feet from wall. Set ball against wall continuously, focusing on hand position, follow-through, and consistent height. Aim for 50 consecutive contacts.",
          duration: "10 minutes",
          sets: "3 sets of 50 contacts",
          targetArea: "setting",
          difficulty: "beginner",
        },
      ],
      attacking: [
        {
          name: "Approach Footwork Drill",
          description: "Without a ball, practice the 3-step or 4-step approach pattern. Focus on explosive penultimate step and arm swing timing. Add a ball once footwork is consistent.",
          duration: "10 minutes",
          sets: "20 approaches, then 15 with a ball",
          targetArea: "attacking",
          difficulty: "intermediate",
        },
      ],
      blocking: [
        {
          name: "Lateral Shuffle and Block",
          description: "Start at position 3. Shuffle to position 2, jump and block. Return to 3, shuffle to 4, jump and block. Focus on sealing the net with hands pressing over.",
          duration: "8 minutes",
          sets: "4 sets of 10 blocks (5 each side)",
          targetArea: "blocking",
          difficulty: "intermediate",
        },
      ],
      digging: [
        {
          name: "Reaction Ball Digging",
          description: "Coach hits balls at the digger from the opposite side of the net at increasing speeds. Focus on low ready position, reading the hitter's arm, and platform angle.",
          duration: "10 minutes",
          sets: "3 sets of 12 digs",
          targetArea: "digging",
          difficulty: "advanced",
        },
      ],
      positioning: [
        {
          name: "Rotation Shadow Drill",
          description: "Walk through all 6 rotations with the full team, practicing base positions for each rotation. Coach calls out scenarios (serve, pass, attack) and players move to correct positions.",
          duration: "15 minutes",
          sets: "2 full rotation cycles",
          targetArea: "positioning",
          difficulty: "beginner",
        },
      ],
      communication: [
        {
          name: "Call-Out Scrimmage",
          description: "Play a scrimmage where every ball MUST be called by the receiving player before contact. No call = point for the other team. Builds verbal habits under pressure.",
          duration: "20 minutes",
          sets: "Play to 15 points",
          targetArea: "communication",
          difficulty: "intermediate",
        },
      ],
    };

    // Add exercises for each error category found
    for (const category of categories) {
      const catExercises = library[category as string];
      if (catExercises) {
        exercises.push(...catExercises);
      }
    }

    // Always include a general warm-up
    exercises.unshift({
      name: "Dynamic Volleyball Warm-Up",
      description: "Jog 2 laps, high knees, butt kicks, lateral shuffles, arm circles. Then 20 partner pepper contacts (pass-set-hit pattern) to get touches on the ball.",
      duration: "8 minutes",
      sets: "1 round through all movements",
      targetArea: "general",
      difficulty: "beginner",
    });

    return exercises;
  }

  private detectPriorityArea(errors: any[]): string {
    const counts: Record<string, number> = {};
    for (const err of errors) {
      const cat = err.category ?? "general";
      const weight = err.severity === "high" ? 3 : err.severity === "medium" ? 2 : 1;
      counts[cat] = (counts[cat] ?? 0) + weight;
    }

    let maxArea = "general";
    let maxCount = 0;
    for (const [area, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        maxArea = area;
      }
    }

    return maxArea;
  }
}

interface ExerciseData {
  name: string;
  description: string;
  duration: string;
  sets: string;
  targetArea: string;
  difficulty: string;
}

interface CoachingResult {
  exercises: ExerciseData[];
  weeklyPlan: Record<string, string[]>;
  coachingTips: string[];
  priorityFocus: string;
}
