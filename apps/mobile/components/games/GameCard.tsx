import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Badge } from "../ui/Badge";
import type { GameSummary } from "@volleycoach/shared";

interface GameCardProps {
  game: GameSummary;
  className?: string;
}

function getStatusBadge(status: string): {
  label: string;
  variant: "default" | "success" | "warning" | "danger" | "live" | "info";
} {
  switch (status) {
    case "live":
      return { label: "LIVE", variant: "live" };
    case "completed":
      return { label: "Final", variant: "success" };
    case "canceled":
      return { label: "Canceled", variant: "danger" };
    case "postponed":
      return { label: "Postponed", variant: "warning" };
    default:
      return { label: "Scheduled", variant: "info" };
  }
}

function formatGameDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.ceil(
    (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";

  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatGameTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function GameCard({ game, className = "" }: GameCardProps) {
  const router = useRouter();
  const { label, variant } = getStatusBadge(game.status);

  return (
    <TouchableOpacity
      onPress={() => router.push(`/game/${game.id}`)}
      activeOpacity={0.7}
      className={`
        bg-white dark:bg-gray-800 rounded-2xl p-4
        border border-gray-100 dark:border-gray-700
        shadow-sm ${className}
      `}
    >
      {/* Date and status */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center">
          <Ionicons name="calendar-outline" size={14} color="#9CA3AF" />
          <Text className="text-xs text-gray-500 dark:text-gray-400 ml-1">
            {formatGameDate(game.scheduledAt)} at{" "}
            {formatGameTime(game.scheduledAt)}
          </Text>
        </View>
        <Badge variant={variant} size="sm">
          {label}
        </Badge>
      </View>

      {/* Teams */}
      <View className="flex-row items-center">
        {/* Home */}
        <View className="flex-1">
          <Text
            className="text-sm font-semibold text-gray-900 dark:text-white"
            numberOfLines={1}
          >
            {game.homeTeam.name}
          </Text>
          <Text className="text-xs text-gray-400" numberOfLines={1}>
            {game.homeTeam.clubName}
          </Text>
        </View>

        {/* Score or VS */}
        <View className="mx-4 items-center">
          {game.status === "completed" || game.status === "live" ? (
            <View className="flex-row items-center">
              <Text
                className={`text-xl font-bold ${
                  game.homeScore > game.awayScore
                    ? "text-primary-600"
                    : "text-gray-400"
                }`}
              >
                {game.homeScore}
              </Text>
              <Text className="text-lg text-gray-300 mx-1">-</Text>
              <Text
                className={`text-xl font-bold ${
                  game.awayScore > game.homeScore
                    ? "text-primary-600"
                    : "text-gray-400"
                }`}
              >
                {game.awayScore}
              </Text>
            </View>
          ) : (
            <Text className="text-sm font-bold text-gray-400">VS</Text>
          )}
        </View>

        {/* Away */}
        <View className="flex-1 items-end">
          <Text
            className="text-sm font-semibold text-gray-900 dark:text-white text-right"
            numberOfLines={1}
          >
            {game.awayTeam.name}
          </Text>
          <Text
            className="text-xs text-gray-400 text-right"
            numberOfLines={1}
          >
            {game.awayTeam.clubName}
          </Text>
        </View>
      </View>

      {/* Venue */}
      {game.venue && (
        <View className="flex-row items-center mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          <Ionicons name="location-outline" size={12} color="#9CA3AF" />
          <Text
            className="text-xs text-gray-400 ml-1 flex-1"
            numberOfLines={1}
          >
            {game.venue}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
