import React, { useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "../../components/ui/Badge";
import { Card } from "../../components/ui/Card";
import { TierGate } from "../../components/ui/TierGate";
import { VideoUpload } from "../../components/analysis/VideoUpload";
import { useSubscription } from "../../hooks/useSubscription";
import { useAppStore } from "../../stores/app";
import { api } from "../../services/api";
import type { FullAnalysisReport } from "@volleycoach/shared";

interface AnalysisListItem {
  id: number;
  videoId: number;
  overallScore: number | null;
  summary: string;
  analysisType: string;
  createdAt: string;
  thumbnailUrl: string | null;
  teamName: string | null;
}

export default function CoachScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    canUseAI,
    remainingAnalyses,
    isFreeTier,
    isStarterTier,
  } = useSubscription();
  const uploadProgress = useAppStore((state) => state.uploadProgress);

  const {
    data: analyses,
    isLoading,
  } = useQuery({
    queryKey: ["analyses"],
    queryFn: async () => {
      const response = await api.get<AnalysisListItem[]>("/analyses");
      return response.data ?? [];
    },
  });

  const handleUploadComplete = useCallback(
    (videoId: number, _gcsPath: string) => {
      // Invalidate the analyses list so it refreshes when the user comes back
      queryClient.invalidateQueries({ queryKey: ["analyses"] });
      // Navigate to the analysis screen to watch progress
      router.push(`/analysis/${videoId}`);
    },
    [queryClient, router]
  );

  const hasActiveUploads = Object.keys(uploadProgress).length > 0;

  const content = (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      {/* Upload card */}
      <View className="px-6 mt-4">
        <VideoUpload
          onUploadComplete={handleUploadComplete}
          disabled={!canUseAI}
        />
        {canUseAI && (
          <View className="mt-2 flex-row items-center justify-center">
            <Ionicons name="sparkles" size={14} color="#F97316" />
            <Text className="text-xs text-secondary-500 font-medium ml-1">
              {remainingAnalyses === Infinity
                ? "Unlimited analyses available"
                : `${remainingAnalyses} analyses remaining this month`}
            </Text>
          </View>
        )}
      </View>

      {/* Active uploads */}
      {hasActiveUploads && (
        <View className="px-6 mt-4">
          <Text className="text-lg font-bold text-gray-900 dark:text-white mb-3">
            Processing
          </Text>
          {Object.entries(uploadProgress).map(([videoId, progress]) => (
            <Card key={videoId} className="mb-3">
              <View className="flex-row items-center">
                <View className="w-12 h-12 bg-secondary-100 dark:bg-secondary-900 rounded-xl items-center justify-center mr-3">
                  <ActivityIndicator size="small" color="#F97316" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-bold text-gray-900 dark:text-white">
                    Analyzing Video
                  </Text>
                  <View className="flex-row items-center mt-1">
                    <View className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mr-2">
                      <View
                        className="h-full bg-secondary-500 rounded-full"
                        style={{ width: `${progress}%` }}
                      />
                    </View>
                    <Text className="text-xs font-semibold text-gray-500">
                      {progress}%
                    </Text>
                  </View>
                </View>
              </View>
            </Card>
          ))}
        </View>
      )}

      {/* Previous analyses */}
      <View className="px-6 mt-4">
        <Text className="text-lg font-bold text-gray-900 dark:text-white mb-3">
          Previous Analyses
        </Text>

        {isLoading ? (
          <View className="py-8 items-center">
            <ActivityIndicator size="small" color="#4F46E5" />
          </View>
        ) : analyses && analyses.length > 0 ? (
          <View className="gap-3">
            {analyses.map((analysis) => (
              <TouchableOpacity
                key={analysis.id}
                onPress={() =>
                  router.push(`/analysis/${analysis.id}`)
                }
                activeOpacity={0.7}
                className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700 shadow-sm"
              >
                {/* Thumbnail */}
                <View className="h-32 bg-gray-200 dark:bg-gray-700 relative">
                  {analysis.thumbnailUrl ? (
                    <Image
                      source={{ uri: analysis.thumbnailUrl }}
                      className="w-full h-full"
                      resizeMode="cover"
                    />
                  ) : (
                    <View className="w-full h-full items-center justify-center">
                      <Ionicons
                        name="film-outline"
                        size={40}
                        color="#9CA3AF"
                      />
                    </View>
                  )}

                  {/* Score overlay */}
                  {analysis.overallScore !== null && (
                    <View className="absolute top-3 right-3 bg-white dark:bg-gray-800 rounded-xl px-3 py-1.5 shadow-sm">
                      <Text className="text-lg font-black text-primary-600">
                        {analysis.overallScore}
                        <Text className="text-xs text-gray-400">/100</Text>
                      </Text>
                    </View>
                  )}
                </View>

                <View className="p-4">
                  <View className="flex-row items-center justify-between mb-1">
                    <Text className="text-sm text-gray-500">
                      {new Date(analysis.createdAt).toLocaleDateString(
                        "en-US",
                        {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        }
                      )}
                    </Text>
                    {analysis.teamName && (
                      <Badge variant="info" size="sm">
                        {analysis.teamName}
                      </Badge>
                    )}
                  </View>
                  <Text
                    className="text-sm text-gray-700 dark:text-gray-300 mt-1"
                    numberOfLines={2}
                  >
                    {analysis.summary}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <Card>
            <View className="items-center py-8">
              <Ionicons name="bulb-outline" size={48} color="#D1D5DB" />
              <Text className="text-base font-semibold text-gray-500 mt-3">
                No Analyses Yet
              </Text>
              <Text className="text-sm text-gray-400 text-center mt-1">
                Upload a game video to get AI-powered{"\n"}coaching insights
                and recommendations.
              </Text>
            </View>
          </Card>
        )}
      </View>
    </ScrollView>
  );

  // If user is on free or starter tier, gate the entire screen
  if (isFreeTier || isStarterTier) {
    return (
      <SafeAreaView
        className="flex-1 bg-gray-50 dark:bg-gray-900"
        edges={["top"]}
      >
        <View className="px-6 pt-4 pb-3">
          <Text className="text-2xl font-black text-gray-900 dark:text-white">
            AI Coach
          </Text>
        </View>
        <TierGate
          requiredTier="pro"
          featureDescription="Upload game videos and get AI-powered coaching insights, error detection, and drill recommendations."
          features={[
            "AI-powered video analysis",
            "Error detection with timestamps",
            "Personalized drill recommendations",
            "Player-level performance reports",
            "Up to 5 analyses per month",
          ]}
          className="flex-1 mx-6"
        >
          {content}
        </TierGate>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      className="flex-1 bg-gray-50 dark:bg-gray-900"
      edges={["top"]}
    >
      <View className="px-6 pt-4 pb-3 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
        <Text className="text-2xl font-black text-gray-900 dark:text-white">
          AI Coach
        </Text>
      </View>
      {content}
    </SafeAreaView>
  );
}
