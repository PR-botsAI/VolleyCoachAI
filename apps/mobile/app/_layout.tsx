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

function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const user = useAuthStore((s) => s.user);
  const firebaseIdToken = useAuthStore((s) => s.firebaseIdToken);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // Wait for navigation to be ready after first render
    const timer = setTimeout(() => setIsMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isMounted || !isHydrated) return;

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
  }, [isMounted, isHydrated, user, firebaseIdToken, segments]);

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
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const setHydrated = useAuthStore((state) => state.setHydrated);
  const setLoading = useAuthStore((state) => state.setLoading);

  const [fontsLoaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  // Fallback: if hydration doesn't complete in 2s, force it
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!isHydrated) {
        console.warn("[App] Hydration timeout - forcing ready state");
        setHydrated(true);
        setLoading(false);
      }
    }, 2000);
    return () => clearTimeout(timeout);
  }, []);

  // Hide splash screen once fonts are loaded
  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  // Always render the full provider + Stack tree — never return early before it.
  // If hydration is not done yet, the Stack still mounts (so Expo Router is ready)
  // and we overlay a loading spinner using inline styles (NativeWind may not be loaded yet).
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
        {(!fontsLoaded || !isHydrated) && (
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#4F46E5",
            }}
          >
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text
              style={{
                color: "white",
                fontSize: 18,
                fontWeight: "600",
                marginTop: 16,
              }}
            >
              VolleyCoach
            </Text>
          </View>
        )}
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
