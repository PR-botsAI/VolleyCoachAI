import React, { useState } from "react";
import { View, TextInput, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface InputProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  iconLeft?: keyof typeof Ionicons.glyphMap;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address" | "numeric" | "phone-pad";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoComplete?:
    | "email"
    | "password"
    | "name"
    | "off"
    | "username"
    | "tel";
  multiline?: boolean;
  numberOfLines?: number;
  maxLength?: number;
  editable?: boolean;
  className?: string;
  onBlur?: () => void;
  onFocus?: () => void;
}

export function Input({
  label,
  placeholder,
  value,
  onChangeText,
  error,
  iconLeft,
  secureTextEntry = false,
  keyboardType = "default",
  autoCapitalize = "none",
  autoComplete = "off",
  multiline = false,
  numberOfLines = 1,
  maxLength,
  editable = true,
  className = "",
  onBlur,
  onFocus,
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const handleFocus = () => {
    setIsFocused(true);
    onFocus?.();
  };

  const handleBlur = () => {
    setIsFocused(false);
    onBlur?.();
  };

  return (
    <View className={`mb-4 ${className}`}>
      {label && (
        <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          {label}
        </Text>
      )}

      <View
        className={`
          flex-row items-center bg-gray-50 dark:bg-gray-800
          rounded-xl border-2 overflow-hidden
          ${
            error
              ? "border-danger-500"
              : isFocused
              ? "border-primary-500"
              : "border-gray-200 dark:border-gray-600"
          }
          ${!editable ? "opacity-60" : ""}
        `}
      >
        {iconLeft && (
          <View className="pl-3">
            <Ionicons
              name={iconLeft}
              size={20}
              color={error ? "#EF4444" : isFocused ? "#4F46E5" : "#9CA3AF"}
            />
          </View>
        )}

        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          secureTextEntry={secureTextEntry && !isPasswordVisible}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          multiline={multiline}
          numberOfLines={numberOfLines}
          maxLength={maxLength}
          editable={editable}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className={`
            flex-1 px-3 py-3 text-base min-h-[44px]
            text-gray-900 dark:text-white
            ${multiline ? "text-top" : ""}
          `}
        />

        {secureTextEntry && (
          <TouchableOpacity
            onPress={() => setIsPasswordVisible(!isPasswordVisible)}
            className="pr-3 min-h-[44px] min-w-[44px] items-center justify-center"
          >
            <Ionicons
              name={isPasswordVisible ? "eye-off-outline" : "eye-outline"}
              size={20}
              color="#9CA3AF"
            />
          </TouchableOpacity>
        )}
      </View>

      {error && (
        <View className="flex-row items-center mt-1.5">
          <Ionicons name="alert-circle" size={14} color="#EF4444" />
          <Text className="text-sm text-danger-500 ml-1">{error}</Text>
        </View>
      )}
    </View>
  );
}
