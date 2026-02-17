import React from "react";
import { View, Text } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAppStore } from "../../stores/app";

interface TabIconProps {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
  size: number;
  badge?: number;
}

function TabIcon({ name, color, size, badge }: TabIconProps) {
  return (
    <View className="items-center justify-center">
      <View className="relative">
        <Ionicons name={name} size={size} color={color} />
        {badge !== undefined && badge > 0 && (
          <View className="absolute -top-1 -right-1.5 bg-danger-500 rounded-full min-w-[16px] h-4 items-center justify-center px-1">
            <Text className="text-[10px] font-bold text-white">
              {badge > 9 ? "9+" : badge}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

export default function TabLayout() {
  const activeStreamsCount = useAppStore((state) => state.activeStreamsCount);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#4F46E5",
        tabBarInactiveTintColor: "#9CA3AF",
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopColor: "#F3F4F6",
          borderTopWidth: 1,
          paddingTop: 4,
          paddingBottom: 8,
          height: 60,
          elevation: 8,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          marginTop: 2,
        },
        headerStyle: {
          backgroundColor: "#FFFFFF",
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 0,
        },
        headerTitleStyle: {
          fontSize: 18,
          fontWeight: "700",
          color: "#111827",
        },
      }}
    >
      <Tabs.Screen
        name="home/index"
        options={{
          title: "Home",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="home" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="clubs/index"
        options={{
          title: "Clubs",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="business" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="live/index"
        options={{
          title: "Live",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <TabIcon
              name="play-circle"
              color={color}
              size={size}
              badge={activeStreamsCount}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar/index"
        options={{
          title: "Calendar",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="calendar" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile/index"
        options={{
          title: "Profile",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="person" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
