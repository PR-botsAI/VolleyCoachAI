import React, { useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, Animated } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Badge } from "../ui/Badge";
import type { GameSummary } from "@volleycoach/shared";

interface LiveGameCardProps {
  game: GameSummary;
  viewerCount?: number;
  className?: string;
}

export function LiveGameCard({
  game,
  viewerCount,
  className = "",
}: LiveGameCardProps) {
  const router = useRouter();
  const borderOpacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(borderOpacity, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(borderOpacity, {
          toValue: 0.6,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [borderOpacity]);

  return (
    <TouchableOpacity
      onPress={() => router.push(`/game/${game.id}`)}
      activeOpacity={0.85}
      className={`w-72 ${className}`}
    >
      <Animated.View
        style={{ opacity: borderOpacity }}
        className="absolute inset-0 rounded-2xl border-2 border-danger-400"
      />
      <View className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700">
        {/* Header with Live badge */}
        <View className="flex-row items-center justify-between mb-3">
          <Badge variant="live">LIVE</Badge>
          {viewerCount !== undefined && (
            <View className="flex-row items-center">
              <Ionicons name="eye-outline" size={14} color="#6B7280" />
              <Text className="text-xs text-gray-500 ml-1">
                {viewerCount.toLocaleString()}
              </Text>
            </View>
          )}
        </View>

        {/* Teams and score */}
        <View className="flex-row items-center justify-between">
          {/* Home team */}
          <View className="flex-1 items-center">
            <View className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900 items-center justify-center mb-1">
              <Ionicons name="people" size={20} color="#4F46E5" />
            </View>
            <Text
              className="text-xs font-medium text-gray-700 dark:text-gray-300 text-center"
              numberOfLines={1}
            >
              {game.homeTeam.name}
            </Text>
            <Text className="text-[10px] text-gray-400" numberOfLines={1}>
              {game.homeTeam.clubName}
            </Text>
          </View>

          {/* Score */}
          <View className="items-center mx-3">
            <Text className="text-3xl font-black text-gray-900 dark:text-white">
              {game.homeScore}
              <Text className="text-gray-400"> - </Text>
              {game.awayScore}
            </Text>
            <Text className="text-xs text-gray-500 mt-0.5">Sets Won</Text>
          </View>

          {/* Away team */}
          <View className="flex-1 items-center">
            <View className="w-12 h-12 rounded-full bg-secondary-100 dark:bg-secondary-900 items-center justify-center mb-1">
              <Ionicons name="people" size={20} color="#F97316" />
            </View>
            <Text
              className="text-xs font-medium text-gray-700 dark:text-gray-300 text-center"
              numberOfLines={1}
            >
              {game.awayTeam.name}
            </Text>
            <Text className="text-[10px] text-gray-400" numberOfLines={1}>
              {game.awayTeam.clubName}
            </Text>
          </View>
        </View>

        {/* Stream indicator */}
        {game.hasStream && (
          <View className="flex-row items-center justify-center mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
            <Ionicons name="videocam" size={14} color="#4F46E5" />
            <Text className="text-xs font-medium text-primary-600 ml-1">
              Watch Stream
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}
