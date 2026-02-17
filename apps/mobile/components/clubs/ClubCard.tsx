import React from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

interface ClubCardData {
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

interface ClubCardProps {
  club: ClubCardData;
  className?: string;
}

export function ClubCard({ club, className = "" }: ClubCardProps) {
  const router = useRouter();

  return (
    <TouchableOpacity
      onPress={() => router.push(`/club/${club.id}`)}
      activeOpacity={0.7}
      className={`
        bg-white dark:bg-gray-800 rounded-2xl overflow-hidden
        border border-gray-100 dark:border-gray-700
        shadow-sm ${className}
      `}
    >
      {/* Color accent strip */}
      <View
        className="h-1.5 w-full"
        style={{ backgroundColor: club.primaryColor }}
      />

      <View className="p-4 flex-row items-center">
        {/* Logo */}
        <View className="mr-3">
          {club.logoUrl ? (
            <Image
              source={{ uri: club.logoUrl }}
              className="w-14 h-14 rounded-xl"
              resizeMode="cover"
            />
          ) : (
            <View
              className="w-14 h-14 rounded-xl items-center justify-center"
              style={{ backgroundColor: club.primaryColor + "20" }}
            >
              <Ionicons
                name="shield"
                size={28}
                color={club.primaryColor}
              />
            </View>
          )}
        </View>

        {/* Info */}
        <View className="flex-1">
          <View className="flex-row items-center">
            <Text
              className="text-base font-bold text-gray-900 dark:text-white"
              numberOfLines={1}
            >
              {club.name}
            </Text>
            {club.isVerified && (
              <Ionicons
                name="checkmark-circle"
                size={16}
                color="#4F46E5"
                style={{ marginLeft: 4 }}
              />
            )}
          </View>

          {(club.city || club.state) && (
            <View className="flex-row items-center mt-0.5">
              <Ionicons name="location-outline" size={12} color="#9CA3AF" />
              <Text className="text-xs text-gray-500 dark:text-gray-400 ml-0.5">
                {[club.city, club.state].filter(Boolean).join(", ")}
              </Text>
            </View>
          )}

          <View className="flex-row items-center mt-2 gap-4">
            <View className="flex-row items-center">
              <Ionicons name="people-outline" size={13} color="#6B7280" />
              <Text className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                {club.memberCount} members
              </Text>
            </View>
            <View className="flex-row items-center">
              <Ionicons name="shirt-outline" size={13} color="#6B7280" />
              <Text className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                {club.teamCount} teams
              </Text>
            </View>
          </View>
        </View>

        {/* Chevron */}
        <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
      </View>
    </TouchableOpacity>
  );
}
