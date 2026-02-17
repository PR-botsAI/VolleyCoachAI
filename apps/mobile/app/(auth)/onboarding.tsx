import React, { useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useMutation } from "@tanstack/react-query";
import { Button } from "../../components/ui/Button";
import { useAuthStore } from "../../stores/auth";
import { api } from "../../services/api";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type UserRole = "player" | "coach" | "parent" | "club_admin";

interface RoleDetail {
  key: UserRole;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
  color: string;
}

const roles: RoleDetail[] = [
  {
    key: "player",
    label: "Player",
    icon: "person",
    description:
      "Track your stats, view game schedules, and get AI-powered coaching to improve your skills.",
    color: "#4F46E5",
  },
  {
    key: "coach",
    label: "Coach",
    icon: "clipboard",
    description:
      "Manage your teams, run live scoring, analyze game footage with AI, and track player development.",
    color: "#F97316",
  },
  {
    key: "parent",
    label: "Parent",
    icon: "heart",
    description:
      "Follow your child's games, watch live streams, and stay updated with team schedules and events.",
    color: "#14B8A6",
  },
  {
    key: "club_admin",
    label: "Club Admin",
    icon: "shield",
    description:
      "Run your entire club: manage multiple teams, handle rosters, organize tournaments, and more.",
    color: "#10B981",
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [clubSearch, setClubSearch] = useState("");

  const user = useAuthStore((state) => state.user);
  const updateProfile = useAuthStore((state) => state.updateProfile);

  const completeOnboarding = useMutation({
    mutationFn: async () => {
      const response = await api.post<{ success: boolean }>(
        "/auth/onboarding/complete",
        {
          role: selectedRole ?? user?.role,
        }
      );
      return response;
    },
    onSuccess: () => {
      updateProfile({ onboardingDone: true });
      router.replace("/(tabs)/home");
    },
  });

  const goToPage = (page: number) => {
    scrollRef.current?.scrollTo({ x: page * SCREEN_WIDTH, animated: true });
    setCurrentPage(page);
  };

  const handleNext = () => {
    if (currentPage < 2) {
      goToPage(currentPage + 1);
    } else {
      completeOnboarding.mutate();
    }
  };

  const handleBack = () => {
    if (currentPage > 0) {
      goToPage(currentPage - 1);
    }
  };

  const handleSkip = () => {
    completeOnboarding.mutate();
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
      {/* Skip button */}
      <View className="flex-row justify-end px-6 pt-2">
        <TouchableOpacity
          onPress={handleSkip}
          className="min-h-[44px] min-w-[44px] items-center justify-center"
        >
          <Text className="text-sm font-medium text-gray-400">Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Pages */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        className="flex-1"
      >
        {/* Page 1: Welcome */}
        <View
          style={{ width: SCREEN_WIDTH }}
          className="flex-1 px-8 justify-center"
        >
          <View className="items-center">
            {/* Illustration placeholder */}
            <View className="w-48 h-48 bg-primary-100 dark:bg-primary-900 rounded-full items-center justify-center mb-8">
              <Ionicons name="tennisball" size={80} color="#4F46E5" />
            </View>

            <Text className="text-3xl font-black text-gray-900 dark:text-white text-center mb-3">
              Welcome to{"\n"}VolleyCoach
            </Text>

            <Text className="text-base text-gray-500 dark:text-gray-400 text-center leading-6 px-4">
              Your all-in-one platform for volleyball club management, live
              scoring, streaming, and AI-powered coaching.
            </Text>

            <View className="mt-8 w-full gap-3">
              {[
                {
                  icon: "trophy-outline" as const,
                  text: "Live scoring and real-time updates",
                },
                {
                  icon: "videocam-outline" as const,
                  text: "Stream and watch games anywhere",
                },
                {
                  icon: "bulb-outline" as const,
                  text: "AI analysis to improve your game",
                },
              ].map((item, index) => (
                <View
                  key={index}
                  className="flex-row items-center bg-gray-50 dark:bg-gray-800 rounded-xl p-3"
                >
                  <View className="w-10 h-10 bg-primary-100 dark:bg-primary-900 rounded-full items-center justify-center mr-3">
                    <Ionicons name={item.icon} size={20} color="#4F46E5" />
                  </View>
                  <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 flex-1">
                    {item.text}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Page 2: Role selection */}
        <View
          style={{ width: SCREEN_WIDTH }}
          className="flex-1 px-8 justify-center"
        >
          <View className="items-center">
            <Text className="text-2xl font-black text-gray-900 dark:text-white text-center mb-2">
              Choose Your Role
            </Text>
            <Text className="text-base text-gray-500 dark:text-gray-400 text-center mb-8">
              This helps us personalize your experience
            </Text>

            <View className="w-full gap-3">
              {roles.map((role) => (
                <TouchableOpacity
                  key={role.key}
                  onPress={() => setSelectedRole(role.key)}
                  activeOpacity={0.7}
                  className={`
                    flex-row items-center p-4 rounded-2xl border-2
                    ${
                      selectedRole === role.key
                        ? "border-primary-500 bg-primary-50 dark:bg-primary-900/30"
                        : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                    }
                  `}
                >
                  <View
                    className="w-14 h-14 rounded-2xl items-center justify-center mr-4"
                    style={{
                      backgroundColor:
                        selectedRole === role.key
                          ? role.color + "20"
                          : "#F3F4F6",
                    }}
                  >
                    <Ionicons
                      name={role.icon}
                      size={28}
                      color={
                        selectedRole === role.key ? role.color : "#9CA3AF"
                      }
                    />
                  </View>
                  <View className="flex-1">
                    <Text
                      className={`
                        text-base font-bold
                        ${
                          selectedRole === role.key
                            ? "text-primary-700 dark:text-primary-300"
                            : "text-gray-900 dark:text-white"
                        }
                      `}
                    >
                      {role.label}
                    </Text>
                    <Text className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {role.description}
                    </Text>
                  </View>
                  {selectedRole === role.key && (
                    <Ionicons
                      name="checkmark-circle"
                      size={24}
                      color="#4F46E5"
                    />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Page 3: Join or create a club */}
        <View
          style={{ width: SCREEN_WIDTH }}
          className="flex-1 px-8 justify-center"
        >
          <View className="items-center">
            <View className="w-24 h-24 bg-accent-100 dark:bg-accent-900 rounded-full items-center justify-center mb-6">
              <Ionicons name="search" size={44} color="#14B8A6" />
            </View>

            <Text className="text-2xl font-black text-gray-900 dark:text-white text-center mb-2">
              Join or Create a Club
            </Text>
            <Text className="text-base text-gray-500 dark:text-gray-400 text-center mb-8">
              Find your club or start a new one
            </Text>

            {/* Search bar */}
            <View className="w-full flex-row items-center bg-gray-50 dark:bg-gray-800 rounded-xl border-2 border-gray-200 dark:border-gray-700 mb-4 overflow-hidden">
              <View className="pl-3">
                <Ionicons name="search" size={20} color="#9CA3AF" />
              </View>
              <TextInput
                value={clubSearch}
                onChangeText={setClubSearch}
                placeholder="Search for a club..."
                placeholderTextColor="#9CA3AF"
                className="flex-1 px-3 py-3 text-base text-gray-900 dark:text-white min-h-[44px]"
              />
            </View>

            {/* Empty search state */}
            {!clubSearch && (
              <View className="w-full items-center py-8">
                <Ionicons name="people-outline" size={48} color="#D1D5DB" />
                <Text className="text-sm text-gray-400 mt-3 text-center">
                  Search for your club or team name
                </Text>
              </View>
            )}

            {/* Search hint */}
            {clubSearch.length > 0 && clubSearch.length < 3 && (
              <View className="w-full items-center py-8">
                <Text className="text-sm text-gray-400 text-center">
                  Type at least 3 characters to search
                </Text>
              </View>
            )}

            {/* Create club option */}
            <View className="w-full mt-4">
              <TouchableOpacity
                className="flex-row items-center p-4 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600"
                activeOpacity={0.7}
              >
                <View className="w-12 h-12 bg-secondary-100 dark:bg-secondary-900 rounded-xl items-center justify-center mr-3">
                  <Ionicons name="add" size={24} color="#F97316" />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-bold text-gray-900 dark:text-white">
                    Create a New Club
                  </Text>
                  <Text className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Start your own volleyball club (requires Starter plan)
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            <Text className="text-xs text-gray-400 mt-4 text-center">
              You can always join or create clubs later
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom navigation */}
      <View className="px-8 pb-6">
        {/* Progress dots */}
        <View className="flex-row items-center justify-center mb-6 gap-2">
          {[0, 1, 2].map((index) => (
            <View
              key={index}
              className={`
                h-2 rounded-full transition-all
                ${
                  index === currentPage
                    ? "w-8 bg-primary-600"
                    : "w-2 bg-gray-300 dark:bg-gray-600"
                }
              `}
            />
          ))}
        </View>

        {/* Navigation buttons */}
        <View className="flex-row gap-3">
          {currentPage > 0 && (
            <Button
              onPress={handleBack}
              variant="outline"
              size="lg"
              iconLeft="arrow-back"
            >
              Back
            </Button>
          )}

          <View className="flex-1">
            <Button
              onPress={handleNext}
              variant="primary"
              size="lg"
              fullWidth
              loading={completeOnboarding.isPending}
              iconRight={currentPage < 2 ? "arrow-forward" : "checkmark"}
            >
              {currentPage < 2 ? "Next" : "Get Started"}
            </Button>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
