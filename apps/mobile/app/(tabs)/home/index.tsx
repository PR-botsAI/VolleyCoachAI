import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Avatar } from "../../../components/ui/Avatar";
import { Card } from "../../../components/ui/Card";
import { LiveGameCard } from "../../../components/games/LiveGameCard";
import { GameCard } from "../../../components/games/GameCard";
import { useAuthStore } from "../../../stores/auth";
import { api } from "../../../services/api";
import type {
  GameSummary,
  TeamSummary,
} from "@volleycoach/shared/mobile";

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);

  const {
    data: liveGames,
    refetch: refetchLive,
    isLoading: isLoadingLive,
  } = useQuery({
    queryKey: ["games", "live"],
    queryFn: async () => {
      const response = await api.get<GameSummary[]>("/games/live");
      return response.data ?? [];
    },
  });

  const {
    data: upcomingGames,
    refetch: refetchUpcoming,
    isLoading: isLoadingUpcoming,
  } = useQuery({
    queryKey: ["games", "upcoming"],
    queryFn: async () => {
      const response = await api.get<GameSummary[]>("/games/upcoming", {
        params: { limit: 3 },
      });
      return response.data ?? [];
    },
  });

  const {
    data: myTeams,
    refetch: refetchTeams,
    isLoading: isLoadingTeams,
  } = useQuery({
    queryKey: ["teams", "my"],
    queryFn: async () => {
      const response = await api.get<TeamSummary[]>("/teams/my");
      return response.data ?? [];
    },
  });

  const {
    data: recentScores,
    refetch: refetchScores,
    isLoading: isLoadingScores,
  } = useQuery({
    queryKey: ["games", "recent"],
    queryFn: async () => {
      const response = await api.get<GameSummary[]>("/games/recent", {
        params: { limit: 5 },
      });
      return response.data ?? [];
    },
  });

  const onRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      refetchLive(),
      refetchUpcoming(),
      refetchTeams(),
      refetchScores(),
    ]);
    setIsRefreshing(false);
  };

  const hasLiveGames = liveGames && liveGames.length > 0;

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900" edges={["top"]}>
      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor="#4F46E5"
          />
        }
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Header */}
        <View className="px-6 pt-4 pb-6 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-sm text-gray-500 dark:text-gray-400">
                Welcome back,
              </Text>
              <Text className="text-2xl font-black text-gray-900 dark:text-white">
                {user?.fullName?.split(" ")[0] ?? "Player"}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/profile")}
              className="min-w-[44px] min-h-[44px] items-center justify-center"
            >
              <Avatar
                imageUrl={user?.avatarUrl}
                name={user?.fullName ?? "User"}
                size="lg"
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* LIVE NOW section */}
        {hasLiveGames && (
          <View className="mt-6">
            <View className="flex-row items-center px-6 mb-3">
              <View className="w-3 h-3 rounded-full bg-danger-500 mr-2" />
              <Text className="text-lg font-bold text-gray-900 dark:text-white">
                LIVE NOW
              </Text>
              <View className="flex-1" />
              <Text className="text-sm text-primary-600 font-medium">
                {liveGames.length} {liveGames.length === 1 ? "game" : "games"}
              </Text>
            </View>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 24, gap: 12 }}
              data={liveGames}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => <LiveGameCard game={item} />}
            />
          </View>
        )}

        {/* Upcoming Games */}
        <View className="mt-6 px-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg font-bold text-gray-900 dark:text-white">
              Upcoming Games
            </Text>
            <TouchableOpacity className="min-h-[44px] min-w-[44px] items-center justify-center">
              <Text className="text-sm text-primary-600 font-medium">
                See All
              </Text>
            </TouchableOpacity>
          </View>

          {isLoadingUpcoming ? (
            <View className="py-8 items-center">
              <Text className="text-sm text-gray-400">Loading games...</Text>
            </View>
          ) : upcomingGames && upcomingGames.length > 0 ? (
            <View className="gap-3">
              {upcomingGames.map((game) => (
                <GameCard key={game.id} game={game} />
              ))}
            </View>
          ) : (
            <Card>
              <View className="items-center py-6">
                <Ionicons name="calendar-outline" size={40} color="#D1D5DB" />
                <Text className="text-sm text-gray-400 mt-2 text-center">
                  No upcoming games.{"\n"}Follow teams to see their schedules.
                </Text>
              </View>
            </Card>
          )}
        </View>

        {/* Your Teams */}
        <View className="mt-6">
          <View className="flex-row items-center justify-between px-6 mb-3">
            <Text className="text-lg font-bold text-gray-900 dark:text-white">
              Your Teams
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/clubs")}
              className="min-h-[44px] min-w-[44px] items-center justify-center"
            >
              <Text className="text-sm text-primary-600 font-medium">
                Browse
              </Text>
            </TouchableOpacity>
          </View>

          {isLoadingTeams ? (
            <View className="py-8 items-center">
              <Text className="text-sm text-gray-400">
                Loading teams...
              </Text>
            </View>
          ) : myTeams && myTeams.length > 0 ? (
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 24, gap: 12 }}
              data={myTeams}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => router.push(`/team/${item.id}`)}
                  activeOpacity={0.7}
                  className="w-40 bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700"
                >
                  <View className="w-12 h-12 bg-primary-100 dark:bg-primary-900 rounded-xl items-center justify-center mb-3">
                    <Ionicons name="shirt" size={24} color="#4F46E5" />
                  </View>
                  <Text
                    className="text-sm font-bold text-gray-900 dark:text-white"
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                  <Text className="text-xs text-gray-500 mt-0.5">
                    {item.ageGroup}
                  </Text>
                  <Text className="text-xs text-gray-400 mt-1">
                    {item.record.wins}W - {item.record.losses}L
                  </Text>
                </TouchableOpacity>
              )}
            />
          ) : (
            <View className="px-6">
              <Card>
                <View className="items-center py-6">
                  <Ionicons name="shirt-outline" size={40} color="#D1D5DB" />
                  <Text className="text-sm text-gray-400 mt-2 text-center">
                    You haven't joined any teams yet.{"\n"}Browse clubs to find
                    your team.
                  </Text>
                </View>
              </Card>
            </View>
          )}
        </View>

        {/* Recent Scores */}
        <View className="mt-6 px-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg font-bold text-gray-900 dark:text-white">
              Recent Scores
            </Text>
          </View>

          {isLoadingScores ? (
            <View className="py-8 items-center">
              <Text className="text-sm text-gray-400">
                Loading scores...
              </Text>
            </View>
          ) : recentScores && recentScores.length > 0 ? (
            <View className="gap-3">
              {recentScores.map((game) => (
                <GameCard key={game.id} game={game} />
              ))}
            </View>
          ) : (
            <Card>
              <View className="items-center py-6">
                <Ionicons name="stats-chart-outline" size={40} color="#D1D5DB" />
                <Text className="text-sm text-gray-400 mt-2 text-center">
                  No recent scores to show.
                </Text>
              </View>
            </Card>
          )}
        </View>
      </ScrollView>

      {/* FAB */}
      <View className="absolute bottom-24 right-6">
        {fabOpen && (
          <View className="mb-3 gap-2">
            {[
              {
                label: "Score a Game",
                icon: "create-outline" as const,
                onPress: () => {
                  setFabOpen(false);
                },
              },
              {
                label: "Go Live",
                icon: "videocam-outline" as const,
                onPress: () => {
                  setFabOpen(false);
                },
              },
              {
                label: "Upload Video",
                icon: "cloud-upload-outline" as const,
                onPress: () => {
                  setFabOpen(false);
                  router.push("/coach");
                },
              },
            ].map((action, index) => (
              <TouchableOpacity
                key={index}
                onPress={action.onPress}
                activeOpacity={0.8}
                className="flex-row items-center self-end"
              >
                <View className="bg-white dark:bg-gray-800 rounded-xl px-3 py-2 mr-2 shadow-sm border border-gray-100 dark:border-gray-700">
                  <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {action.label}
                  </Text>
                </View>
                <View className="w-12 h-12 bg-primary-600 rounded-full items-center justify-center shadow-lg">
                  <Ionicons name={action.icon} size={22} color="#FFFFFF" />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity
          onPress={() => setFabOpen(!fabOpen)}
          activeOpacity={0.85}
          className={`
            w-14 h-14 rounded-full items-center justify-center shadow-lg self-end
            ${fabOpen ? "bg-gray-600" : "bg-primary-600"}
          `}
        >
          <Ionicons
            name={fabOpen ? "close" : "add"}
            size={28}
            color="#FFFFFF"
          />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
