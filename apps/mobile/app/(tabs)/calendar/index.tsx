import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Calendar } from "react-native-calendars";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "../../../components/ui/Badge";
import { Card } from "../../../components/ui/Card";
import { useAppStore } from "../../../stores/app";
import { api } from "../../../services/api";
import type { CalendarEventItem } from "@volleycoach/shared";
import type { DateData, MarkedDates } from "react-native-calendars/src/types";

type ViewMode = "month" | "week" | "agenda";

const eventTypeColors: Record<string, string> = {
  game: "#4F46E5",
  practice: "#10B981",
  tournament: "#F97316",
  tryout: "#F59E0B",
  meeting: "#14B8A6",
  other: "#6B7280",
};

const eventTypeBadgeVariant: Record<
  string,
  "default" | "success" | "warning" | "danger" | "info"
> = {
  game: "info",
  practice: "success",
  tournament: "warning",
  tryout: "warning",
  meeting: "default",
  other: "default",
};

function formatEventTime(startTime: string, endTime: string | null): string {
  const start = new Date(startTime);
  const timeStr = start.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  if (endTime) {
    const end = new Date(endTime);
    const endStr = end.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    return `${timeStr} - ${endStr}`;
  }

  return timeStr;
}

export default function CalendarScreen() {
  const viewMode = useAppStore((state) => state.calendarViewMode);
  const setViewMode = useAppStore((state) => state.setCalendarViewMode);
  const selectedDate = useAppStore((state) => state.selectedCalendarDate);
  const setSelectedDate = useAppStore((state) => state.setSelectedCalendarDate);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const currentMonth = selectedDate.substring(0, 7);

  const {
    data: events,
    refetch,
    isLoading,
  } = useQuery({
    queryKey: ["calendar", "events", currentMonth],
    queryFn: async () => {
      const response = await api.get<CalendarEventItem[]>(
        "/calendar/events",
        {
          params: { month: currentMonth },
        }
      );
      return response.data ?? [];
    },
  });

  const markedDates = useMemo((): MarkedDates => {
    const marks: MarkedDates = {};

    if (events) {
      events.forEach((event) => {
        const dateKey = event.startTime.split("T")[0];
        const color = event.color ?? eventTypeColors[event.eventType] ?? "#6B7280";

        if (!marks[dateKey]) {
          marks[dateKey] = { dots: [], marked: true };
        }

        const existing = marks[dateKey];
        if (existing.dots && Array.isArray(existing.dots)) {
          if (existing.dots.length < 3) {
            existing.dots.push({ key: String(event.id), color });
          }
        }
      });
    }

    // Mark selected date
    if (marks[selectedDate]) {
      marks[selectedDate] = {
        ...marks[selectedDate],
        selected: true,
        selectedColor: "#4F46E5",
      };
    } else {
      marks[selectedDate] = {
        selected: true,
        selectedColor: "#4F46E5",
        dots: [],
      };
    }

    return marks;
  }, [events, selectedDate]);

  const selectedDayEvents = useMemo(() => {
    if (!events) return [];
    return events
      .filter((e) => e.startTime.startsWith(selectedDate))
      .sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      );
  }, [events, selectedDate]);

  const onRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  const handleDayPress = (day: DateData) => {
    setSelectedDate(day.dateString);
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900" edges={["top"]}>
      {/* Header */}
      <View className="bg-white dark:bg-gray-800 px-6 pt-4 pb-3 border-b border-gray-100 dark:border-gray-700">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-2xl font-black text-gray-900 dark:text-white">
            Calendar
          </Text>
          <TouchableOpacity
            className="min-w-[44px] min-h-[44px] items-center justify-center"
            onPress={() => {
              const today = new Date().toISOString().split("T")[0];
              setSelectedDate(today);
            }}
          >
            <Text className="text-sm font-semibold text-primary-600">
              Today
            </Text>
          </TouchableOpacity>
        </View>

        {/* View toggle */}
        <View className="flex-row bg-gray-100 dark:bg-gray-700 rounded-xl p-1">
          {(["month", "week", "agenda"] as ViewMode[]).map((mode) => (
            <TouchableOpacity
              key={mode}
              onPress={() => setViewMode(mode)}
              className={`
                flex-1 py-2 rounded-lg items-center min-h-[36px]
                ${viewMode === mode ? "bg-white dark:bg-gray-600 shadow-sm" : ""}
              `}
            >
              <Text
                className={`
                  text-sm font-semibold capitalize
                  ${
                    viewMode === mode
                      ? "text-primary-600"
                      : "text-gray-500 dark:text-gray-400"
                  }
                `}
              >
                {mode}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor="#4F46E5"
          />
        }
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Calendar */}
        {viewMode !== "agenda" && (
          <View className="bg-white dark:bg-gray-800 mx-4 mt-4 rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700">
            <Calendar
              current={selectedDate}
              onDayPress={handleDayPress}
              markingType="multi-dot"
              markedDates={markedDates}
              theme={{
                backgroundColor: "transparent",
                calendarBackground: "transparent",
                textSectionTitleColor: "#6B7280",
                selectedDayBackgroundColor: "#4F46E5",
                selectedDayTextColor: "#FFFFFF",
                todayTextColor: "#4F46E5",
                dayTextColor: "#111827",
                textDisabledColor: "#D1D5DB",
                arrowColor: "#4F46E5",
                monthTextColor: "#111827",
                textMonthFontWeight: "700",
                textDayFontWeight: "500",
                textDayFontSize: 15,
                textMonthFontSize: 16,
              }}
            />
          </View>
        )}

        {/* Events for selected day */}
        <View className="px-6 mt-4">
          <Text className="text-lg font-bold text-gray-900 dark:text-white mb-3">
            {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </Text>

          {isLoading ? (
            <View className="py-8 items-center">
              <ActivityIndicator size="small" color="#4F46E5" />
            </View>
          ) : selectedDayEvents.length > 0 ? (
            <View className="gap-3">
              {selectedDayEvents.map((event) => (
                <Card key={event.id}>
                  <View className="flex-row">
                    {/* Time bar */}
                    <View
                      className="w-1 rounded-full mr-3 self-stretch"
                      style={{
                        backgroundColor:
                          event.color ??
                          eventTypeColors[event.eventType] ??
                          "#6B7280",
                      }}
                    />
                    <View className="flex-1">
                      <View className="flex-row items-center justify-between">
                        <Text className="text-base font-bold text-gray-900 dark:text-white flex-1">
                          {event.title}
                        </Text>
                        <Badge
                          variant={
                            eventTypeBadgeVariant[event.eventType] ?? "default"
                          }
                          size="sm"
                        >
                          {event.eventType}
                        </Badge>
                      </View>

                      <Text className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {event.isAllDay
                          ? "All Day"
                          : formatEventTime(event.startTime, event.endTime)}
                      </Text>

                      {event.location && (
                        <View className="flex-row items-center mt-1.5">
                          <Ionicons
                            name="location-outline"
                            size={13}
                            color="#9CA3AF"
                          />
                          <Text className="text-xs text-gray-400 ml-1">
                            {event.location}
                          </Text>
                        </View>
                      )}

                      {event.teamName && (
                        <View className="flex-row items-center mt-1">
                          <Ionicons
                            name="shirt-outline"
                            size={13}
                            color="#9CA3AF"
                          />
                          <Text className="text-xs text-gray-400 ml-1">
                            {event.teamName}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </Card>
              ))}
            </View>
          ) : (
            <Card>
              <View className="items-center py-8">
                <Ionicons name="calendar-outline" size={40} color="#D1D5DB" />
                <Text className="text-sm text-gray-400 mt-2 text-center">
                  No events on this day
                </Text>
              </View>
            </Card>
          )}
        </View>
      </ScrollView>

      {/* FAB for creating event */}
      <TouchableOpacity
        activeOpacity={0.85}
        className="absolute bottom-24 right-6 w-14 h-14 bg-primary-600 rounded-full items-center justify-center shadow-lg"
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}
