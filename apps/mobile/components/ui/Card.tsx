import React from "react";
import { View, TouchableOpacity, Text } from "react-native";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  onPress?: () => void;
  noPadding?: boolean;
}

export function Card({
  children,
  className = "",
  header,
  footer,
  onPress,
  noPadding = false,
}: CardProps) {
  const content = (
    <View
      className={`
        bg-white dark:bg-gray-800 rounded-2xl
        shadow-sm border border-gray-100 dark:border-gray-700
        overflow-hidden
        ${className}
      `}
    >
      {header && (
        <View className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          {typeof header === "string" ? (
            <Text className="text-base font-semibold text-gray-900 dark:text-white">
              {header}
            </Text>
          ) : (
            header
          )}
        </View>
      )}

      <View className={noPadding ? "" : "p-4"}>{children}</View>

      {footer && (
        <View className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          {typeof footer === "string" ? (
            <Text className="text-sm text-gray-500 dark:text-gray-400">
              {footer}
            </Text>
          ) : (
            footer
          )}
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        className="w-full"
      >
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}
