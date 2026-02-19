import React from "react";
import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSubscription } from "../../hooks/useSubscription";
import { Button } from "./Button";
import { TIERS } from "@volleycoach/shared/mobile";
import type { TierKey } from "@volleycoach/shared/mobile";

interface TierGateProps {
  requiredTier: TierKey;
  children: React.ReactNode;
  featureDescription?: string;
  features?: string[];
  className?: string;
}

export function TierGate({
  requiredTier,
  children,
  featureDescription,
  features = [],
  className = "",
}: TierGateProps) {
  const router = useRouter();
  const { meetsMinimumTier, tierName } = useSubscription();

  if (meetsMinimumTier(requiredTier)) {
    return <>{children}</>;
  }

  const requiredTierConfig = TIERS[requiredTier];

  return (
    <View className={`relative ${className}`}>
      {/* Blurred content preview */}
      <View className="opacity-20 pointer-events-none">{children}</View>

      {/* Overlay */}
      <View className="absolute inset-0 items-center justify-center bg-white/80 dark:bg-gray-900/80 rounded-2xl p-6">
        <View className="items-center max-w-xs">
          {/* Lock icon */}
          <View className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900 items-center justify-center mb-4">
            <Ionicons name="lock-closed" size={32} color="#4F46E5" />
          </View>

          {/* Title */}
          <Text className="text-lg font-bold text-gray-900 dark:text-white text-center mb-2">
            Upgrade to {requiredTierConfig.name}
          </Text>

          {/* Description */}
          <Text className="text-sm text-gray-500 dark:text-gray-400 text-center mb-4">
            {featureDescription ??
              `This feature requires the ${requiredTierConfig.name} plan. You're currently on the ${tierName} plan.`}
          </Text>

          {/* Features preview */}
          {features.length > 0 && (
            <View className="w-full mb-4">
              {features.map((feature, index) => (
                <View
                  key={index}
                  className="flex-row items-center mb-2"
                >
                  <Ionicons
                    name="checkmark-circle"
                    size={18}
                    color="#10B981"
                  />
                  <Text className="text-sm text-gray-700 dark:text-gray-300 ml-2">
                    {feature}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Price */}
          <Text className="text-2xl font-bold text-primary-600 mb-1">
            ${(requiredTierConfig.price / 100).toFixed(2)}
            <Text className="text-sm font-normal text-gray-500">/month</Text>
          </Text>

          {/* CTA */}
          <Button
            onPress={() => router.push("/subscribe" as never)}
            variant="primary"
            size="lg"
            fullWidth
            iconLeft="rocket-outline"
          >
            Upgrade Now
          </Button>
        </View>
      </View>
    </View>
  );
}
