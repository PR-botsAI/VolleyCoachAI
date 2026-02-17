import React, { useEffect, useRef } from "react";
import { View, Text, Animated } from "react-native";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "live" | "info";
type BadgeSize = "sm" | "md" | "lg";

interface BadgeProps {
  children: string;
  variant?: BadgeVariant;
  size?: BadgeSize;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-gray-100 dark:bg-gray-700",
  success: "bg-success-100 dark:bg-success-900",
  warning: "bg-warning-100 dark:bg-warning-900",
  danger: "bg-danger-100 dark:bg-danger-900",
  live: "bg-danger-500",
  info: "bg-primary-100 dark:bg-primary-900",
};

const variantTextClasses: Record<BadgeVariant, string> = {
  default: "text-gray-700 dark:text-gray-300",
  success: "text-success-700 dark:text-success-300",
  warning: "text-warning-700 dark:text-warning-300",
  danger: "text-danger-700 dark:text-danger-300",
  live: "text-white",
  info: "text-primary-700 dark:text-primary-300",
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: "px-1.5 py-0.5",
  md: "px-2.5 py-1",
  lg: "px-3 py-1.5",
};

const sizeTextClasses: Record<BadgeSize, string> = {
  sm: "text-xs",
  md: "text-xs",
  lg: "text-sm",
};

function LiveDot() {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
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
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={{ opacity }}
      className="w-2 h-2 rounded-full bg-white mr-1.5"
    />
  );
}

export function Badge({
  children,
  variant = "default",
  size = "md",
  className = "",
}: BadgeProps) {
  return (
    <View
      className={`
        flex-row items-center rounded-full self-start
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
    >
      {variant === "live" && <LiveDot />}
      <Text
        className={`
          font-bold uppercase tracking-wider
          ${variantTextClasses[variant]}
          ${sizeTextClasses[size]}
        `}
      >
        {children}
      </Text>
    </View>
  );
}
