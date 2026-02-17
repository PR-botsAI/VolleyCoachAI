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
import { SafeAreaView } from "react-native-safe-area-context";
import { Avatar } from "../../components/ui/Avatar";
import { Badge } from "../../components/ui/Badge";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { GameCard } from "../../components/games/GameCard";
import { api } from "../../services/api";
import type { GameSummary } from "@volleycoach/shared";

interface PlayerProfile {
  id: number;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  jerseyNumber: number | null;
  position: string | null;
  height: string | null;
  age: number | null;
  status: string;
  teamName: string;
  teamId: number;
  clubName: string;
  clubId: number;
  stats: {
    gamesPlayed: number;
    kills: number;
    aces: number;
    blocks: number;
    digs: number;
    assists: number;
    hittingPercentage: number;
  };
  recentAnalyses: {
    id: number;
    date: string;
    overallScore: number;
    summary: string;
  }[];
  teamHistory: {
    teamId: number;
    teamName: string;
    season: string;
    ageGroup: string;
  }[];
}

const MOCK_PLAYER: PlayerProfile = {
  id: 1,
  firstName: "Sarah",
  lastName: "Martinez",
  photoUrl: null,
  jerseyNumber: 7,
  position: "outside_hitter",
  height: "5'10\"",
  age: 16,
  status: "active",
  teamName: "Thunder 16U",
  teamId: 1,
  clubName: "Metro Volleyball Club",
  clubId: 1,
  stats: {
    gamesPlayed: 17,
    kills: 142,
    aces: 38,
    blocks: 24,
    digs: 86,
    assists: 12,
    hittingPercentage: 0.312,
  },
  recentAnalyses: [
    {
      id: 1,
      date: new Date(Date.now() - 172800000).toISOString(),
      overallScore: 78,
      summary:
        "Strong attacking game with room for improvement in serve receive.",
    },
    {
      id: 2,
      date: new Date(Date.now() - 604800000).toISOString(),
      overallScore: 72,
      summary:
        "Consistent blocking performance. Focus on approach footwork.",
    },
  ],
  teamHistory: [
    {
      teamId: 1,
      teamName: "Thunder 16U",
      season: "2025-2026",
      ageGroup: "16U",
    },
    {
      teamId: 5,
      teamName: "Storm 15U",
      season: "2024-2025",
      ageGroup: "15U",
    },
    {
      teamId: 8,
      teamName: "Lightning 14U",
      season: "2023-2024",
      ageGroup: "14U",
    },
  ],
};

const MOCK_RECENT_GAMES: GameSummary[] = [
  {
    id: 5,
    homeTeam: { id: 1, name: "Thunder 16U", clubName: "Metro Volleyball" },
    awayTeam: { id: 7, name: "Waves 16U", clubName: "Beach VBC" },
    homeScore: 3,
    awayScore: 1,
    status: "completed",
    scheduledAt: new Date(Date.now() - 86400000).toISOString(),
    venue: "City Arena",
    isLive: false,
    hasStream: false,
  },
];

function StatBox({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View className="flex-1 bg-white dark:bg-gray-800 rounded-xl p-3 items-center border border-gray-100 dark:border-gray-700">
      <Text className="text-2xl font-black" style={{ color }}>
        {value}
      </Text>
      <Text className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 text-center font-medium uppercase">
        {label}
      </Text>
    </View>
  );
}

function ScoreGauge({ score }: { score: number }) {
  const getColor = (s: number) => {
    if (s >= 80) return "#10B981";
    if (s >= 60) return "#F59E0B";
    return "#EF4444";
  };

  return (
    <View className="items-center">
      <View
        className="w-16 h-16 rounded-full items-center justify-center border-4"
        style={{ borderColor: getColor(score) }}
      >
        <Text
          className="text-lg font-black"
          style={{ color: getColor(score) }}
        >
          {score}
        </Text>
      </View>
    </View>
  );
}

export default function PlayerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<
    "stats" | "history" | "analysis"
  >("stats");

  const {
    data: player,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["player", id],
    queryFn: async () => {
      try {
        const response = await api.get<PlayerProfile>(`/players/${id}`);
        return response.data;
      } catch {
        return MOCK_PLAYER;
      }
    },
    enabled: !!id,
  });

  const { data: recentGames } = useQuery({
    queryKey: ["player", id, "games"],
    queryFn: async () => {
      try {
        const response = await api.get<GameSummary[]>(
          `/players/${id}/games`
        );
        return response.data ?? [];
      } catch {
        return MOCK_RECENT_GAMES;
      }
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900">
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text className="text-sm text-gray-400 mt-3">Loading player...</Text>
      </View>
    );
  }

  if (error || !player) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900 px-6">
        <Ionicons name="alert-circle-outline" size={56} color="#EF4444" />
        <Text className="text-lg font-bold text-gray-900 dark:text-white mt-4">
          Player Not Found
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

  const positionLabels: Record<string, string> = {
    outside_hitter: "Outside Hitter",
    opposite_hitter: "Opposite Hitter",
    setter: "Setter",
    middle_blocker: "Middle Blocker",
    libero: "Libero",
    defensive_specialist: "DS",
  };

  const tabs: { key: typeof activeTab; label: string }[] = [
    { key: "stats", label: "Stats" },
    { key: "history", label: "History" },
    { key: "analysis", label: "AI Analysis" },
  ];

  return (
    <SafeAreaView
      className="flex-1 bg-gray-50 dark:bg-gray-900"
      edges={["top"]}
    >
      {/* Back button */}
      <View className="px-4 pt-2 pb-1">
        <TouchableOpacity
          onPress={() => router.back()}
          className="flex-row items-center min-h-[44px] min-w-[44px]"
        >
          <Ionicons name="arrow-back" size={24} color="#4F46E5" />
          <Text className="text-base font-medium text-primary-600 ml-1">
            Back
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Player header */}
        <View className="bg-white dark:bg-gray-800 px-6 pt-4 pb-6 border-b border-gray-100 dark:border-gray-700 items-center">
          <View className="relative">
            <Avatar
              imageUrl={player.photoUrl}
              name={`${player.firstName} ${player.lastName}`}
              size="xl"
            />
            {player.jerseyNumber !== null && (
              <View className="absolute -bottom-1 -right-1 bg-primary-600 rounded-full w-8 h-8 items-center justify-center border-2 border-white dark:border-gray-800">
                <Text className="text-sm font-black text-white">
                  {player.jerseyNumber}
                </Text>
              </View>
            )}
          </View>

          <Text className="text-2xl font-black text-gray-900 dark:text-white mt-4">
            {player.firstName} {player.lastName}
          </Text>

          <View className="flex-row items-center mt-2 gap-2">
            {player.position && (
              <Badge variant="info" size="md">
                {positionLabels[player.position] ?? player.position}
              </Badge>
            )}
            <Badge
              variant={
                player.status === "active" ? "success" : "warning"
              }
              size="md"
            >
              {player.status}
            </Badge>
          </View>

          <View className="flex-row items-center mt-3 gap-4">
            {player.height && (
              <View className="flex-row items-center">
                <Ionicons
                  name="resize-outline"
                  size={14}
                  color="#9CA3AF"
                />
                <Text className="text-sm text-gray-500 dark:text-gray-400 ml-1">
                  {player.height}
                </Text>
              </View>
            )}
            {player.age && (
              <View className="flex-row items-center">
                <Ionicons
                  name="calendar-outline"
                  size={14}
                  color="#9CA3AF"
                />
                <Text className="text-sm text-gray-500 dark:text-gray-400 ml-1">
                  {player.age} years old
                </Text>
              </View>
            )}
          </View>

          {/* Team link */}
          <TouchableOpacity
            onPress={() => router.push(`/team/${player.teamId}`)}
            className="flex-row items-center mt-3 bg-gray-50 dark:bg-gray-700 rounded-xl px-4 py-2"
          >
            <Ionicons name="shirt-outline" size={16} color="#4F46E5" />
            <Text className="text-sm font-medium text-primary-600 ml-2">
              {player.teamName}
            </Text>
            <Text className="text-sm text-gray-400 ml-1">
              ({player.clubName})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab bar */}
        <View className="px-6 mt-4 mb-4">
          <View className="flex-row bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
            {tabs.map((tab) => (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                className={`
                  flex-1 py-2.5 rounded-lg items-center min-h-[40px]
                  ${
                    activeTab === tab.key
                      ? "bg-white dark:bg-gray-700 shadow-sm"
                      : ""
                  }
                `}
              >
                <Text
                  className={`
                    text-sm font-semibold
                    ${
                      activeTab === tab.key
                        ? "text-primary-600"
                        : "text-gray-500 dark:text-gray-400"
                    }
                  `}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Tab content */}
        <View className="px-6">
          {activeTab === "stats" && (
            <View className="gap-4">
              {/* Season stats */}
              <View className="flex-row gap-2">
                <StatBox
                  label="Games"
                  value={String(player.stats.gamesPlayed)}
                  color="#4F46E5"
                />
                <StatBox
                  label="Kills"
                  value={String(player.stats.kills)}
                  color="#F97316"
                />
                <StatBox
                  label="Aces"
                  value={String(player.stats.aces)}
                  color="#14B8A6"
                />
              </View>
              <View className="flex-row gap-2">
                <StatBox
                  label="Blocks"
                  value={String(player.stats.blocks)}
                  color="#EF4444"
                />
                <StatBox
                  label="Digs"
                  value={String(player.stats.digs)}
                  color="#10B981"
                />
                <StatBox
                  label="Assists"
                  value={String(player.stats.assists)}
                  color="#F59E0B"
                />
              </View>

              {/* Hitting percentage */}
              <Card>
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="text-sm text-gray-500 dark:text-gray-400">
                      Hitting Percentage
                    </Text>
                    <Text className="text-3xl font-black text-primary-600 mt-1">
                      .
                      {(player.stats.hittingPercentage * 1000)
                        .toFixed(0)
                        .padStart(3, "0")}
                    </Text>
                  </View>
                  <View className="w-20 h-20 rounded-full border-4 border-primary-600 items-center justify-center">
                    <Text className="text-lg font-black text-primary-600">
                      {(player.stats.hittingPercentage * 100).toFixed(0)}%
                    </Text>
                  </View>
                </View>
              </Card>

              {/* Per-game averages */}
              <Card header="Per Game Averages">
                <View className="gap-3">
                  {[
                    {
                      label: "Kills/Game",
                      value: (
                        player.stats.kills /
                        Math.max(player.stats.gamesPlayed, 1)
                      ).toFixed(1),
                    },
                    {
                      label: "Aces/Game",
                      value: (
                        player.stats.aces /
                        Math.max(player.stats.gamesPlayed, 1)
                      ).toFixed(1),
                    },
                    {
                      label: "Blocks/Game",
                      value: (
                        player.stats.blocks /
                        Math.max(player.stats.gamesPlayed, 1)
                      ).toFixed(1),
                    },
                    {
                      label: "Digs/Game",
                      value: (
                        player.stats.digs /
                        Math.max(player.stats.gamesPlayed, 1)
                      ).toFixed(1),
                    },
                  ].map((stat) => (
                    <View
                      key={stat.label}
                      className="flex-row items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700"
                    >
                      <Text className="text-sm text-gray-600 dark:text-gray-400">
                        {stat.label}
                      </Text>
                      <Text className="text-sm font-bold text-gray-900 dark:text-white">
                        {stat.value}
                      </Text>
                    </View>
                  ))}
                </View>
              </Card>

              {/* Recent Games */}
              {recentGames && recentGames.length > 0 && (
                <View>
                  <Text className="text-base font-bold text-gray-900 dark:text-white mb-2">
                    Recent Games
                  </Text>
                  <View className="gap-3">
                    {recentGames.map((game) => (
                      <GameCard key={game.id} game={game} />
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}

          {activeTab === "history" && (
            <View className="gap-3">
              <Text className="text-base font-bold text-gray-900 dark:text-white mb-1">
                Team History
              </Text>
              {player.teamHistory.map((entry, index) => (
                <TouchableOpacity
                  key={`${entry.teamId}-${entry.season}`}
                  onPress={() => router.push(`/team/${entry.teamId}`)}
                  className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 flex-row items-center"
                >
                  <View className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-900 items-center justify-center mr-3">
                    <Text className="text-sm font-black text-primary-700 dark:text-primary-300">
                      {entry.ageGroup}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-gray-900 dark:text-white">
                      {entry.teamName}
                    </Text>
                    <Text className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {entry.season}
                    </Text>
                  </View>
                  {index === 0 && (
                    <Badge variant="success" size="sm">
                      Current
                    </Badge>
                  )}
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color="#D1D5DB"
                    style={{ marginLeft: 8 }}
                  />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {activeTab === "analysis" && (
            <View className="gap-4">
              {player.recentAnalyses.length > 0 ? (
                player.recentAnalyses.map((analysis) => (
                  <TouchableOpacity
                    key={analysis.id}
                    onPress={() =>
                      router.push(`/analysis/${analysis.id}`)
                    }
                    activeOpacity={0.7}
                    className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700"
                  >
                    <View className="flex-row items-start">
                      <ScoreGauge score={analysis.overallScore} />
                      <View className="flex-1 ml-4">
                        <Text className="text-sm font-bold text-gray-900 dark:text-white">
                          AI Analysis Report
                        </Text>
                        <Text className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {new Date(analysis.date).toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            }
                          )}
                        </Text>
                        <Text
                          className="text-sm text-gray-600 dark:text-gray-400 mt-2"
                          numberOfLines={2}
                        >
                          {analysis.summary}
                        </Text>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={18}
                        color="#D1D5DB"
                      />
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                <Card>
                  <View className="items-center py-8">
                    <Ionicons
                      name="bulb-outline"
                      size={48}
                      color="#D1D5DB"
                    />
                    <Text className="text-lg font-bold text-gray-900 dark:text-white mt-3 text-center">
                      No Analyses Yet
                    </Text>
                    <Text className="text-sm text-gray-400 text-center mt-1 px-4">
                      Upload a game video to get AI-powered insights on
                      this player.
                    </Text>
                    <Button
                      onPress={() => router.push("/coach" as never)}
                      variant="primary"
                      size="md"
                      className="mt-4"
                      iconLeft="cloud-upload-outline"
                    >
                      Upload Video
                    </Button>
                  </View>
                </Card>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
