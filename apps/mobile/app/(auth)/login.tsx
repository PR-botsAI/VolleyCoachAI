import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from "react-native";
import { Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { useAuth } from "../../hooks/useAuth";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {}
  );

  const { loginWithEmail, isLoginLoading, loginError } = useAuth();

  const validate = (): boolean => {
    const newErrors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = "Invalid email address";
    }

    if (!password) {
      newErrors.password = "Password is required";
    } else if (password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = () => {
    if (validate()) {
      loginWithEmail({ email: email.trim(), password });
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          className="flex-1"
        >
          {/* Gradient header */}
          <View className="bg-primary-600 pt-8 pb-16 px-6 rounded-b-[40px]">
            <View className="items-center">
              {/* Logo */}
              <View className="w-20 h-20 bg-white/20 rounded-2xl items-center justify-center mb-4">
                <Ionicons name="tennisball" size={44} color="#FFFFFF" />
              </View>
              <Text className="text-white text-3xl font-black tracking-tight">
                VolleyCoach
              </Text>
              <Text className="text-primary-200 text-base mt-1">
                Your volleyball command center
              </Text>
            </View>
          </View>

          {/* Form */}
          <View className="px-6 -mt-8">
            <View className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-gray-700">
              <Text className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                Welcome Back
              </Text>

              {loginError && (
                <View className="bg-danger-50 dark:bg-danger-900 border border-danger-200 dark:border-danger-700 rounded-xl p-3 mb-4 flex-row items-center">
                  <Ionicons name="alert-circle" size={18} color="#EF4444" />
                  <Text className="text-sm text-danger-700 dark:text-danger-300 ml-2 flex-1">
                    {loginError}
                  </Text>
                </View>
              )}

              <Input
                label="Email"
                placeholder="you@example.com"
                value={email}
                onChangeText={setEmail}
                error={errors.email}
                iconLeft="mail-outline"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />

              <Input
                label="Password"
                placeholder="Enter your password"
                value={password}
                onChangeText={setPassword}
                error={errors.password}
                iconLeft="lock-closed-outline"
                secureTextEntry
                autoComplete="password"
              />

              <TouchableOpacity className="self-end mb-4">
                <Text className="text-sm font-medium text-primary-600">
                  Forgot password?
                </Text>
              </TouchableOpacity>

              <Button
                onPress={handleLogin}
                variant="primary"
                size="lg"
                fullWidth
                loading={isLoginLoading}
              >
                Sign In
              </Button>
            </View>

            {/* Divider */}
            <View className="flex-row items-center my-6 px-4">
              <View className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
              <Text className="text-sm text-gray-400 mx-4">
                or continue with
              </Text>
              <View className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
            </View>

            {/* Social login */}
            <View className="flex-row gap-4 px-4">
              <TouchableOpacity
                className="flex-1 flex-row items-center justify-center bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl py-3 min-h-[48px]"
                activeOpacity={0.7}
              >
                <Ionicons name="logo-google" size={20} color="#DB4437" />
                <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-2">
                  Google
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-1 flex-row items-center justify-center bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl py-3 min-h-[48px]"
                activeOpacity={0.7}
              >
                <Ionicons name="logo-apple" size={20} color="#000000" />
                <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-2">
                  Apple
                </Text>
              </TouchableOpacity>
            </View>

            {/* Sign up link */}
            <View className="flex-row items-center justify-center mt-8 mb-6">
              <Text className="text-sm text-gray-500 dark:text-gray-400">
                Don't have an account?{" "}
              </Text>
              <Link href="/(auth)/register" asChild>
                <TouchableOpacity>
                  <Text className="text-sm font-bold text-primary-600">
                    Create Account
                  </Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
