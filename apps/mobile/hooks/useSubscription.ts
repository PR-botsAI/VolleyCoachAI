import { useMemo } from "react";
import { useAuthStore } from "../stores/auth";
import { TIERS } from "@volleycoach/shared";
import type { TierKey, TierConfig } from "@volleycoach/shared";

type FeatureKey = keyof Omit<TierConfig, "name" | "price">;

export function useSubscription() {
  const subscription = useAuthStore((state) => state.subscription);
  const tier = subscription.tier;

  const tierConfig = useMemo(() => TIERS[tier], [tier]);

  const hasFeature = useMemo(
    () => (featureKey: FeatureKey): boolean => {
      const value = tierConfig[featureKey];
      if (typeof value === "boolean") return value;
      if (typeof value === "number") return value !== 0;
      if (typeof value === "string") return value !== "";
      return false;
    },
    [tierConfig]
  );

  const canUseAI = useMemo(() => tierConfig.canUseAICoach, [tierConfig]);

  const remainingAnalyses = useMemo(() => {
    if (tierConfig.aiAnalysesPerMonth === -1) return Infinity;
    return Math.max(
      0,
      tierConfig.aiAnalysesPerMonth - subscription.aiAnalysesUsed
    );
  }, [tierConfig, subscription.aiAnalysesUsed]);

  const isFreeTier = tier === "free";
  const isStarterTier = tier === "starter";
  const isProTier = tier === "pro";
  const isClubTier = tier === "club";

  const canCreateClub = tierConfig.canCreateClub;
  const canStream = tierConfig.canStream;
  const canScoreGames = tierConfig.canScoreGames;
  const canManageRosters = tierConfig.canManageRosters;

  const tierHierarchy: Record<TierKey, number> = {
    free: 0,
    starter: 1,
    pro: 2,
    club: 3,
  };

  const meetsMinimumTier = useMemo(
    () => (requiredTier: TierKey): boolean => {
      return tierHierarchy[tier] >= tierHierarchy[requiredTier];
    },
    [tier]
  );

  const upgradeTier = useMemo((): TierKey | null => {
    const tiers: TierKey[] = ["free", "starter", "pro", "club"];
    const currentIndex = tiers.indexOf(tier);
    if (currentIndex < tiers.length - 1) {
      return tiers[currentIndex + 1];
    }
    return null;
  }, [tier]);

  return {
    tier,
    tierConfig,
    tierName: tierConfig.name,
    hasFeature,
    canUseAI,
    remainingAnalyses,
    isFreeTier,
    isStarterTier,
    isProTier,
    isClubTier,
    canCreateClub,
    canStream,
    canScoreGames,
    canManageRosters,
    meetsMinimumTier,
    upgradeTier,
    subscriptionStatus: subscription.status,
    currentPeriodEnd: subscription.currentPeriodEnd,
  };
}
