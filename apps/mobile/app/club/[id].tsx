import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "../../components/ui/Badge";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { TeamBranchCard } from "../../components/clubs/TeamBranchCard";
import { GameCard } from "../../components/games/GameCard";
import { api } from "../../services/api";
import type {
  ClubWithTeams,
  GameSummary,
  StandingEntry,
} from "@volleycoach/shared";

type TabKey = "overview" | "teams" | "schedule" | "standings";

export default function ClubDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  const {
    data: club,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["club", id],
    queryFn: async () => {
      const response = await api.get<ClubWithTeams>(`/clubs/${id}`);
      return response.data;
    },
    enabled: !!id,
  });

  const { data: schedule } = useQuery({
    queryKey: ["club", id, "schedule"],
    queryFn: async () => {
      const response = await api.get<GameSummary[]>(
        `/clubs/${id}/schedule`
      );
      return response.data ?? [];
    },
    enabled: activeTab === "schedule" && !!id,
  });

  const { data: standings } = useQuery({
    queryKey: ["club", id, "standings"],
    queryFn: async () => {
      const response = await api.get<StandingEntry[]>(
        `/clubs/${id}/standings`
      );
      return response.data ?? [];
    },
    enabled: activeTab === "standings" && !!id,
  });

  const { data: membership } = useQuery({
    queryKey: ["club", id, "membership"],
    queryFn: async () => {
      const response = await api.get<{ isMember: boolean; role: string | null }>(
        `/clubs/${id}/membership`
      );
      return response.data;
    },
    enabled: !!id,
  });

  const joinMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/clubs/${id}/join`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["club", id, "membership"] });
    },
  });

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900">
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text className="text-sm text-gray-400 mt-3">Loading club...</Text>
      </View>
    );
  }

  if (error || !club) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900 px-6">
        <Ionicons name="alert-circle-outline" size={56} color="#EF4444" />
        <Text className="text-lg font-bold text-gray-900 dark:text-white mt-4">
          Club Not Found
        </Text>
        <Text className="text-sm text-gray-400 text-center mt-2">
          This club may have been removed or doesn't exist.
        </Text>
        <Button onPress={() => router.back()} variant="primary" size="md" className="mt-4">
          Go Back
        </Button>
      </View>
    );
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "teams", label: "Teams" },
    { key: "schedule", label: "Schedule" },
    { key: "standings", label: "Standings" },
  ];

  const isMember = membership?.isMember ?? false;

  return (
    <ScrollView
      className="flex-1 bg-gray-50 dark:bg-gray-900"
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      {/* Banner */}
      <View className="h-52 bg-primary-600 relative">
        {club.bannerUrl ? (
          <Image
            source={{ uri: club.bannerUrl }}
            className="w-full h-full"
            resizeMode="cover"
          />
        ) : (
          <View
            className="w-full h-full items-center justify-center"
            style={{
              backgroundColor: club.primaryColor ?? "#4F46E5",
            }}
          >
            <Ionicons name="shield" size={64} color="#FFFFFF40" />
          </View>
        )}

        {/* Club logo overlay */}
        <View className="absolute -bottom-10 left-6">
          {club.logoUrl ? (
            <Image
              source={{ uri: club.logoUrl }}
              className="w-20 h-20 rounded-2xl border-4 border-white dark:border-gray-900"
              resizeMode="cover"
            />
          ) : (
            <View
              className="w-20 h-20 rounded-2xl border-4 border-white dark:border-gray-900 items-center justify-center"
              style={{
                backgroundColor: club.primaryColor ?? "#4F46E5",
              }}
            >
              <Ionicons name="shield" size={36} color="#FFFFFF" />
            </View>
          )}
        </View>

        {/* Join/Member button */}
        <View className="absolute bottom-3 right-4">
          {isMember ? (
            <Badge variant="success" size="lg">
              Member
            </Badge>
          ) : (
            <Button
              onPress={() => joinMutation.mutate()}
              variant="secondary"
              size="sm"
              loading={joinMutation.isPending}
            >
              Join Club
            </Button>
          )}
        </View>
      </View>

      {/* Club info */}
      <View className="px-6 pt-14 pb-4">
        <View className="flex-row items-center">
          <Text className="text-xl font-black text-gray-900 dark:text-white">
            {club.name}
          </Text>
          {club.isVerified && (
            <Ionicons
              name="checkmark-circle"
              size={20}
              color="#4F46E5"
              style={{ marginLeft: 6 }}
            />
          )}
        </View>
        {(club.city || club.state) && (
          <View className="flex-row items-center mt-1">
            <Ionicons name="location-outline" size={14} color="#9CA3AF" />
            <Text className="text-sm text-gray-500 dark:text-gray-400 ml-1">
              {[club.city, club.state].filter(Boolean).join(", ")}
            </Text>
          </View>
        )}
      </View>

      {/* Tab bar */}
      <View className="px-6 mb-4">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="flex-row"
          contentContainerStyle={{ gap: 4 }}
        >
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              className={`
                px-4 py-2.5 rounded-full min-h-[40px] items-center justify-center
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
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Tab content */}
      <View className="px-6">
        {activeTab === "overview" && (
          <View className="gap-4">
            {club.description && (
              <Card>
                <Text className="text-sm text-gray-700 dark:text-gray-300 leading-5">
                  {club.description}
                </Text>
              </Card>
            )}

            <View className="flex-row gap-3">
              <Card className="flex-1">
                <View className="items-center">
                  <Text className="text-2xl font-black text-primary-600">
                    {club.teams.length}
                  </Text>
                  <Text className="text-xs text-gray-400 mt-0.5">Teams</Text>
                </View>
              </Card>
              <Card className="flex-1">
                <View className="items-center">
                  <Text className="text-2xl font-black text-primary-600">
                    {club.memberCount}
                  </Text>
                  <Text className="text-xs text-gray-400 mt-0.5">
                    Members
                  </Text>
                </View>
              </Card>
              <Card className="flex-1">
                <View className="items-center">
                  <Text className="text-2xl font-black text-success-500">
                    {club.teams.reduce(
                      (sum, t) => sum + t.record.wins,
                      0
                    )}
                  </Text>
                  <Text className="text-xs text-gray-400 mt-0.5">
                    Total Wins
                  </Text>
                </View>
              </Card>
            </View>

            {/* Quick team list */}
            {club.teams.length > 0 && (
              <View>
                <Text className="text-base font-bold text-gray-900 dark:text-white mb-2">
                  Teams
                </Text>
                <View className="gap-2">
                  {club.teams.slice(0, 5).map((team) => (
                    <TeamBranchCard key={team.id} team={team} />
                  ))}
                </View>
                {club.teams.length > 5 && (
                  <TouchableOpacity
                    onPress={() => setActiveTab("teams")}
                    className="items-center py-3 mt-2"
                  >
                    <Text className="text-sm font-semibold text-primary-600">
                      View All {club.teams.length} Teams
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}

        {activeTab === "teams" && (
          <View className="gap-3">
            {club.teams.length > 0 ? (
              club.teams.map((team) => (
                <TeamBranchCard key={team.id} team={team} />
              ))
            ) : (
              <Card>
                <View className="items-center py-8">
                  <Ionicons
                    name="shirt-outline"
                    size={40}
                    color="#D1D5DB"
                  />
                  <Text className="text-sm text-gray-400 mt-2">
                    No teams have been created yet
                  </Text>
                </View>
              </Card>
            )}
          </View>
        )}

        {activeTab === "schedule" && (
          <View className="gap-3">
            {schedule && schedule.length > 0 ? (
              schedule.map((game) => (
                <GameCard key={game.id} game={game} />
              ))
            ) : (
              <Card>
                <View className="items-center py-8">
                  <Ionicons
                    name="calendar-outline"
                    size={40}
                    color="#D1D5DB"
                  />
                  <Text className="text-sm text-gray-400 mt-2">
                    No upcoming games scheduled
                  </Text>
                </View>
              </Card>
            )}
          </View>
        )}

        {activeTab === "standings" && (
          <View>
            {standings && standings.length > 0 ? (
              <Card noPadding>
                {/* Header */}
                <View className="flex-row items-center px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700">
                  <Text className="w-8 text-xs font-bold text-gray-500">
                    #
                  </Text>
                  <Text className="flex-1 text-xs font-bold text-gray-500">
                    Team
                  </Text>
                  <Text className="w-10 text-xs font-bold text-gray-500 text-center">
                    W
                  </Text>
                  <Text className="w-10 text-xs font-bold text-gray-500 text-center">
                    L
                  </Text>
                  <Text className="w-14 text-xs font-bold text-gray-500 text-center">
                    PCT
                  </Text>
                </View>

                {/* Rows */}
                {standings.map((entry, index) => (
                  <TouchableOpacity
                    key={entry.teamId}
                    onPress={() => router.push(`/team/${entry.teamId}`)}
                    className={`
                      flex-row items-center px-4 py-3
                      ${
                        index < standings.length - 1
                          ? "border-b border-gray-100 dark:border-gray-700"
                          : ""
                      }
                    `}
                  >
                    <Text className="w-8 text-sm font-bold text-gray-500">
                      {entry.rank}
                    </Text>
                    <View className="flex-1">
                      <Text
                        className="text-sm font-semibold text-gray-900 dark:text-white"
                        numberOfLines={1}
                      >
                        {entry.teamName}
                      </Text>
                      <Text className="text-xs text-gray-400">
                        {entry.ageGroup}
                      </Text>
                    </View>
                    <Text className="w-10 text-sm font-semibold text-success-600 text-center">
                      {entry.wins}
                    </Text>
                    <Text className="w-10 text-sm font-semibold text-danger-500 text-center">
                      {entry.losses}
                    </Text>
                    <Text className="w-14 text-sm font-bold text-gray-900 dark:text-white text-center">
                      {(entry.winPercentage * 100).toFixed(0)}%
                    </Text>
                  </TouchableOpacity>
                ))}
              </Card>
            ) : (
              <Card>
                <View className="items-center py-8">
                  <Ionicons
                    name="trophy-outline"
                    size={40}
                    color="#D1D5DB"
                  />
                  <Text className="text-sm text-gray-400 mt-2">
                    No standings data available
                  </Text>
                </View>
              </Card>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
