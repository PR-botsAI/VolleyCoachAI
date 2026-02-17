import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Avatar } from "../../../components/ui/Avatar";
import { Badge } from "../../../components/ui/Badge";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { UpgradeCard } from "../../../components/paywall/UpgradeCard";
import { useAuth } from "../../../hooks/useAuth";
import { useSubscription } from "../../../hooks/useSubscription";

interface QuickLink {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description: string;
  onPress: () => void;
  color: string;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const {
    tierName,
    tier,
    isFreeTier,
    isProTier,
    isClubTier,
    canUseAI,
    remainingAnalyses,
  } = useSubscription();

  const quickLinks: QuickLink[] = [
    {
      icon: "shirt-outline",
      label: "My Teams",
      description: "View and manage your teams",
      onPress: () => router.push("/(tabs)/clubs"),
      color: "#4F46E5",
    },
    {
      icon: "analytics-outline",
      label: "My Analyses",
      description: "View AI coaching reports",
      onPress: () => router.push("/coach"),
      color: "#F97316",
    },
    {
      icon: "settings-outline",
      label: "Settings",
      description: "App preferences and account",
      onPress: () => {},
      color: "#6B7280",
    },
    {
      icon: "help-circle-outline",
      label: "Help & Support",
      description: "FAQs and contact support",
      onPress: () => {},
      color: "#14B8A6",
    },
  ];

  const roleBadgeVariant = (
    role: string
  ): "default" | "success" | "warning" | "info" => {
    switch (role) {
      case "coach":
        return "warning";
      case "club_admin":
        return "success";
      case "player":
        return "info";
      default:
        return "default";
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Profile header */}
        <View className="bg-white dark:bg-gray-800 px-6 pt-6 pb-8 border-b border-gray-100 dark:border-gray-700 items-center">
          <Avatar
            imageUrl={user?.avatarUrl}
            name={user?.fullName ?? "User"}
            size="xl"
          />
          <Text className="text-xl font-black text-gray-900 dark:text-white mt-4">
            {user?.fullName}
          </Text>
          <Text className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {user?.email}
          </Text>
          <View className="mt-2">
            <Badge variant={roleBadgeVariant(user?.role ?? "player")} size="md">
              {(user?.role ?? "player").replace("_", " ").toUpperCase()}
            </Badge>
          </View>
        </View>

        {/* Subscription tier card */}
        <View className="px-6 mt-4">
          <Card>
            <View className="flex-row items-center">
              <View
                className={`
                  w-12 h-12 rounded-xl items-center justify-center mr-3
                  ${isProTier || isClubTier ? "bg-secondary-100" : "bg-gray-100"}
                `}
              >
                <Ionicons
                  name={
                    isProTier || isClubTier ? "diamond" : "star-outline"
                  }
                  size={24}
                  color={isProTier || isClubTier ? "#F97316" : "#9CA3AF"}
                />
              </View>
              <View className="flex-1">
                <Text className="text-base font-bold text-gray-900 dark:text-white">
                  {tierName} Plan
                </Text>
                <Text className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {isFreeTier
                    ? "Upgrade to unlock more features"
                    : canUseAI
                    ? `${remainingAnalyses === Infinity ? "Unlimited" : remainingAnalyses} analyses remaining`
                    : "Active subscription"}
                </Text>
              </View>
              {!isClubTier && (
                <TouchableOpacity
                  onPress={() => router.push("/subscribe" as never)}
                  className="bg-primary-600 rounded-lg px-3 py-2 min-h-[36px] items-center justify-center"
                >
                  <Text className="text-xs font-bold text-white">
                    Upgrade
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </Card>
        </View>

        {/* Stats summary */}
        <View className="px-6 mt-4">
          <View className="flex-row gap-3">
            {[
              {
                label: "Games Watched",
                value: "0",
                icon: "eye-outline" as const,
              },
              {
                label: "Teams Followed",
                value: "0",
                icon: "heart-outline" as const,
              },
              {
                label: "Analyses",
                value: "0",
                icon: "bulb-outline" as const,
              },
            ].map((stat) => (
              <Card key={stat.label} className="flex-1">
                <View className="items-center">
                  <Ionicons name={stat.icon} size={22} color="#4F46E5" />
                  <Text className="text-2xl font-black text-gray-900 dark:text-white mt-1">
                    {stat.value}
                  </Text>
                  <Text className="text-[10px] text-gray-400 mt-0.5 text-center">
                    {stat.label}
                  </Text>
                </View>
              </Card>
            ))}
          </View>
        </View>

        {/* Quick links */}
        <View className="px-6 mt-6">
          <Text className="text-lg font-bold text-gray-900 dark:text-white mb-3">
            Quick Links
          </Text>
          <View className="gap-2">
            {quickLinks.map((link) => (
              <TouchableOpacity
                key={link.label}
                onPress={link.onPress}
                activeOpacity={0.7}
                className="flex-row items-center bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700"
              >
                <View
                  className="w-10 h-10 rounded-xl items-center justify-center mr-3"
                  style={{ backgroundColor: link.color + "15" }}
                >
                  <Ionicons
                    name={link.icon}
                    size={20}
                    color={link.color}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-gray-900 dark:text-white">
                    {link.label}
                  </Text>
                  <Text className="text-xs text-gray-400 mt-0.5">
                    {link.description}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Upgrade banner */}
        {(isFreeTier || tier === "starter") && (
          <View className="px-6 mt-6">
            <UpgradeCard compact />
          </View>
        )}

        {/* Logout */}
        <View className="px-6 mt-8">
          <Button
            onPress={logout}
            variant="ghost"
            size="lg"
            fullWidth
            iconLeft="log-out-outline"
          >
            Log Out
          </Button>
        </View>

        <Text className="text-xs text-gray-300 dark:text-gray-600 text-center mt-4">
          VolleyCoach v1.0.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
