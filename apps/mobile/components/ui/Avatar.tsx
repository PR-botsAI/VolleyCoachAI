import React from "react";
import { View, Text, Image } from "react-native";

type AvatarSize = "sm" | "md" | "lg" | "xl";

interface AvatarProps {
  imageUrl?: string | null;
  name: string;
  size?: AvatarSize;
  showOnlineIndicator?: boolean;
  isOnline?: boolean;
  className?: string;
}

const sizeClasses: Record<AvatarSize, string> = {
  sm: "w-8 h-8",
  md: "w-10 h-10",
  lg: "w-14 h-14",
  xl: "w-20 h-20",
};

const textSizeClasses: Record<AvatarSize, string> = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-lg",
  xl: "text-2xl",
};

const indicatorSizeClasses: Record<AvatarSize, string> = {
  sm: "w-2.5 h-2.5 border-[1.5px]",
  md: "w-3 h-3 border-2",
  lg: "w-3.5 h-3.5 border-2",
  xl: "w-4 h-4 border-2",
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function getColorFromName(name: string): string {
  const colors = [
    "bg-primary-500",
    "bg-secondary-500",
    "bg-accent-500",
    "bg-success-500",
    "bg-warning-500",
    "bg-court-400",
    "bg-purple-500",
    "bg-pink-500",
    "bg-cyan-500",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function Avatar({
  imageUrl,
  name,
  size = "md",
  showOnlineIndicator = false,
  isOnline = false,
  className = "",
}: AvatarProps) {
  const initials = getInitials(name);
  const bgColor = getColorFromName(name);

  return (
    <View className={`relative ${className}`}>
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          className={`${sizeClasses[size]} rounded-full`}
          resizeMode="cover"
        />
      ) : (
        <View
          className={`
            ${sizeClasses[size]} ${bgColor}
            rounded-full items-center justify-center
          `}
        >
          <Text className={`text-white font-bold ${textSizeClasses[size]}`}>
            {initials}
          </Text>
        </View>
      )}

      {showOnlineIndicator && (
        <View
          className={`
            absolute bottom-0 right-0 rounded-full border-white
            ${indicatorSizeClasses[size]}
            ${isOnline ? "bg-success-500" : "bg-gray-400"}
          `}
        />
      )}
    </View>
  );
}
