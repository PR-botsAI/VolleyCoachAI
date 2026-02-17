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

type UserRole = "player" | "coach" | "parent" | "club_admin";

interface RoleOption {
  key: UserRole;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
}

const roleOptions: RoleOption[] = [
  {
    key: "player",
    label: "Player",
    icon: "person",
    description: "Track your stats and games",
  },
  {
    key: "coach",
    label: "Coach",
    icon: "clipboard",
    description: "Manage teams and analyze play",
  },
  {
    key: "parent",
    label: "Parent",
    icon: "heart",
    description: "Follow your child's journey",
  },
  {
    key: "club_admin",
    label: "Club Admin",
    icon: "shield",
    description: "Run your volleyball club",
  },
];

export default function RegisterScreen() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { registerWithEmail, isRegisterLoading, registerError } = useAuth();

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!fullName.trim()) {
      newErrors.fullName = "Full name is required";
    } else if (fullName.trim().length < 2) {
      newErrors.fullName = "Name must be at least 2 characters";
    }

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

    if (!selectedRole) {
      newErrors.role = "Please select a role";
    }

    if (!agreedToTerms) {
      newErrors.terms = "You must agree to the terms of service";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = () => {
    if (validate() && selectedRole) {
      registerWithEmail({
        email: email.trim(),
        fullName: fullName.trim(),
        password,
        role: selectedRole,
      });
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          className="flex-1"
        >
          {/* Header */}
          <View className="bg-primary-600 pt-6 pb-12 px-6 rounded-b-[40px]">
            <View className="flex-row items-center mb-4">
              <Link href="/(auth)/login" asChild>
                <TouchableOpacity className="min-w-[44px] min-h-[44px] items-center justify-center">
                  <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </Link>
            </View>
            <Text className="text-white text-2xl font-black">
              Create Account
            </Text>
            <Text className="text-primary-200 text-base mt-1">
              Join the volleyball community
            </Text>
          </View>

          <View className="px-6 -mt-6">
            <View className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-gray-700">
              {registerError && (
                <View className="bg-danger-50 dark:bg-danger-900 border border-danger-200 dark:border-danger-700 rounded-xl p-3 mb-4 flex-row items-center">
                  <Ionicons name="alert-circle" size={18} color="#EF4444" />
                  <Text className="text-sm text-danger-700 dark:text-danger-300 ml-2 flex-1">
                    {registerError}
                  </Text>
                </View>
              )}

              <Input
                label="Full Name"
                placeholder="John Smith"
                value={fullName}
                onChangeText={setFullName}
                error={errors.fullName}
                iconLeft="person-outline"
                autoCapitalize="words"
                autoComplete="name"
              />

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
                placeholder="At least 8 characters"
                value={password}
                onChangeText={setPassword}
                error={errors.password}
                iconLeft="lock-closed-outline"
                secureTextEntry
                autoComplete="password"
              />

              {/* Role selection */}
              <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                I am a...
              </Text>

              {errors.role && (
                <View className="flex-row items-center mb-2">
                  <Ionicons name="alert-circle" size={14} color="#EF4444" />
                  <Text className="text-sm text-danger-500 ml-1">
                    {errors.role}
                  </Text>
                </View>
              )}

              <View className="flex-row flex-wrap gap-3 mb-5">
                {roleOptions.map((role) => (
                  <TouchableOpacity
                    key={role.key}
                    onPress={() => setSelectedRole(role.key)}
                    activeOpacity={0.7}
                    className={`
                      flex-1 min-w-[140px] p-3 rounded-xl border-2 items-center
                      ${
                        selectedRole === role.key
                          ? "border-primary-500 bg-primary-50 dark:bg-primary-900/30"
                          : "border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800"
                      }
                    `}
                  >
                    <View
                      className={`
                        w-10 h-10 rounded-full items-center justify-center mb-2
                        ${
                          selectedRole === role.key
                            ? "bg-primary-100 dark:bg-primary-800"
                            : "bg-gray-100 dark:bg-gray-700"
                        }
                      `}
                    >
                      <Ionicons
                        name={role.icon}
                        size={20}
                        color={
                          selectedRole === role.key ? "#4F46E5" : "#9CA3AF"
                        }
                      />
                    </View>
                    <Text
                      className={`
                        text-sm font-semibold text-center
                        ${
                          selectedRole === role.key
                            ? "text-primary-700 dark:text-primary-300"
                            : "text-gray-700 dark:text-gray-300"
                        }
                      `}
                    >
                      {role.label}
                    </Text>
                    <Text className="text-[10px] text-gray-400 text-center mt-0.5">
                      {role.description}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Terms checkbox */}
              <TouchableOpacity
                onPress={() => setAgreedToTerms(!agreedToTerms)}
                className="flex-row items-start mb-6"
                activeOpacity={0.7}
              >
                <View
                  className={`
                    w-5 h-5 rounded border-2 items-center justify-center mt-0.5 mr-3
                    ${
                      agreedToTerms
                        ? "bg-primary-600 border-primary-600"
                        : "border-gray-300 dark:border-gray-600"
                    }
                  `}
                >
                  {agreedToTerms && (
                    <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                  )}
                </View>
                <Text className="text-sm text-gray-600 dark:text-gray-400 flex-1">
                  I agree to the{" "}
                  <Text className="text-primary-600 font-medium">
                    Terms of Service
                  </Text>{" "}
                  and{" "}
                  <Text className="text-primary-600 font-medium">
                    Privacy Policy
                  </Text>
                </Text>
              </TouchableOpacity>

              {errors.terms && (
                <View className="flex-row items-center mb-4 -mt-4">
                  <Ionicons name="alert-circle" size={14} color="#EF4444" />
                  <Text className="text-sm text-danger-500 ml-1">
                    {errors.terms}
                  </Text>
                </View>
              )}

              <Button
                onPress={handleRegister}
                variant="primary"
                size="lg"
                fullWidth
                loading={isRegisterLoading}
              >
                Create Account
              </Button>
            </View>

            {/* Login link */}
            <View className="flex-row items-center justify-center mt-6">
              <Text className="text-sm text-gray-500 dark:text-gray-400">
                Already have an account?{" "}
              </Text>
              <Link href="/(auth)/login" asChild>
                <TouchableOpacity>
                  <Text className="text-sm font-bold text-primary-600">
                    Sign In
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
