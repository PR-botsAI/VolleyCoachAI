import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TextInput,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { ClubCard } from "../../../components/clubs/ClubCard";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { useSubscription } from "../../../hooks/useSubscription";
import { api } from "../../../services/api";

interface ClubListItem {
  id: number;
  name: string;
  logoUrl: string | null;
  city: string | null;
  state: string | null;
  memberCount: number;
  teamCount: number;
  isVerified: boolean;
  primaryColor: string;
}

export default function ClubsScreen() {
  const router = useRouter();
  const { canCreateClub } = useSubscription();
  const [searchQuery, setSearchQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const {
    data: myClubs,
    refetch: refetchMyClubs,
    isLoading: isLoadingMyClubs,
  } = useQuery({
    queryKey: ["clubs", "my"],
    queryFn: async () => {
      const response = await api.get<ClubListItem[]>("/clubs/my");
      return response.data ?? [];
    },
  });

  const {
    data: popularClubs,
    refetch: refetchPopular,
    isLoading: isLoadingPopular,
  } = useQuery({
    queryKey: ["clubs", "popular"],
    queryFn: async () => {
      const response = await api.get<ClubListItem[]>("/clubs/popular");
      return response.data ?? [];
    },
  });

  const {
    data: searchResults,
    isLoading: isSearching,
  } = useQuery({
    queryKey: ["clubs", "search", searchQuery],
    queryFn: async () => {
      const response = await api.get<ClubListItem[]>("/clubs/search", {
        params: { q: searchQuery },
      });
      return response.data ?? [];
    },
    enabled: searchQuery.length >= 3,
  });

  const onRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([refetchMyClubs(), refetchPopular()]);
    setIsRefreshing(false);
  };

  const isSearchActive = searchQuery.length >= 3;

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900" edges={["top"]}>
      {/* Header */}
      <View className="bg-white dark:bg-gray-800 px-6 pt-4 pb-4 border-b border-gray-100 dark:border-gray-700">
        <Text className="text-2xl font-black text-gray-900 dark:text-white mb-4">
          Clubs
        </Text>

        {/* Search bar */}
        <View className="flex-row items-center bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 overflow-hidden">
          <View className="pl-3">
            <Ionicons name="search" size={20} color="#9CA3AF" />
          </View>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search clubs by name or city..."
            placeholderTextColor="#9CA3AF"
            className="flex-1 px-3 py-3 text-base text-gray-900 dark:text-white min-h-[44px]"
          />
          {searchQuery.length > 0 && (
            <View className="pr-2">
              <Ionicons
                name="close-circle"
                size={20}
                color="#9CA3AF"
                onPress={() => setSearchQuery("")}
              />
            </View>
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
        {/* Search results */}
        {isSearchActive ? (
          <View className="px-6 mt-4">
            <Text className="text-lg font-bold text-gray-900 dark:text-white mb-3">
              Search Results
            </Text>
            {isSearching ? (
              <View className="py-12 items-center">
                <ActivityIndicator size="large" color="#4F46E5" />
                <Text className="text-sm text-gray-400 mt-3">
                  Searching clubs...
                </Text>
              </View>
            ) : searchResults && searchResults.length > 0 ? (
              <View className="gap-3">
                {searchResults.map((club) => (
                  <ClubCard key={club.id} club={club} />
                ))}
              </View>
            ) : (
              <Card>
                <View className="items-center py-8">
                  <Ionicons name="search-outline" size={48} color="#D1D5DB" />
                  <Text className="text-base font-semibold text-gray-500 mt-3">
                    No clubs found
                  </Text>
                  <Text className="text-sm text-gray-400 mt-1 text-center">
                    Try a different search term or create your own club
                  </Text>
                </View>
              </Card>
            )}
          </View>
        ) : (
          <>
            {/* My Clubs */}
            <View className="px-6 mt-4">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-lg font-bold text-gray-900 dark:text-white">
                  My Clubs
                </Text>
                {canCreateClub && (
                  <Button
                    onPress={() => {}}
                    variant="outline"
                    size="sm"
                    iconLeft="add"
                  >
                    Create Club
                  </Button>
                )}
              </View>

              {isLoadingMyClubs ? (
                <View className="py-8 items-center">
                  <ActivityIndicator size="small" color="#4F46E5" />
                </View>
              ) : myClubs && myClubs.length > 0 ? (
                <View className="gap-3">
                  {myClubs.map((club) => (
                    <ClubCard key={club.id} club={club} />
                  ))}
                </View>
              ) : (
                <Card>
                  <View className="items-center py-6">
                    <Ionicons
                      name="business-outline"
                      size={40}
                      color="#D1D5DB"
                    />
                    <Text className="text-sm text-gray-400 mt-2 text-center">
                      You haven't joined any clubs yet.{"\n"}Search or browse
                      popular clubs below.
                    </Text>
                  </View>
                </Card>
              )}
            </View>

            {/* Popular Clubs */}
            <View className="px-6 mt-6">
              <Text className="text-lg font-bold text-gray-900 dark:text-white mb-3">
                Popular Clubs
              </Text>

              {isLoadingPopular ? (
                <View className="py-8 items-center">
                  <ActivityIndicator size="small" color="#4F46E5" />
                </View>
              ) : popularClubs && popularClubs.length > 0 ? (
                <View className="gap-3">
                  {popularClubs.map((club) => (
                    <ClubCard key={club.id} club={club} />
                  ))}
                </View>
              ) : (
                <Card>
                  <View className="items-center py-6">
                    <Ionicons name="globe-outline" size={40} color="#D1D5DB" />
                    <Text className="text-sm text-gray-400 mt-2 text-center">
                      No clubs to display yet.{"\n"}Be the first to create one!
                    </Text>
                  </View>
                </Card>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
