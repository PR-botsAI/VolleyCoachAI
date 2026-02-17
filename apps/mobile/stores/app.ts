import { create } from "zustand";

type CalendarViewMode = "month" | "week" | "agenda";
type ThemePreference = "light" | "dark" | "system";

interface AppState {
  // Live stream tracking
  activeStreamsCount: number;

  // Navigation state
  selectedClubId: number | null;
  selectedTeamId: number | null;

  // Calendar
  calendarViewMode: CalendarViewMode;
  selectedCalendarDate: string;

  // Theme
  themePreference: ThemePreference;

  // Network
  isOnline: boolean;

  // Upload progress
  uploadProgress: Record<string, number>;

  // Actions
  setActiveStreamsCount: (count: number) => void;
  incrementActiveStreams: () => void;
  decrementActiveStreams: () => void;
  setSelectedClubId: (id: number | null) => void;
  setSelectedTeamId: (id: number | null) => void;
  setCalendarViewMode: (mode: CalendarViewMode) => void;
  setSelectedCalendarDate: (date: string) => void;
  setThemePreference: (preference: ThemePreference) => void;
  setOnline: (online: boolean) => void;
  setUploadProgress: (videoId: string, progress: number) => void;
  clearUploadProgress: (videoId: string) => void;
}

export const useAppStore = create<AppState>()((set, get) => ({
  activeStreamsCount: 0,
  selectedClubId: null,
  selectedTeamId: null,
  calendarViewMode: "month",
  selectedCalendarDate: new Date().toISOString().split("T")[0],
  themePreference: "system",
  isOnline: true,
  uploadProgress: {},

  setActiveStreamsCount: (count: number) => {
    set({ activeStreamsCount: count });
  },

  incrementActiveStreams: () => {
    set({ activeStreamsCount: get().activeStreamsCount + 1 });
  },

  decrementActiveStreams: () => {
    set({
      activeStreamsCount: Math.max(0, get().activeStreamsCount - 1),
    });
  },

  setSelectedClubId: (id: number | null) => {
    set({ selectedClubId: id });
  },

  setSelectedTeamId: (id: number | null) => {
    set({ selectedTeamId: id });
  },

  setCalendarViewMode: (mode: CalendarViewMode) => {
    set({ calendarViewMode: mode });
  },

  setSelectedCalendarDate: (date: string) => {
    set({ selectedCalendarDate: date });
  },

  setThemePreference: (preference: ThemePreference) => {
    set({ themePreference: preference });
  },

  setOnline: (online: boolean) => {
    set({ isOnline: online });
  },

  setUploadProgress: (videoId: string, progress: number) => {
    set({
      uploadProgress: { ...get().uploadProgress, [videoId]: progress },
    });
  },

  clearUploadProgress: (videoId: string) => {
    const updated = { ...get().uploadProgress };
    delete updated[videoId];
    set({ uploadProgress: updated });
  },
}));
