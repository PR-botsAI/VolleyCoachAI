import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "../../components/ui/Badge";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Avatar } from "../../components/ui/Avatar";
import { api } from "../../services/api";
import type {
  FullAnalysisReport,
  AnalysisErrorItem,
  AnalysisExerciseItem,
  AnalysisPlayerStatItem,
} from "@volleycoach/shared/mobile";

type TabKey = "errors" | "exercises" | "players" | "timeline";

function ScoreGauge({ score }: { score: number }) {
  const rotation = (score / 100) * 180;
  const color =
    score >= 80
      ? "#10B981"
      : score >= 60
      ? "#F59E0B"
      : score >= 40
      ? "#F97316"
      : "#EF4444";

  return (
    <View className="items-center">
      <View className="w-32 h-16 overflow-hidden">
        <View className="w-32 h-32 rounded-full border-8 border-gray-200 dark:border-gray-700 relative">
          <View
            className="absolute inset-0 rounded-full border-8"
            style={{
              borderColor: color,
              borderTopColor: "transparent",
              borderRightColor: "transparent",
              transform: [{ rotate: `${rotation - 90}deg` }],
            }}
          />
        </View>
      </View>
      <Text className="text-4xl font-black mt-2" style={{ color }}>
        {score}
      </Text>
      <Text className="text-sm text-gray-500">out of 100</Text>
    </View>
  );
}

function SeverityBadge({ severity }: { severity: "high" | "medium" | "low" }) {
  const variants: Record<
    string,
    { variant: "danger" | "warning" | "info"; label: string }
  > = {
    high: { variant: "danger", label: "High" },
    medium: { variant: "warning", label: "Medium" },
    low: { variant: "info", label: "Low" },
  };

  const { variant, label } = variants[severity];

  return (
    <Badge variant={variant} size="sm">
      {label}
    </Badge>
  );
}

export default function AnalysisDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("errors");

  const {
    data: report,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["analysis", id],
    queryFn: async () => {
      const response = await api.get<FullAnalysisReport>(
        `/analyses/${id}`
      );
      return response.data;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900">
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text className="text-sm text-gray-400 mt-3">
          Loading analysis...
        </Text>
      </View>
    );
  }

  if (error || !report) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900 px-6">
        <Ionicons name="alert-circle-outline" size={56} color="#EF4444" />
        <Text className="text-lg font-bold text-gray-900 dark:text-white mt-4">
          Analysis Not Found
        </Text>
        <Button
          onPress={() => router.back()}
          variant="primary"
          size="md"
          className="mt-4"
        >
          Go Back
        </Button>
      </View>
    );
  }

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: "errors", label: "Errors", count: report.errors.length },
    { key: "exercises", label: "Exercises", count: report.exercises.length },
    { key: "players", label: "Players", count: report.playerStats.length },
    { key: "timeline", label: "Timeline", count: report.playCount ?? 0 },
  ];

  return (
    <ScrollView
      className="flex-1 bg-gray-50 dark:bg-gray-900"
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      {/* Score header */}
      <View className="bg-white dark:bg-gray-800 px-6 pt-6 pb-8 border-b border-gray-100 dark:border-gray-700">
        {report.overallScore !== null && (
          <ScoreGauge score={report.overallScore} />
        )}

        {/* Summary */}
        <Text className="text-sm text-gray-700 dark:text-gray-300 text-center mt-4 leading-5 px-4">
          {report.summary}
        </Text>

        {/* Quick stats */}
        <View className="flex-row mt-6 gap-3">
          <View className="flex-1 bg-gray-50 dark:bg-gray-700 rounded-xl p-3 items-center">
            <Text className="text-lg font-black text-primary-600">
              {report.playCount ?? 0}
            </Text>
            <Text className="text-xs text-gray-400">Plays</Text>
          </View>
          <View className="flex-1 bg-gray-50 dark:bg-gray-700 rounded-xl p-3 items-center">
            <Text className="text-lg font-black text-danger-500">
              {report.errorCount ?? 0}
            </Text>
            <Text className="text-xs text-gray-400">Errors</Text>
          </View>
          <View className="flex-1 bg-gray-50 dark:bg-gray-700 rounded-xl p-3 items-center">
            <Text className="text-lg font-black text-success-500">
              {report.exercises.length}
            </Text>
            <Text className="text-xs text-gray-400">Drills</Text>
          </View>
          <View className="flex-1 bg-gray-50 dark:bg-gray-700 rounded-xl p-3 items-center">
            <Text className="text-lg font-black text-secondary-500">
              {report.playerStats.length}
            </Text>
            <Text className="text-xs text-gray-400">Players</Text>
          </View>
        </View>
      </View>

      {/* Tab bar */}
      <View className="px-6 mt-4 mb-4">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 4 }}
        >
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              className={`
                flex-row items-center px-4 py-2.5 rounded-full min-h-[40px]
                ${
                  activeTab === tab.key
                    ? "bg-primary-600"
                    : "bg-gray-100 dark:bg-gray-800"
                }
              `}
            >
              <Text
                className={`
                  text-sm font-semibold
                  ${
                    activeTab === tab.key
                      ? "text-white"
                      : "text-gray-600 dark:text-gray-400"
                  }
                `}
              >
                {tab.label}
              </Text>
              {tab.count > 0 && (
                <View
                  className={`
                    ml-1.5 rounded-full px-1.5 min-w-[20px] items-center
                    ${
                      activeTab === tab.key
                        ? "bg-white/20"
                        : "bg-gray-200 dark:bg-gray-700"
                    }
                  `}
                >
                  <Text
                    className={`
                      text-xs font-bold
                      ${
                        activeTab === tab.key
                          ? "text-white"
                          : "text-gray-500 dark:text-gray-400"
                      }
                    `}
                  >
                    {tab.count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Tab content */}
      <View className="px-6">
        {activeTab === "errors" && (
          <View className="gap-3">
            {report.errors.length > 0 ? (
              report.errors.map((err) => (
                <Card key={err.id}>
                  <View className="flex-row items-start justify-between mb-2">
                    <Text className="text-base font-bold text-gray-900 dark:text-white flex-1 mr-2">
                      {err.title}
                    </Text>
                    <SeverityBadge severity={err.severity} />
                  </View>
                  <Text className="text-sm text-gray-600 dark:text-gray-400 leading-5">
                    {err.description}
                  </Text>
                  <View className="flex-row items-center mt-3 gap-4">
                    <View className="flex-row items-center">
                      <Ionicons
                        name="time-outline"
                        size={13}
                        color="#9CA3AF"
                      />
                      <Text className="text-xs text-gray-400 ml-1">
                        {err.timeRange}
                      </Text>
                    </View>
                    {err.category && (
                      <View className="flex-row items-center">
                        <Ionicons
                          name="pricetag-outline"
                          size={13}
                          color="#9CA3AF"
                        />
                        <Text className="text-xs text-gray-400 ml-1">
                          {err.category}
                        </Text>
                      </View>
                    )}
                    <View className="flex-row items-center">
                      <Ionicons
                        name="repeat-outline"
                        size={13}
                        color="#9CA3AF"
                      />
                      <Text className="text-xs text-gray-400 ml-1">
                        {err.frequency}
                      </Text>
                    </View>
                  </View>
                  {err.playerDescription && (
                    <View className="mt-2 bg-gray-50 dark:bg-gray-700 rounded-lg p-2">
                      <Text className="text-xs text-gray-500 dark:text-gray-400">
                        {err.playerDescription}
                      </Text>
                    </View>
                  )}
                </Card>
              ))
            ) : (
              <Card>
                <View className="items-center py-8">
                  <Ionicons
                    name="checkmark-circle"
                    size={48}
                    color="#10B981"
                  />
                  <Text className="text-base font-semibold text-gray-700 dark:text-gray-300 mt-3">
                    No Errors Detected
                  </Text>
                  <Text className="text-sm text-gray-400 text-center mt-1">
                    Great performance!
                  </Text>
                </View>
              </Card>
            )}
          </View>
        )}

        {activeTab === "exercises" && (
          <View className="gap-3">
            {report.exercises.length > 0 ? (
              report.exercises.map((exercise) => (
                <Card key={exercise.id}>
                  <View className="flex-row items-start justify-between mb-2">
                    <Text className="text-base font-bold text-gray-900 dark:text-white flex-1">
                      {exercise.name}
                    </Text>
                    <Badge variant="info" size="sm">
                      {exercise.difficulty}
                    </Badge>
                  </View>
                  <Text className="text-sm text-gray-600 dark:text-gray-400 leading-5">
                    {exercise.description}
                  </Text>
                  <View className="flex-row mt-3 gap-4">
                    <View className="flex-row items-center">
                      <Ionicons
                        name="time-outline"
                        size={14}
                        color="#4F46E5"
                      />
                      <Text className="text-xs font-medium text-primary-600 ml-1">
                        {exercise.duration}
                      </Text>
                    </View>
                    <View className="flex-row items-center">
                      <Ionicons
                        name="repeat-outline"
                        size={14}
                        color="#4F46E5"
                      />
                      <Text className="text-xs font-medium text-primary-600 ml-1">
                        {exercise.sets}
                      </Text>
                    </View>
                    <View className="flex-row items-center">
                      <Ionicons
                        name="fitness-outline"
                        size={14}
                        color="#4F46E5"
                      />
                      <Text className="text-xs font-medium text-primary-600 ml-1">
                        {exercise.targetArea}
                      </Text>
                    </View>
                  </View>
                </Card>
              ))
            ) : (
              <Card>
                <View className="items-center py-8">
                  <Ionicons
                    name="barbell-outline"
                    size={48}
                    color="#D1D5DB"
                  />
                  <Text className="text-sm text-gray-400 mt-2 text-center">
                    No exercises recommended
                  </Text>
                </View>
              </Card>
            )}
          </View>
        )}

        {activeTab === "players" && (
          <View className="gap-3">
            {report.playerStats.length > 0 ? (
              report.playerStats.map((player) => (
                <Card key={player.id}>
                  <View className="flex-row items-center mb-3">
                    <Avatar name={player.playerName} size="md" />
                    <View className="flex-1 ml-3">
                      <Text className="text-base font-bold text-gray-900 dark:text-white">
                        {player.playerName}
                      </Text>
                      {player.overallRating !== null && (
                        <Text className="text-sm text-primary-600 font-semibold">
                          Rating: {player.overallRating}/10
                        </Text>
                      )}
                    </View>
                  </View>

                  <View className="gap-2">
                    {[
                      { label: "Reception", value: player.reception },
                      { label: "Attack", value: player.attack },
                      { label: "Blocking", value: player.blocking },
                      { label: "Serving", value: player.serving },
                      { label: "Setting", value: player.setting },
                      { label: "Defense", value: player.defense },
                    ]
                      .filter((s) => s.value !== null)
                      .map((stat) => (
                        <View
                          key={stat.label}
                          className="flex-row items-center justify-between py-1"
                        >
                          <Text className="text-sm text-gray-500 dark:text-gray-400">
                            {stat.label}
                          </Text>
                          <Text className="text-sm font-semibold text-gray-900 dark:text-white">
                            {stat.value}
                          </Text>
                        </View>
                      ))}
                  </View>
                </Card>
              ))
            ) : (
              <Card>
                <View className="items-center py-8">
                  <Ionicons
                    name="people-outline"
                    size={48}
                    color="#D1D5DB"
                  />
                  <Text className="text-sm text-gray-400 mt-2 text-center">
                    No individual player data available
                  </Text>
                </View>
              </Card>
            )}
          </View>
        )}

        {activeTab === "timeline" && (
          <View>
            {report.errors.length > 0 ? (
              <Card noPadding>
                {report.errors
                  .filter((e) => e.videoTimestamp !== null)
                  .sort(
                    (a, b) =>
                      (a.videoTimestamp ?? 0) - (b.videoTimestamp ?? 0)
                  )
                  .map((entry, index, arr) => {
                    const minutes = Math.floor(
                      (entry.videoTimestamp ?? 0) / 60
                    );
                    const seconds = (entry.videoTimestamp ?? 0) % 60;

                    return (
                      <View
                        key={entry.id}
                        className={`
                          flex-row px-4 py-3
                          ${
                            index < arr.length - 1
                              ? "border-b border-gray-100 dark:border-gray-700"
                              : ""
                          }
                        `}
                      >
                        <View className="w-16 mr-3">
                          <Text className="text-sm font-mono font-bold text-primary-600">
                            {minutes}:{seconds.toString().padStart(2, "0")}
                          </Text>
                        </View>
                        <View className="flex-1">
                          <View className="flex-row items-center mb-1">
                            <Text className="text-sm font-semibold text-gray-900 dark:text-white flex-1">
                              {entry.title}
                            </Text>
                            <SeverityBadge severity={entry.severity} />
                          </View>
                          <Text
                            className="text-xs text-gray-500 dark:text-gray-400"
                            numberOfLines={2}
                          >
                            {entry.description}
                          </Text>
                        </View>
                      </View>
                    );
                  })}

                {report.errors.filter((e) => e.videoTimestamp !== null)
                  .length === 0 && (
                  <View className="items-center py-8">
                    <Text className="text-sm text-gray-400">
                      No timestamped events available
                    </Text>
                  </View>
                )}
              </Card>
            ) : (
              <Card>
                <View className="items-center py-8">
                  <Ionicons
                    name="timer-outline"
                    size={48}
                    color="#D1D5DB"
                  />
                  <Text className="text-sm text-gray-400 mt-2 text-center">
                    Timeline data not available
                  </Text>
                </View>
              </Card>
            )}
          </View>
        )}
      </View>

      {/* Analysis metadata */}
      <View className="px-6 mt-6">
        <Card>
          <View className="gap-2">
            <View className="flex-row justify-between">
              <Text className="text-xs text-gray-400">Analysis Type</Text>
              <Text className="text-xs font-medium text-gray-700 dark:text-gray-300">
                {report.analysisType}
              </Text>
            </View>
            {report.focusAreas.length > 0 && (
              <View className="flex-row justify-between">
                <Text className="text-xs text-gray-400">Focus Areas</Text>
                <Text className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  {report.focusAreas.join(", ")}
                </Text>
              </View>
            )}
            {report.processingTime !== null && (
              <View className="flex-row justify-between">
                <Text className="text-xs text-gray-400">
                  Processing Time
                </Text>
                <Text className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  {(report.processingTime / 1000).toFixed(1)}s
                </Text>
              </View>
            )}
            <View className="flex-row justify-between">
              <Text className="text-xs text-gray-400">Date</Text>
              <Text className="text-xs font-medium text-gray-700 dark:text-gray-300">
                {new Date(report.createdAt).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </Text>
            </View>
          </View>
        </Card>
      </View>
    </ScrollView>
  );
}
