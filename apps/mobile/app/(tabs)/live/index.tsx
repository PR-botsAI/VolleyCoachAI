import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "../../../components/ui/Badge";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { LiveGameCard } from "../../../components/games/LiveGameCard";
import { useSubscription } from "../../../hooks/useSubscription";
import { wsService } from "../../../services/websocket";
import { api } from "../../../services/api";
import type { LiveStreamInfo, GameSummary } from "@volleycoach/shared/mobile";

export default function LiveScreen() {
  const router = useRouter();
  const { canStream } = useSubscription();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const {
    data: activeStreams,
    refetch: refetchStreams,
    isLoading: isLoadingStreams,
  } = useQuery({
    queryKey: ["streams", "active"],
    queryFn: async () => {
      const response = await api.get<LiveStreamInfo[]>("/streams/active");
      return response.data ?? [];
    },
    refetchInterval: 30000,
  });

  const {
    data: upcomingStreams,
    refetch: refetchUpcoming,
    isLoading: isLoadingUpcoming,
  } = useQuery({
    queryKey: ["streams", "upcoming"],
    queryFn: async () => {
      const response = await api.get<LiveStreamInfo[]>("/streams/upcoming");
      return response.data ?? [];
    },
  });

  const {
    data: liveGames,
    refetch: refetchGames,
    isLoading: isLoadingGames,
  } = useQuery({
    queryKey: ["games", "live"],
    queryFn: async () => {
      const response = await api.get<GameSummary[]>("/games/live");
      return response.data ?? [];
    },
    refetchInterval: 15000,
  });

  useEffect(() => {
    const unsubStarted = wsService.onStreamStarted(() => {
      refetchStreams();
      refetchGames();
    });
    const unsubEnded = wsService.onStreamEnded(() => {
      refetchStreams();
      refetchGames();
    });

    return () => {
      unsubStarted();
      unsubEnded();
    };
  }, [refetchStreams, refetchGames]);

  const onRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([refetchStreams(), refetchUpcoming(), refetchGames()]);
    setIsRefreshing(false);
  };

  const hasActiveStreams = activeStreams && activeStreams.length > 0;
  const hasLiveGames = liveGames && liveGames.length > 0;

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900" edges={["top"]}>
      {/* Header */}
      <View className="bg-white dark:bg-gray-800 px-6 pt-4 pb-4 border-b border-gray-100 dark:border-gray-700">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-black text-gray-900 dark:text-white">
              Live
            </Text>
          </View>
          {canStream && (
            <Button onPress={() => {}} variant="primary" size="sm" iconLeft="videocam">
              Go Live
            </Button>
          )}
        </View>
      </View>

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
        {/* Active Streams */}
        <View className="mt-4 px-6">
          <View className="flex-row items-center mb-3">
            <View className="w-3 h-3 rounded-full bg-danger-500 mr-2" />
            <Text className="text-lg font-bold text-gray-900 dark:text-white">
              LIVE NOW
            </Text>
            {hasActiveStreams && (
              <Badge variant="danger" size="sm" className="ml-2">
                {String(activeStreams.length)}
              </Badge>
            )}
          </View>

          {isLoadingStreams ? (
            <View className="py-12 items-center">
              <ActivityIndicator size="large" color="#4F46E5" />
              <Text className="text-sm text-gray-400 mt-3">
                Loading live streams...
              </Text>
            </View>
          ) : hasActiveStreams ? (
            <View className="gap-4">
              {activeStreams.map((stream) => (
                <TouchableOpacity
                  key={stream.id}
                  onPress={() => {
                    if (stream.game) {
                      router.push(`/game/${stream.game.id}`);
                    }
                  }}
                  activeOpacity={0.8}
                  className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700 shadow-sm"
                >
                  {/* Thumbnail placeholder */}
                  <View className="h-44 bg-gray-900 items-center justify-center relative">
                    <Ionicons name="play-circle" size={56} color="#FFFFFF80" />
                    {/* Overlay info */}
                    <View className="absolute top-3 left-3">
                      <Badge variant="live" size="md">
                        LIVE
                      </Badge>
                    </View>
                    <View className="absolute top-3 right-3 flex-row items-center bg-black/50 rounded-full px-2 py-1">
                      <Ionicons name="eye" size={12} color="#FFFFFF" />
                      <Text className="text-xs text-white font-medium ml-1">
                        {stream.viewerCount.toLocaleString()}
                      </Text>
                    </View>
                    {stream.game && (
                      <View className="absolute bottom-3 left-3 right-3 bg-black/60 rounded-xl px-3 py-2">
                        <Text className="text-white font-bold text-center">
                          {stream.game.homeTeam.name} {stream.game.homeScore} -{" "}
                          {stream.game.awayScore} {stream.game.awayTeam.name}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View className="p-4">
                    <Text
                      className="text-base font-bold text-gray-900 dark:text-white"
                      numberOfLines={1}
                    >
                      {stream.title}
                    </Text>
                    <View className="flex-row items-center mt-1">
                      <Text className="text-xs text-gray-500">
                        {stream.streamerName}
                      </Text>
                      <Text className="text-xs text-gray-400 mx-1">
                        {" "}in{" "}
                      </Text>
                      <Text className="text-xs text-primary-600 font-medium">
                        {stream.clubName}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Card>
              <View className="items-center py-12">
                <View className="w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full items-center justify-center mb-4">
                  <Ionicons
                    name="videocam-off-outline"
                    size={44}
                    color="#D1D5DB"
                  />
                </View>
                <Text className="text-lg font-bold text-gray-500 dark:text-gray-400">
                  No Live Streams
                </Text>
                <Text className="text-sm text-gray-400 text-center mt-1">
                  There are no active streams right now.{"\n"}Check back
                  during game time!
                </Text>
                {canStream && (
                  <View className="mt-4">
                    <Button
                      onPress={() => {}}
                      variant="primary"
                      size="md"
                      iconLeft="videocam-outline"
                    >
                      Start Streaming
                    </Button>
                  </View>
                )}
              </View>
            </Card>
          )}
        </View>

        {/* Live Games without streams */}
        {hasLiveGames && (
          <View className="mt-6 px-6">
            <Text className="text-lg font-bold text-gray-900 dark:text-white mb-3">
              Live Games
            </Text>
            <View className="gap-3">
              {liveGames.map((game) => (
                <LiveGameCard key={game.id} game={game} />
              ))}
            </View>
          </View>
        )}

        {/* Upcoming Streams */}
        <View className="mt-6 px-6">
          <Text className="text-lg font-bold text-gray-900 dark:text-white mb-3">
            Upcoming Streams
          </Text>

          {isLoadingUpcoming ? (
            <View className="py-8 items-center">
              <ActivityIndicator size="small" color="#4F46E5" />
            </View>
          ) : upcomingStreams && upcomingStreams.length > 0 ? (
            <View className="gap-3">
              {upcomingStreams.map((stream) => (
                <Card key={stream.id}>
                  <View className="flex-row items-center">
                    <View className="w-12 h-12 bg-primary-100 dark:bg-primary-900 rounded-xl items-center justify-center mr-3">
                      <Ionicons
                        name="time-outline"
                        size={24}
                        color="#4F46E5"
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-bold text-gray-900 dark:text-white">
                        {stream.title}
                      </Text>
                      <Text className="text-xs text-gray-500 mt-0.5">
                        {stream.clubName}
                      </Text>
                    </View>
                    <Badge variant="info" size="sm">
                      Upcoming
                    </Badge>
                  </View>
                </Card>
              ))}
            </View>
          ) : (
            <Card>
              <View className="items-center py-6">
                <Ionicons name="time-outline" size={36} color="#D1D5DB" />
                <Text className="text-sm text-gray-400 mt-2 text-center">
                  No upcoming streams scheduled
                </Text>
              </View>
            </Card>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
