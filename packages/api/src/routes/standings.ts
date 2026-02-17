import { Router, type Request, type Response } from "express";
import type { ApiResponse, StandingEntry } from "@volleycoach/shared";
import { getCache, setCache } from "../lib/redis.js";
import { getStandings } from "../services/standings-service.js";

const router = Router();

/**
 * Cache TTL for standings data (60 seconds).
 */
const STANDINGS_CACHE_TTL = 60;

/**
 * GET /api/standings
 * Get standings by seasonId and optional ageGroup filter.
 * Results are cached in Redis for 60 seconds.
 *
 * Query params:
 *   - seasonId (required): The season to get standings for
 *   - ageGroup (optional): Filter by age group (e.g., "14U", "16U")
 */
router.get("/api/standings", async (req: Request, res: Response) => {
  try {
    const { seasonId, ageGroup } = req.query;

    if (!seasonId) {
      res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "seasonId query parameter is required.",
        },
      } satisfies ApiResponse);
      return;
    }

    const sid = parseInt(seasonId as string, 10);
    if (isNaN(sid)) {
      res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "seasonId must be a valid integer.",
        },
      } satisfies ApiResponse);
      return;
    }

    const ageGroupFilter =
      ageGroup && typeof ageGroup === "string" ? ageGroup : undefined;

    // Build cache key from query parameters
    const cacheKey = `standings:${sid}:${ageGroupFilter || "all"}`;

    // Try cache first
    const cached = await getCache<StandingEntry[]>(cacheKey);
    if (cached) {
      res.json({
        success: true,
        data: cached,
        meta: { cached: true },
      } satisfies ApiResponse<StandingEntry[]>);
      return;
    }

    // Fetch from service
    const entries = await getStandings(sid, ageGroupFilter);

    // Cache the result
    await setCache(cacheKey, entries, STANDINGS_CACHE_TTL);

    res.json({
      success: true,
      data: entries,
      meta: { cached: false },
    } satisfies ApiResponse<StandingEntry[]>);
  } catch (err) {
    console.error("[Standings] Error fetching standings:", err);
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to fetch standings.",
      },
    } satisfies ApiResponse);
  }
});

export default router;
