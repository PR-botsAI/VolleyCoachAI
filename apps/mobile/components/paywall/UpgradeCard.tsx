import React from "react";
import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "../ui/Button";
import { useSubscription } from "../../hooks/useSubscription";
import { TIERS } from "@volleycoach/shared";
import type { TierKey } from "@volleycoach/shared";

interface UpgradeCardProps {
  targetTier?: TierKey;
  compact?: boolean;
  className?: string;
}

const tierFeatureLabels: Record<TierKey, string[]> = {
  free: ["Follow up to 3 teams", "View scores and schedules"],
  starter: [
    "Create and manage a club",
    "Live score entry",
    "Calendar with reminders",
    "RSVP tracking",
    "Ad-free experience",
  ],
  pro: [
    "Everything in Starter",
    "AI video analysis (5/month)",
    "Live streaming",
    "Advanced analytics",
    "Manage 3 teams",
  ],
  club: [
    "Everything in Pro",
    "Unlimited AI analyses",
    "Unlimited teams",
    "Tournament management",
    "Custom branding",
    "API access",
    "Priority support",
  ],
};

export function UpgradeCard({
  targetTier,
  compact = false,
  className = "",
}: UpgradeCardProps) {
  const router = useRouter();
  const { tier, tierName, upgradeTier } = useSubscription();

  const target = targetTier ?? upgradeTier;
  if (!target) return null;

  const targetConfig = TIERS[target];
  const features = tierFeatureLabels[target];

  if (compact) {
    return (
      <View
        className={`
          flex-row items-center bg-gradient-to-r
          bg-primary-600 rounded-2xl p-4 ${className}
        `}
      >
        <View className="flex-1">
          <Text className="text-white font-bold text-base mb-0.5">
            Upgrade to {targetConfig.name}
          </Text>
          <Text className="text-primary-200 text-sm">
            Unlock {target === "pro" ? "AI coaching" : "premium features"}
          </Text>
        </View>
        <View className="ml-3">
          <Button
            onPress={() => router.push("/subscribe" as never)}
            variant="secondary"
            size="sm"
          >
            Upgrade
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View
      className={`
        bg-white dark:bg-gray-800 rounded-2xl border-2 border-primary-200
        dark:border-primary-800 overflow-hidden ${className}
      `}
    >
      {/* Header */}
      <View className="bg-primary-600 px-5 py-4">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-primary-200 text-xs uppercase tracking-wider font-medium">
              Upgrade to
            </Text>
            <Text className="text-white text-xl font-bold">
              {targetConfig.name}
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-white text-2xl font-bold">
              ${(targetConfig.price / 100).toFixed(2)}
            </Text>
            <Text className="text-primary-200 text-xs">/month</Text>
          </View>
        </View>
      </View>

      {/* Current plan indicator */}
      <View className="px-5 py-2 bg-gray-50 dark:bg-gray-900">
        <Text className="text-xs text-gray-500 dark:text-gray-400">
          You are currently on the{" "}
          <Text className="font-bold">{tierName}</Text> plan
        </Text>
      </View>

      {/* Features */}
      <View className="px-5 py-4">
        {features.map((feature, index) => (
          <View key={index} className="flex-row items-center mb-3">
            <View className="w-5 h-5 rounded-full bg-success-100 items-center justify-center mr-3">
              <Ionicons
                name="checkmark"
                size={14}
                color="#10B981"
              />
            </View>
            <Text className="text-sm text-gray-700 dark:text-gray-300 flex-1">
              {feature}
            </Text>
          </View>
        ))}
      </View>

      {/* CTA */}
      <View className="px-5 pb-5">
        <Button
          onPress={() => router.push("/subscribe" as never)}
          variant="primary"
          size="lg"
          fullWidth
          iconRight="arrow-forward"
        >
          Upgrade Now
        </Button>
      </View>
    </View>
  );
}
