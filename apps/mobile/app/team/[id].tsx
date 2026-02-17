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
import { GameCard } from "../../components/games/GameCard";
import { api } from "../../services/api";
import type { TeamWithRoster, GameSummary } from "@volleycoach/shared";
import { POSITIONS } from "@volleycoach/shared";

type TabKey = "roster" | "schedule" | "stats";

export default function TeamDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("roster");

  const {
    data: team,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["team", id],
    queryFn: async () => {
      const response = await api.get<TeamWithRoster>(`/teams/${id}`);
      return response.data;
    },
    enabled: !!id,
  });

  const { data: pastGames } = useQuery({
    queryKey: ["team", id, "games", "past"],
    queryFn: async () => {
      const response = await api.get<GameSummary[]>(
        `/teams/${id}/games/past`,
        { params: { limit: 10 } }
      );
      return response.data ?? [];
    },
    enabled: activeTab === "schedule" && !!id,
  });

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900">
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text className="text-sm text-gray-400 mt-3">Loading team...</Text>
      </View>
    );
  }

  if (error || !team) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900 px-6">
        <Ionicons name="alert-circle-outline" size={56} color="#EF4444" />
        <Text className="text-lg font-bold text-gray-900 dark:text-white mt-4">
          Team Not Found
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

  const tabs: { key: TabKey; label: string }[] = [
    { key: "roster", label: "Roster" },
    { key: "schedule", label: "Schedule" },
    { key: "stats", label: "Stats" },
  ];

  const getPositionLabel = (position: string | null): string => {
    if (!position) return "";
    const posConfig = POSITIONS[position as keyof typeof POSITIONS];
    return posConfig ? posConfig.abbreviation : position;
  };

  return (
    <ScrollView
      className="flex-1 bg-gray-50 dark:bg-gray-900"
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      {/* Team header */}
      <View className="bg-white dark:bg-gray-800 px-6 pt-4 pb-6">
        <View className="flex-row items-center">
          <View className="w-16 h-16 bg-primary-100 dark:bg-primary-900 rounded-2xl items-center justify-center mr-4">
            <Ionicons name="shirt" size={32} color="#4F46E5" />
          </View>
          <View className="flex-1">
            <Text className="text-xl font-black text-gray-900 dark:text-white">
              {team.name}
            </Text>
            <View className="flex-row items-center mt-1 gap-2">
              <Badge variant="info" size="sm">
                {team.ageGroup}
              </Badge>
              {team.division && (
                <Badge variant="default" size="sm">
                  {team.division}
                </Badge>
              )}
            </View>
          </View>
        </View>

        {/* Coach */}
        {team.headCoachName && (
          <View className="flex-row items-center mt-4 bg-gray-50 dark:bg-gray-700 rounded-xl p-3">
            <Avatar name={team.headCoachName} size="sm" />
            <View className="ml-3">
              <Text className="text-xs text-gray-500">Head Coach</Text>
              <Text className="text-sm font-semibold text-gray-900 dark:text-white">
                {team.headCoachName}
              </Text>
            </View>
          </View>
        )}

        {/* Record */}
        <View className="flex-row mt-4 gap-3">
          <View className="flex-1 bg-success-50 dark:bg-success-900/30 rounded-xl p-3 items-center">
            <Text className="text-2xl font-black text-success-600">
              {team.record.wins}
            </Text>
            <Text className="text-xs text-success-600 font-medium">
              Wins
            </Text>
          </View>
          <View className="flex-1 bg-danger-50 dark:bg-danger-900/30 rounded-xl p-3 items-center">
            <Text className="text-2xl font-black text-danger-500">
              {team.record.losses}
            </Text>
            <Text className="text-xs text-danger-500 font-medium">
              Losses
            </Text>
          </View>
          <View className="flex-1 bg-gray-50 dark:bg-gray-700 rounded-xl p-3 items-center">
            <Text className="text-2xl font-black text-gray-700 dark:text-gray-300">
              {team.playerCount}
            </Text>
            <Text className="text-xs text-gray-500 font-medium">
              Players
            </Text>
          </View>
        </View>
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
        {activeTab === "roster" && (
          <View>
            {team.roster && team.roster.length > 0 ? (
              <View className="flex-row flex-wrap gap-3">
                {team.roster.map((player) => (
                  <View
                    key={player.id}
                    className="w-[48%] bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-100 dark:border-gray-700"
                  >
                    <View className="items-center">
                      <Avatar
                        imageUrl={player.photoUrl}
                        name={`${player.firstName} ${player.lastName}`}
                        size="lg"
                      />
                      {player.jerseyNumber !== null && (
                        <View className="absolute top-0 right-0 bg-primary-600 rounded-full w-7 h-7 items-center justify-center">
                          <Text className="text-xs font-bold text-white">
                            {player.jerseyNumber}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text
                      className="text-sm font-bold text-gray-900 dark:text-white text-center mt-2"
                      numberOfLines={1}
                    >
                      {player.firstName} {player.lastName}
                    </Text>
                    {player.position && (
                      <Text className="text-xs text-primary-600 font-medium text-center mt-0.5">
                        {getPositionLabel(player.position)}
                      </Text>
                    )}
                    <View className="items-center mt-1">
                      <Badge
                        variant={
                          player.status === "active" ? "success" : "warning"
                        }
                        size="sm"
                      >
                        {player.status}
                      </Badge>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Card>
                <View className="items-center py-8">
                  <Ionicons
                    name="people-outline"
                    size={40}
                    color="#D1D5DB"
                  />
                  <Text className="text-sm text-gray-400 mt-2">
                    No players on the roster yet
                  </Text>
                </View>
              </Card>
            )}
          </View>
        )}

        {activeTab === "schedule" && (
          <View className="gap-3">
            {/* Upcoming */}
            {team.upcomingGames && team.upcomingGames.length > 0 && (
              <View>
                <Text className="text-base font-bold text-gray-900 dark:text-white mb-2">
                  Upcoming
                </Text>
                <View className="gap-3">
                  {team.upcomingGames.map((game) => (
                    <GameCard key={game.id} game={game} />
                  ))}
                </View>
              </View>
            )}

            {/* Past games */}
            {pastGames && pastGames.length > 0 && (
              <View className="mt-4">
                <Text className="text-base font-bold text-gray-900 dark:text-white mb-2">
                  Recent Results
                </Text>
                <View className="gap-3">
                  {pastGames.map((game) => (
                    <GameCard key={game.id} game={game} />
                  ))}
                </View>
              </View>
            )}

            {(!team.upcomingGames || team.upcomingGames.length === 0) &&
              (!pastGames || pastGames.length === 0) && (
                <Card>
                  <View className="items-center py-8">
                    <Ionicons
                      name="calendar-outline"
                      size={40}
                      color="#D1D5DB"
                    />
                    <Text className="text-sm text-gray-400 mt-2">
                      No games on the schedule
                    </Text>
                  </View>
                </Card>
              )}
          </View>
        )}

        {activeTab === "stats" && (
          <View>
            <Card>
              <View className="items-center py-8">
                <Ionicons
                  name="stats-chart-outline"
                  size={48}
                  color="#4F46E5"
                />
                <Text className="text-base font-bold text-gray-900 dark:text-white mt-3">
                  Team Statistics
                </Text>
                <Text className="text-sm text-gray-400 text-center mt-1">
                  Stats will appear here once games have been played and scored.
                </Text>

                <View className="w-full mt-6 gap-3">
                  {[
                    { label: "Games Played", value: String(team.record.wins + team.record.losses) },
                    {
                      label: "Win Rate",
                      value:
                        team.record.wins + team.record.losses > 0
                          ? `${((team.record.wins / (team.record.wins + team.record.losses)) * 100).toFixed(0)}%`
                          : "N/A",
                    },
                    { label: "Players", value: String(team.playerCount) },
                  ].map((stat) => (
                    <View
                      key={stat.label}
                      className="flex-row items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700"
                    >
                      <Text className="text-sm text-gray-500">
                        {stat.label}
                      </Text>
                      <Text className="text-sm font-bold text-gray-900 dark:text-white">
                        {stat.value}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </Card>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
