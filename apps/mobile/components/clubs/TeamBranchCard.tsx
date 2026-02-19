import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Badge } from "../ui/Badge";
import type { TeamSummary } from "@volleycoach/shared/mobile";

interface TeamBranchCardProps {
  team: TeamSummary;
  className?: string;
}

function getAgeGroupColor(ageGroup: string): string {
  const colorMap: Record<string, string> = {
    "9U": "bg-pink-100 text-pink-700",
    "10U": "bg-purple-100 text-purple-700",
    "11U": "bg-indigo-100 text-indigo-700",
    "12U": "bg-blue-100 text-blue-700",
    "13U": "bg-cyan-100 text-cyan-700",
    "14U": "bg-teal-100 text-teal-700",
    "15U": "bg-emerald-100 text-emerald-700",
    "16U": "bg-amber-100 text-amber-700",
    "17U": "bg-orange-100 text-orange-700",
    "18U": "bg-red-100 text-red-700",
    Adult: "bg-gray-100 text-gray-700",
    Senior: "bg-slate-100 text-slate-700",
  };
  return colorMap[ageGroup] ?? "bg-gray-100 text-gray-700";
}

export function TeamBranchCard({
  team,
  className = "",
}: TeamBranchCardProps) {
  const router = useRouter();
  const ageGroupClasses = getAgeGroupColor(team.ageGroup);

  return (
    <TouchableOpacity
      onPress={() => router.push(`/team/${team.id}`)}
      activeOpacity={0.7}
      className={`
        bg-white dark:bg-gray-800 rounded-xl p-4
        border border-gray-100 dark:border-gray-700
        flex-row items-center ${className}
      `}
    >
      {/* Age group badge */}
      <View
        className={`
          w-14 h-14 rounded-xl items-center justify-center mr-3
          ${ageGroupClasses.split(" ")[0]}
        `}
      >
        <Text
          className={`text-lg font-black ${
            ageGroupClasses.split(" ")[1]
          }`}
        >
          {team.ageGroup}
        </Text>
      </View>

      {/* Team info */}
      <View className="flex-1">
        <Text className="text-base font-semibold text-gray-900 dark:text-white">
          {team.name}
        </Text>

        <View className="flex-row items-center mt-1 flex-wrap gap-x-3 gap-y-1">
          {team.headCoachName && (
            <View className="flex-row items-center">
              <Ionicons name="person-outline" size={12} color="#9CA3AF" />
              <Text className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                {team.headCoachName}
              </Text>
            </View>
          )}

          <View className="flex-row items-center">
            <Ionicons name="trophy-outline" size={12} color="#9CA3AF" />
            <Text className="text-xs text-gray-500 dark:text-gray-400 ml-1">
              {team.record.wins}W - {team.record.losses}L
            </Text>
          </View>

          <View className="flex-row items-center">
            <Ionicons name="people-outline" size={12} color="#9CA3AF" />
            <Text className="text-xs text-gray-500 dark:text-gray-400 ml-1">
              {team.playerCount} players
            </Text>
          </View>
        </View>

        {team.division && (
          <View className="mt-1.5">
            <Badge variant="default" size="sm">
              {team.division}
            </Badge>
          </View>
        )}
      </View>

      {/* Chevron */}
      <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
    </TouchableOpacity>
  );
}
