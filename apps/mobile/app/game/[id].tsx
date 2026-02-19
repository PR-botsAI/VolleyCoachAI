import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ScoreDisplay } from "../../components/ui/ScoreDisplay";
import { Badge } from "../../components/ui/Badge";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { useSubscription } from "../../hooks/useSubscription";
import { wsService } from "../../services/websocket";
import { api } from "../../services/api";
import type {
  GameDetail,
  LiveScoreUpdate,
  SetDetail,
} from "@volleycoach/shared/mobile";

type PointType = "kill" | "ace" | "block" | "opponent_error" | "tip" | "other";

const pointTypes: { key: PointType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "kill", label: "Kill", icon: "flash" },
  { key: "ace", label: "Ace", icon: "tennisball" },
  { key: "block", label: "Block", icon: "shield" },
  { key: "opponent_error", label: "Error", icon: "close-circle" },
  { key: "tip", label: "Tip", icon: "hand-left" },
  { key: "other", label: "Other", icon: "ellipse" },
];

interface PlayByPlayEntry {
  id: number;
  timestamp: string;
  description: string;
  homeScore: number;
  awayScore: number;
  setNumber: number;
}

export default function GameDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { canScoreGames } = useSubscription();
  const [selectedPointType, setSelectedPointType] = useState<PointType>("other");

  const {
    data: game,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["game", id],
    queryFn: async () => {
      const response = await api.get<GameDetail>(`/games/${id}`);
      return response.data;
    },
    enabled: !!id,
  });

  const { data: playByPlay } = useQuery({
    queryKey: ["game", id, "plays"],
    queryFn: async () => {
      const response = await api.get<PlayByPlayEntry[]>(
        `/games/${id}/plays`
      );
      return response.data ?? [];
    },
    enabled: !!id,
  });

  // Real-time score updates
  useEffect(() => {
    if (!id) return;

    const gameId = parseInt(id, 10);
    wsService.joinGameRoom(gameId);

    const unsubScore = wsService.onScoreUpdate(
      (update: LiveScoreUpdate) => {
        if (update.gameId === gameId) {
          queryClient.invalidateQueries({ queryKey: ["game", id] });
          queryClient.invalidateQueries({ queryKey: ["game", id, "plays"] });
        }
      }
    );

    return () => {
      wsService.leaveGameRoom(gameId);
      unsubScore();
    };
  }, [id, queryClient]);

  const scoreMutation = useMutation({
    mutationFn: async ({
      scoringTeamId,
    }: {
      scoringTeamId: number;
    }) => {
      const activeSet = game?.sets.find((s) => s.status === "in_progress");
      await api.post("/games/score", {
        gameId: parseInt(id!, 10),
        setId: activeSet?.setNumber ?? 1,
        scoringTeamId,
        pointType: selectedPointType,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["game", id] });
      queryClient.invalidateQueries({ queryKey: ["game", id, "plays"] });
    },
  });

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900">
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text className="text-sm text-gray-400 mt-3">Loading game...</Text>
      </View>
    );
  }

  if (error || !game) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900 px-6">
        <Ionicons name="alert-circle-outline" size={56} color="#EF4444" />
        <Text className="text-lg font-bold text-gray-900 dark:text-white mt-4">
          Game Not Found
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

  const isLive = game.status === "live";
  const isCompleted = game.status === "completed";
  const isScorekeeper = canScoreGames && isLive;
  const activeSet = game.sets.find((s) => s.status === "in_progress");

  return (
    <ScrollView
      className="flex-1 bg-gray-50 dark:bg-gray-900"
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      {/* Score display */}
      <View className="bg-white dark:bg-gray-800 px-6 pt-6 pb-8 border-b border-gray-100 dark:border-gray-700">
        <ScoreDisplay
          homeTeamName={game.homeTeam.name}
          awayTeamName={game.awayTeam.name}
          homeScore={game.homeScore}
          awayScore={game.awayScore}
          currentSet={activeSet?.setNumber}
          sets={game.sets}
          isLive={isLive}
        />

        {/* Game status */}
        <View className="items-center mt-4">
          {isLive ? (
            <Badge variant="live" size="lg">
              LIVE
            </Badge>
          ) : isCompleted ? (
            <Badge variant="success" size="lg">
              FINAL
            </Badge>
          ) : (
            <Badge variant="info" size="lg">
              {game.status.toUpperCase()}
            </Badge>
          )}
        </View>
      </View>

      {/* Scorekeeper controls */}
      {isScorekeeper && (
        <View className="px-6 mt-4">
          <Card>
            <Text className="text-base font-bold text-gray-900 dark:text-white text-center mb-3">
              Score This Game
            </Text>

            {/* Point type selector */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingBottom: 12 }}
            >
              {pointTypes.map((pt) => (
                <TouchableOpacity
                  key={pt.key}
                  onPress={() => setSelectedPointType(pt.key)}
                  className={`
                    px-3 py-2 rounded-xl flex-row items-center min-h-[36px]
                    ${
                      selectedPointType === pt.key
                        ? "bg-primary-100 dark:bg-primary-900 border-2 border-primary-500"
                        : "bg-gray-100 dark:bg-gray-700 border-2 border-transparent"
                    }
                  `}
                >
                  <Ionicons
                    name={pt.icon}
                    size={14}
                    color={
                      selectedPointType === pt.key ? "#4F46E5" : "#9CA3AF"
                    }
                  />
                  <Text
                    className={`
                      text-xs font-semibold ml-1
                      ${
                        selectedPointType === pt.key
                          ? "text-primary-700 dark:text-primary-300"
                          : "text-gray-500"
                      }
                    `}
                  >
                    {pt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Scoring buttons */}
            <View className="flex-row gap-4 mt-2">
              <TouchableOpacity
                onPress={() =>
                  scoreMutation.mutate({
                    scoringTeamId: game.homeTeam.id,
                  })
                }
                disabled={scoreMutation.isPending}
                activeOpacity={0.8}
                className="flex-1 bg-primary-600 rounded-2xl py-6 items-center active:bg-primary-700"
              >
                <Ionicons name="add-circle" size={32} color="#FFFFFF" />
                <Text className="text-white font-bold text-base mt-1">
                  {game.homeTeam.name}
                </Text>
                <Text className="text-primary-200 text-xs">+1 Point</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() =>
                  scoreMutation.mutate({
                    scoringTeamId: game.awayTeam.id,
                  })
                }
                disabled={scoreMutation.isPending}
                activeOpacity={0.8}
                className="flex-1 bg-secondary-500 rounded-2xl py-6 items-center active:bg-secondary-600"
              >
                <Ionicons name="add-circle" size={32} color="#FFFFFF" />
                <Text className="text-white font-bold text-base mt-1">
                  {game.awayTeam.name}
                </Text>
                <Text className="text-secondary-200 text-xs">+1 Point</Text>
              </TouchableOpacity>
            </View>
          </Card>
        </View>
      )}

      {/* Set breakdown */}
      <View className="px-6 mt-4">
        <Text className="text-lg font-bold text-gray-900 dark:text-white mb-3">
          Set Scores
        </Text>
        <Card noPadding>
          <View className="flex-row items-center px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700">
            <Text className="flex-1 text-xs font-bold text-gray-500">
              Set
            </Text>
            <Text className="w-20 text-xs font-bold text-gray-500 text-center">
              {game.homeTeam.name.substring(0, 10)}
            </Text>
            <Text className="w-20 text-xs font-bold text-gray-500 text-center">
              {game.awayTeam.name.substring(0, 10)}
            </Text>
            <Text className="w-16 text-xs font-bold text-gray-500 text-center">
              Status
            </Text>
          </View>
          {game.sets.length > 0 ? (
            game.sets.map((set, index) => (
              <View
                key={set.setNumber}
                className={`
                  flex-row items-center px-4 py-3
                  ${
                    index < game.sets.length - 1
                      ? "border-b border-gray-100 dark:border-gray-700"
                      : ""
                  }
                  ${set.status === "in_progress" ? "bg-primary-50 dark:bg-primary-900/20" : ""}
                `}
              >
                <Text className="flex-1 text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Set {set.setNumber}
                </Text>
                <Text
                  className={`
                    w-20 text-center text-lg font-black
                    ${
                      set.homePoints > set.awayPoints
                        ? "text-primary-600"
                        : "text-gray-400"
                    }
                  `}
                >
                  {set.homePoints}
                </Text>
                <Text
                  className={`
                    w-20 text-center text-lg font-black
                    ${
                      set.awayPoints > set.homePoints
                        ? "text-primary-600"
                        : "text-gray-400"
                    }
                  `}
                >
                  {set.awayPoints}
                </Text>
                <View className="w-16 items-center">
                  <Badge
                    variant={
                      set.status === "in_progress"
                        ? "live"
                        : set.status === "completed"
                        ? "success"
                        : "default"
                    }
                    size="sm"
                  >
                    {set.status === "in_progress"
                      ? "Live"
                      : set.status === "completed"
                      ? "Done"
                      : "---"}
                  </Badge>
                </View>
              </View>
            ))
          ) : (
            <View className="items-center py-6">
              <Text className="text-sm text-gray-400">
                No sets have started yet
              </Text>
            </View>
          )}
        </Card>
      </View>

      {/* Play-by-play */}
      <View className="px-6 mt-4">
        <Text className="text-lg font-bold text-gray-900 dark:text-white mb-3">
          Play-by-Play
        </Text>
        {playByPlay && playByPlay.length > 0 ? (
          <Card noPadding>
            {playByPlay.slice(0, 20).map((play, index) => (
              <View
                key={play.id}
                className={`
                  flex-row items-center px-4 py-3
                  ${
                    index < Math.min(playByPlay.length, 20) - 1
                      ? "border-b border-gray-100 dark:border-gray-700"
                      : ""
                  }
                `}
              >
                <View className="flex-1">
                  <Text className="text-sm text-gray-700 dark:text-gray-300">
                    {play.description}
                  </Text>
                  <Text className="text-xs text-gray-400 mt-0.5">
                    Set {play.setNumber}
                  </Text>
                </View>
                <Text className="text-sm font-bold text-gray-600 dark:text-gray-400 ml-2">
                  {play.homeScore}-{play.awayScore}
                </Text>
              </View>
            ))}
          </Card>
        ) : (
          <Card>
            <View className="items-center py-6">
              <Ionicons name="list-outline" size={36} color="#D1D5DB" />
              <Text className="text-sm text-gray-400 mt-2">
                No plays recorded yet
              </Text>
            </View>
          </Card>
        )}
      </View>

      {/* Game info */}
      <View className="px-6 mt-4">
        <Text className="text-lg font-bold text-gray-900 dark:text-white mb-3">
          Game Info
        </Text>
        <Card>
          <View className="gap-3">
            <View className="flex-row items-center">
              <Ionicons name="calendar-outline" size={18} color="#9CA3AF" />
              <Text className="text-sm text-gray-700 dark:text-gray-300 ml-3">
                {new Date(game.scheduledAt).toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </Text>
            </View>
            <View className="flex-row items-center">
              <Ionicons name="time-outline" size={18} color="#9CA3AF" />
              <Text className="text-sm text-gray-700 dark:text-gray-300 ml-3">
                {new Date(game.scheduledAt).toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                })}
              </Text>
            </View>
            {game.venue && (
              <View className="flex-row items-center">
                <Ionicons
                  name="location-outline"
                  size={18}
                  color="#9CA3AF"
                />
                <Text className="text-sm text-gray-700 dark:text-gray-300 ml-3">
                  {game.venue}
                </Text>
              </View>
            )}
            <View className="flex-row items-center">
              <Ionicons name="people-outline" size={18} color="#9CA3AF" />
              <Text className="text-sm text-gray-700 dark:text-gray-300 ml-3">
                {game.homeTeam.clubName} vs {game.awayTeam.clubName}
              </Text>
            </View>
          </View>
        </Card>
      </View>

      {/* Stream link */}
      {game.liveStream && game.hasStream && (
        <View className="px-6 mt-4">
          <Card>
            <TouchableOpacity
              className="flex-row items-center"
              activeOpacity={0.7}
            >
              <View className="w-12 h-12 bg-danger-100 rounded-xl items-center justify-center mr-3">
                <Ionicons name="videocam" size={24} color="#EF4444" />
              </View>
              <View className="flex-1">
                <Text className="text-base font-bold text-gray-900 dark:text-white">
                  Watch Live Stream
                </Text>
                <Text className="text-xs text-gray-500 mt-0.5">
                  {game.liveStream.viewerCount} viewers watching
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
            </TouchableOpacity>
          </Card>
        </View>
      )}
    </ScrollView>
  );
}
