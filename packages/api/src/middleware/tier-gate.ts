import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db } from "../lib/db.js";
import { subscriptions, TIERS } from "@volleycoach/shared";
import type { TierKey } from "@volleycoach/shared";

/**
 * Tier hierarchy from lowest to highest.
 * Higher index = higher tier.
 */
const TIER_HIERARCHY: TierKey[] = ["free", "starter", "pro", "club"];

/**
 * Get the numeric rank of a tier for comparison.
 */
function tierRank(tier: TierKey): number {
  return TIER_HIERARCHY.indexOf(tier);
}

/**
 * Middleware factory that enforces a minimum subscription tier.
 * Returns 403 with an upgrade_required error if the user's tier is below the minimum.
 *
 * Must be used after requireAuth middleware (req.user must exist).
 */
export function requireTier(minimumTier: TierKey) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user;
    if (!user) {
      res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required.",
        },
      });
      return;
    }

    const userTierRank = tierRank(user.tier);
    const requiredTierRank = tierRank(minimumTier);

    if (userTierRank < requiredTierRank) {
      const tierConfig = TIERS[minimumTier];
      res.status(403).json({
        success: false,
        error: {
          code: "UPGRADE_REQUIRED",
          message: `This feature requires the ${tierConfig.name} plan or higher. Please upgrade your subscription.`,
          details: {
            currentTier: user.tier,
            requiredTier: minimumTier,
            upgradePath: `/subscribe?plan=${minimumTier}`,
          },
        },
      });
      return;
    }

    next();
  };
}

/**
 * Middleware that checks whether the user has remaining AI analyses for the
 * current billing period. Returns 403 if the monthly limit has been reached.
 *
 * Must be used after requireAuth middleware (req.user must exist).
 */
export async function checkAILimit(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const user = req.user;
  if (!user) {
    res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required.",
      },
    });
    return;
  }

  try {
    const tierConfig = TIERS[user.tier];

    // Club tier has unlimited analyses
    if (tierConfig.aiAnalysesPerMonth === -1) {
      next();
      return;
    }

    // If the tier has no AI access at all
    if (tierConfig.aiAnalysesPerMonth === 0) {
      res.status(403).json({
        success: false,
        error: {
          code: "UPGRADE_REQUIRED",
          message:
            "AI video analysis is not available on your current plan. Upgrade to Pro or higher.",
          details: {
            currentTier: user.tier,
            requiredTier: "pro",
            aiAnalysesPerMonth: 0,
          },
        },
      });
      return;
    }

    // Look up current usage from the subscription record
    const subResult = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, user.id))
      .limit(1);

    const subscription = subResult[0];
    if (!subscription) {
      res.status(403).json({
        success: false,
        error: {
          code: "NO_SUBSCRIPTION",
          message: "No active subscription found.",
        },
      });
      return;
    }

    const used = subscription.aiAnalysesUsed;
    const limit = tierConfig.aiAnalysesPerMonth;

    if (used >= limit) {
      res.status(403).json({
        success: false,
        error: {
          code: "AI_LIMIT_REACHED",
          message: `You have used all ${limit} AI analyses for this billing period. Upgrade to Club for unlimited analyses.`,
          details: {
            used,
            limit,
            currentTier: user.tier,
            resetsAt: subscription.currentPeriodEnd?.toISOString() ?? null,
          },
        },
      });
      return;
    }

    next();
  } catch (err) {
    console.error("[TierGate] Error checking AI limit:", err);
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to verify AI analysis limits.",
      },
    });
  }
}
