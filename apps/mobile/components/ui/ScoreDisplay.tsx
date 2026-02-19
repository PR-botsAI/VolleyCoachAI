import React, { useEffect, useRef } from "react";
import { View, Text, Animated } from "react-native";
import type { SetDetail } from "@volleycoach/shared/mobile";

interface ScoreDisplayProps {
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  currentSet?: number;
  sets?: SetDetail[];
  isLive?: boolean;
  compact?: boolean;
  className?: string;
}

function PulsingDot() {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.4,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 0.4,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [scale, opacity]);

  return (
    <Animated.View
      style={{ transform: [{ scale }], opacity }}
      className="w-3 h-3 rounded-full bg-danger-500 mr-2"
    />
  );
}

export function ScoreDisplay({
  homeTeamName,
  awayTeamName,
  homeScore,
  awayScore,
  currentSet,
  sets,
  isLive = false,
  compact = false,
  className = "",
}: ScoreDisplayProps) {
  if (compact) {
    return (
      <View className={`flex-row items-center ${className}`}>
        {isLive && <PulsingDot />}
        <Text className="text-sm font-semibold text-gray-900 dark:text-white">
          {homeTeamName}
        </Text>
        <Text className="text-lg font-bold text-primary-600 mx-2">
          {homeScore} - {awayScore}
        </Text>
        <Text className="text-sm font-semibold text-gray-900 dark:text-white">
          {awayTeamName}
        </Text>
      </View>
    );
  }

  return (
    <View className={`items-center ${className}`}>
      {/* Live indicator */}
      {isLive && (
        <View className="flex-row items-center mb-3">
          <PulsingDot />
          <Text className="text-sm font-bold text-danger-500 uppercase tracking-wider">
            Live
          </Text>
        </View>
      )}

      {/* Set indicator */}
      {currentSet && (
        <Text className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
          Set {currentSet}
        </Text>
      )}

      {/* Team names */}
      <View className="flex-row items-center justify-between w-full mb-2">
        <View className="flex-1 items-center">
          <Text
            className="text-base font-semibold text-gray-900 dark:text-white text-center"
            numberOfLines={1}
          >
            {homeTeamName}
          </Text>
        </View>
        <View className="w-16" />
        <View className="flex-1 items-center">
          <Text
            className="text-base font-semibold text-gray-900 dark:text-white text-center"
            numberOfLines={1}
          >
            {awayTeamName}
          </Text>
        </View>
      </View>

      {/* Main score */}
      <View className="flex-row items-center justify-center">
        <Text className="text-5xl font-black text-primary-600">
          {homeScore}
        </Text>
        <Text className="text-3xl font-light text-gray-400 mx-4">-</Text>
        <Text className="text-5xl font-black text-primary-600">
          {awayScore}
        </Text>
      </View>

      {/* Set scores */}
      {sets && sets.length > 0 && (
        <View className="flex-row items-center mt-3 gap-2">
          {sets.map((set) => (
            <View
              key={set.setNumber}
              className={`
                px-3 py-1 rounded-full
                ${
                  set.status === "in_progress"
                    ? "bg-primary-100 dark:bg-primary-900"
                    : "bg-gray-100 dark:bg-gray-700"
                }
              `}
            >
              <Text
                className={`
                  text-xs font-semibold
                  ${
                    set.status === "in_progress"
                      ? "text-primary-700 dark:text-primary-300"
                      : "text-gray-600 dark:text-gray-400"
                  }
                `}
              >
                {set.homePoints}-{set.awayPoints}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
