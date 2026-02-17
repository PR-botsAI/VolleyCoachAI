import React from "react";
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps {
  onPress: () => void;
  children: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  iconLeft?: keyof typeof Ionicons.glyphMap;
  iconRight?: keyof typeof Ionicons.glyphMap;
  fullWidth?: boolean;
  className?: string;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-primary-600 active:bg-primary-700",
  secondary: "bg-secondary-500 active:bg-secondary-600",
  outline: "bg-transparent border-2 border-primary-600 active:bg-primary-50",
  ghost: "bg-transparent active:bg-gray-100",
  danger: "bg-danger-500 active:bg-danger-600",
};

const variantTextClasses: Record<ButtonVariant, string> = {
  primary: "text-white",
  secondary: "text-white",
  outline: "text-primary-600",
  ghost: "text-primary-600",
  danger: "text-white",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-2 min-h-[36px]",
  md: "px-5 py-3 min-h-[44px]",
  lg: "px-7 py-4 min-h-[52px]",
};

const sizeTextClasses: Record<ButtonSize, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
};

const sizeIconMap: Record<ButtonSize, number> = {
  sm: 16,
  md: 20,
  lg: 24,
};

export function Button({
  onPress,
  children,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  iconLeft,
  iconRight,
  fullWidth = false,
  className = "",
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const iconColor =
    variant === "outline" || variant === "ghost" ? "#4F46E5" : "#FFFFFF";

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      className={`
        flex-row items-center justify-center rounded-xl
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${fullWidth ? "w-full" : ""}
        ${isDisabled ? "opacity-50" : ""}
        ${className}
      `}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={iconColor}
          className="mr-2"
        />
      ) : iconLeft ? (
        <View className="mr-2">
          <Ionicons
            name={iconLeft}
            size={sizeIconMap[size]}
            color={iconColor}
          />
        </View>
      ) : null}

      <Text
        className={`
          font-semibold text-center
          ${variantTextClasses[variant]}
          ${sizeTextClasses[size]}
        `}
      >
        {children}
      </Text>

      {iconRight && !loading ? (
        <View className="ml-2">
          <Ionicons
            name={iconRight}
            size={sizeIconMap[size]}
            color={iconColor}
          />
        </View>
      ) : null}
    </TouchableOpacity>
  );
}
