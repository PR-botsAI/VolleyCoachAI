import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { useAuthStore } from "../stores/auth";
import { wsService } from "../services/websocket";
import "../global.css";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      gcTime: 1000 * 60 * 10,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

function ErrorFallback({
  error,
  onReset,
}: {
  error: Error;
  onReset: () => void;
}) {
  return (
    <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900 px-6">
      <View className="w-16 h-16 rounded-full bg-danger-100 items-center justify-center mb-4">
        <Text className="text-3xl">!</Text>
      </View>
      <Text className="text-xl font-bold text-gray-900 dark:text-white text-center mb-2">
        Something went wrong
      </Text>
      <Text className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">
        {error.message}
      </Text>
      <View className="bg-primary-600 rounded-xl px-6 py-3">
        <Text
          className="text-white font-semibold text-base"
          onPress={onReset}
        >
          Try Again
        </Text>
      </View>
    </View>
  );
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const user = useAuthStore((state) => state.user);
  const firebaseIdToken = useAuthStore((state) => state.firebaseIdToken);
  const isHydrated = useAuthStore((state) => state.isHydrated);

  useEffect(() => {
    if (!isHydrated) return;

    const isAuthenticated = user !== null && firebaseIdToken !== null;
    const inAuthGroup = segments[0] === "(auth)";

    if (!isAuthenticated && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (isAuthenticated && inAuthGroup) {
      if (user && !user.onboardingDone) {
        router.replace("/(auth)/onboarding");
      } else {
        router.replace("/(tabs)/home");
      }
    }
  }, [user, firebaseIdToken, isHydrated, segments]);

  useEffect(() => {
    if (user && firebaseIdToken) {
      wsService.connect();
    }
    return () => {
      wsService.disconnect();
    };
  }, [user, firebaseIdToken]);

  return <>{children}</>;
}

export default function RootLayout() {
  const [appError, setAppError] = useState<Error | null>(null);
  const isHydrated = useAuthStore((state) => state.isHydrated);

  const [fontsLoaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  useEffect(() => {
    if (isHydrated && fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [isHydrated, fontsLoaded]);

  if (appError) {
    return (
      <ErrorFallback error={appError} onReset={() => setAppError(null)} />
    );
  }

  if (!isHydrated || !fontsLoaded) {
    return (
      <View className="flex-1 items-center justify-center bg-primary-600">
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text className="text-white text-lg font-semibold mt-4">
          VolleyCoach
        </Text>
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <AuthGuard>
          <Stack
            screenOptions={{
              headerShown: false,
              animation: "slide_from_right",
              contentStyle: {
                backgroundColor: "#FFFFFF",
              },
            }}
          >
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="club/[id]"
              options={{
                headerShown: true,
                headerTitle: "",
                headerTransparent: true,
                headerTintColor: "#FFFFFF",
              }}
            />
            <Stack.Screen
              name="team/[id]"
              options={{
                headerShown: true,
                headerTitle: "",
                headerBackTitle: "Back",
                headerTintColor: "#4F46E5",
              }}
            />
            <Stack.Screen
              name="game/[id]"
              options={{
                headerShown: true,
                headerTitle: "Game",
                headerBackTitle: "Back",
                headerTintColor: "#4F46E5",
              }}
            />
            <Stack.Screen
              name="coach/index"
              options={{
                headerShown: true,
                headerTitle: "AI Coach",
                headerBackTitle: "Back",
                headerTintColor: "#4F46E5",
              }}
            />
            <Stack.Screen
              name="analysis/[id]"
              options={{
                headerShown: true,
                headerTitle: "Analysis",
                headerBackTitle: "Back",
                headerTintColor: "#4F46E5",
              }}
            />
            <Stack.Screen
              name="player/[id]"
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="stream/[id]"
              options={{
                headerShown: false,
                animation: "slide_from_bottom",
              }}
            />
          </Stack>
        </AuthGuard>
        <StatusBar style="auto" />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
