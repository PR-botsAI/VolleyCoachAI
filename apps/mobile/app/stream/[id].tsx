import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Animated,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Avatar } from "../../components/ui/Avatar";
import { wsService } from "../../services/websocket";
import { api } from "../../services/api";
import { useAuthStore } from "../../stores/auth";
import type { LiveStreamInfo, LiveScoreUpdate } from "@volleycoach/shared";

interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  message: string;
  timestamp: string;
}

const MOCK_STREAM: LiveStreamInfo = {
  id: 1,
  title: "Metro VBC vs Coastal Club - 16U Championship",
  playbackId: null,
  status: "live",
  viewerCount: 142,
  startedAt: new Date(Date.now() - 3600000).toISOString(),
  streamerName: "Coach Dave",
  clubName: "Metro Volleyball Club",
  game: {
    id: 1,
    homeTeam: { id: 1, name: "Thunder 16U", clubName: "Metro VBC" },
    awayTeam: { id: 2, name: "Storm Elite", clubName: "Coastal Club" },
    homeScore: 2,
    awayScore: 1,
    status: "live",
    scheduledAt: new Date().toISOString(),
    venue: "Central Gym",
    isLive: true,
    hasStream: true,
  },
};

const MOCK_CHAT_MESSAGES: ChatMessage[] = [
  {
    id: "1",
    userId: "u1",
    userName: "Sarah M",
    message: "What a rally! Thunder is looking strong today",
    timestamp: new Date(Date.now() - 120000).toISOString(),
  },
  {
    id: "2",
    userId: "u2",
    userName: "Coach Tom",
    message: "Great block by #4!",
    timestamp: new Date(Date.now() - 90000).toISOString(),
  },
  {
    id: "3",
    userId: "u3",
    userName: "Mike P",
    message: "Storm needs to tighten up their serve receive",
    timestamp: new Date(Date.now() - 60000).toISOString(),
  },
  {
    id: "4",
    userId: "u4",
    userName: "Lisa K",
    message: "Go Thunder! My daughter is #7!",
    timestamp: new Date(Date.now() - 30000).toISOString(),
  },
  {
    id: "5",
    userId: "u1",
    userName: "Sarah M",
    message: "ACE! What a serve!",
    timestamp: new Date(Date.now() - 10000).toISOString(),
  },
];

function LivePulse() {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={{ opacity }}
      className="w-2.5 h-2.5 rounded-full bg-danger-500 mr-2"
    />
  );
}

function ScoreOverlay({
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
}: {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
}) {
  return (
    <View className="absolute bottom-4 left-4 right-4">
      <View className="bg-black/70 rounded-2xl px-5 py-3">
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text
              className="text-white text-sm font-semibold"
              numberOfLines={1}
            >
              {homeTeam}
            </Text>
          </View>
          <View className="flex-row items-center mx-4">
            <Text className="text-white text-2xl font-black">
              {homeScore}
            </Text>
            <Text className="text-gray-400 text-lg mx-2">-</Text>
            <Text className="text-white text-2xl font-black">
              {awayScore}
            </Text>
          </View>
          <View className="flex-1 items-end">
            <Text
              className="text-white text-sm font-semibold"
              numberOfLines={1}
            >
              {awayTeam}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const user = useAuthStore((state) => state.user);
  const isOwnMessage = message.userId === user?.id;

  return (
    <View
      className={`flex-row items-start mb-2 ${
        isOwnMessage ? "justify-end" : ""
      }`}
    >
      {!isOwnMessage && (
        <Avatar name={message.userName} size="sm" className="mr-2 mt-0.5" />
      )}
      <View
        className={`max-w-[75%] rounded-2xl px-3.5 py-2 ${
          isOwnMessage
            ? "bg-primary-600 rounded-br-sm"
            : "bg-gray-100 dark:bg-gray-700 rounded-bl-sm"
        }`}
      >
        {!isOwnMessage && (
          <Text className="text-xs font-bold text-primary-600 dark:text-primary-400 mb-0.5">
            {message.userName}
          </Text>
        )}
        <Text
          className={`text-sm ${
            isOwnMessage
              ? "text-white"
              : "text-gray-800 dark:text-gray-200"
          }`}
        >
          {message.message}
        </Text>
        <Text
          className={`text-[10px] mt-0.5 ${
            isOwnMessage ? "text-primary-200" : "text-gray-400"
          }`}
        >
          {new Date(message.timestamp).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          })}
        </Text>
      </View>
    </View>
  );
}

export default function StreamViewerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [chatMessage, setChatMessage] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(
    MOCK_CHAT_MESSAGES
  );
  const [viewerCount, setViewerCount] = useState(142);
  const [isChatExpanded, setIsChatExpanded] = useState(true);
  const chatListRef = useRef<FlatList>(null);

  const {
    data: stream,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["stream", id],
    queryFn: async () => {
      try {
        const response = await api.get<LiveStreamInfo>(`/streams/${id}`);
        return response.data;
      } catch {
        return MOCK_STREAM;
      }
    },
    enabled: !!id,
    refetchInterval: 30000,
  });

  // Join stream room for real-time updates
  useEffect(() => {
    if (!id) return;
    const streamId = parseInt(id, 10);
    wsService.joinStreamRoom(streamId);

    const unsubViewer = wsService.onViewerCount((data) => {
      if (data.streamId === streamId) {
        setViewerCount(data.count);
      }
    });

    const unsubScore = wsService.onScoreUpdate(
      (update: LiveScoreUpdate) => {
        if (stream?.game && update.gameId === stream.game.id) {
          queryClient.invalidateQueries({
            queryKey: ["stream", id],
          });
        }
      }
    );

    return () => {
      wsService.leaveStreamRoom(streamId);
      unsubViewer();
      unsubScore();
    };
  }, [id, stream?.game, queryClient]);

  const sendMessage = useCallback(() => {
    if (!chatMessage.trim() || !user) return;

    const newMessage: ChatMessage = {
      id: String(Date.now()),
      userId: user.id,
      userName: user.fullName,
      message: chatMessage.trim(),
      timestamp: new Date().toISOString(),
    };

    setChatMessages((prev) => [...prev, newMessage]);
    setChatMessage("");

    // Scroll to bottom
    setTimeout(() => {
      chatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [chatMessage, user]);

  const currentStream = stream ?? MOCK_STREAM;
  const elapsedMs = currentStream.startedAt
    ? Date.now() - new Date(currentStream.startedAt).getTime()
    : 0;
  const elapsedMinutes = Math.floor(elapsedMs / 60000);
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  const elapsedMins = elapsedMinutes % 60;

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text className="text-white text-sm mt-3">
          Loading stream...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-black" edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        {/* Video Player Area */}
        <View className="relative bg-slate-900" style={{ aspectRatio: 16 / 9 }}>
          {/* Video placeholder */}
          <View className="flex-1 items-center justify-center">
            <View className="w-24 h-24 bg-white/10 rounded-full items-center justify-center">
              <Ionicons name="play" size={48} color="#FFFFFF" />
            </View>
            <Text className="text-white/50 text-sm mt-3">
              Live stream player
            </Text>
          </View>

          {/* Top overlay - back button, live badge, viewers */}
          <View className="absolute top-0 left-0 right-0 flex-row items-center justify-between px-4 pt-3">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 bg-black/40 rounded-full items-center justify-center"
            >
              <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
            </TouchableOpacity>

            <View className="flex-row items-center gap-2">
              {/* Live badge */}
              <View className="flex-row items-center bg-danger-500 rounded-lg px-2.5 py-1">
                <LivePulse />
                <Text className="text-white text-xs font-bold">LIVE</Text>
              </View>

              {/* Viewer count */}
              <View className="flex-row items-center bg-black/50 rounded-lg px-2.5 py-1">
                <Ionicons name="eye-outline" size={14} color="#FFFFFF" />
                <Text className="text-white text-xs font-medium ml-1">
                  {viewerCount}
                </Text>
              </View>

              {/* Duration */}
              <View className="bg-black/50 rounded-lg px-2.5 py-1">
                <Text className="text-white text-xs font-mono">
                  {elapsedHours}:{elapsedMins.toString().padStart(2, "0")}:00
                </Text>
              </View>
            </View>
          </View>

          {/* Score overlay */}
          {currentStream.game && (
            <ScoreOverlay
              homeTeam={currentStream.game.homeTeam.name}
              awayTeam={currentStream.game.awayTeam.name}
              homeScore={currentStream.game.homeScore}
              awayScore={currentStream.game.awayScore}
            />
          )}
        </View>

        {/* Stream Info */}
        <View className="bg-gray-900 px-4 py-3 border-b border-gray-800">
          <Text
            className="text-white text-base font-bold"
            numberOfLines={1}
          >
            {currentStream.title}
          </Text>
          <View className="flex-row items-center mt-1.5">
            <View className="w-6 h-6 bg-primary-600 rounded-full items-center justify-center mr-2">
              <Ionicons name="person" size={12} color="#FFFFFF" />
            </View>
            <Text className="text-gray-400 text-sm">
              {currentStream.streamerName}
            </Text>
            <Text className="text-gray-600 mx-2">|</Text>
            <Text className="text-gray-400 text-sm">
              {currentStream.clubName}
            </Text>
            {currentStream.game?.venue && (
              <>
                <Text className="text-gray-600 mx-2">|</Text>
                <Ionicons
                  name="location-outline"
                  size={12}
                  color="#6B7280"
                />
                <Text className="text-gray-400 text-sm ml-1">
                  {currentStream.game.venue}
                </Text>
              </>
            )}
          </View>

          {/* Action buttons */}
          <View className="flex-row mt-3 gap-3">
            {currentStream.game && (
              <TouchableOpacity
                onPress={() =>
                  router.push(
                    `/game/${currentStream.game!.id}`
                  )
                }
                className="flex-row items-center bg-gray-800 rounded-xl px-3 py-2 min-h-[36px]"
              >
                <Ionicons
                  name="stats-chart-outline"
                  size={14}
                  color="#A5B4FC"
                />
                <Text className="text-primary-300 text-xs font-semibold ml-1.5">
                  Game Details
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity className="flex-row items-center bg-gray-800 rounded-xl px-3 py-2 min-h-[36px]">
              <Ionicons
                name="share-outline"
                size={14}
                color="#A5B4FC"
              />
              <Text className="text-primary-300 text-xs font-semibold ml-1.5">
                Share
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setIsChatExpanded(!isChatExpanded)}
              className="flex-row items-center bg-gray-800 rounded-xl px-3 py-2 min-h-[36px]"
            >
              <Ionicons
                name={
                  isChatExpanded
                    ? "chatbubbles"
                    : "chatbubbles-outline"
                }
                size={14}
                color="#A5B4FC"
              />
              <Text className="text-primary-300 text-xs font-semibold ml-1.5">
                Chat
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Live Chat */}
        {isChatExpanded && (
          <View className="flex-1 bg-gray-950">
            <View className="flex-row items-center justify-between px-4 py-2 border-b border-gray-800">
              <View className="flex-row items-center">
                <Ionicons
                  name="chatbubbles-outline"
                  size={16}
                  color="#9CA3AF"
                />
                <Text className="text-gray-400 text-sm font-semibold ml-2">
                  Live Chat
                </Text>
              </View>
              <Text className="text-gray-600 text-xs">
                {chatMessages.length} messages
              </Text>
            </View>

            <FlatList
              ref={chatListRef}
              data={chatMessages}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => <ChatBubble message={item} />}
              contentContainerStyle={{
                padding: 12,
                paddingBottom: 4,
              }}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() =>
                chatListRef.current?.scrollToEnd({ animated: false })
              }
              ListEmptyComponent={
                <View className="items-center py-8">
                  <Ionicons
                    name="chatbubble-outline"
                    size={32}
                    color="#4B5563"
                  />
                  <Text className="text-gray-600 text-sm mt-2">
                    No messages yet. Say something!
                  </Text>
                </View>
              }
            />

            {/* Chat input */}
            <View className="flex-row items-center px-3 py-2 bg-gray-900 border-t border-gray-800">
              <TextInput
                value={chatMessage}
                onChangeText={setChatMessage}
                placeholder="Send a message..."
                placeholderTextColor="#6B7280"
                className="flex-1 bg-gray-800 rounded-xl px-4 py-2.5 text-white text-sm min-h-[42px]"
                multiline={false}
                returnKeyType="send"
                onSubmitEditing={sendMessage}
              />
              <TouchableOpacity
                onPress={sendMessage}
                disabled={!chatMessage.trim()}
                className={`ml-2 w-10 h-10 rounded-xl items-center justify-center ${
                  chatMessage.trim()
                    ? "bg-primary-600"
                    : "bg-gray-800"
                }`}
              >
                <Ionicons
                  name="send"
                  size={18}
                  color={chatMessage.trim() ? "#FFFFFF" : "#6B7280"}
                />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* If chat is collapsed, show a minimal indicator */}
        {!isChatExpanded && (
          <View className="flex-1 bg-gray-950 items-center justify-center">
            <TouchableOpacity
              onPress={() => setIsChatExpanded(true)}
              className="items-center"
            >
              <Ionicons
                name="chatbubbles-outline"
                size={40}
                color="#4B5563"
              />
              <Text className="text-gray-600 text-sm mt-2">
                Tap to open live chat
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
