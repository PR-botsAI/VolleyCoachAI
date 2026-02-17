// ============================================================
// SUBSCRIPTION TIERS & LIMITS
// ============================================================

export const TIERS = {
  free: {
    name: "Free",
    price: 0,
    maxFollowedTeams: 3,
    canCreateClub: false,
    canManageRosters: false,
    canScoreGames: false,
    canStream: false,
    canUseAICoach: false,
    aiAnalysesPerMonth: 0,
    maxTeamsManaged: 0,
    calendarReminders: false,
    adFree: false,
    rsvpTracking: false,
    advancedAnalytics: false,
    tournamentManagement: false,
    customBranding: false,
    apiAccess: false,
    prioritySupport: false,
  },
  starter: {
    name: "Starter",
    price: 999, // cents
    maxFollowedTeams: -1, // unlimited
    canCreateClub: true,
    canManageRosters: true,
    canScoreGames: true,
    canStream: false,
    canUseAICoach: false,
    aiAnalysesPerMonth: 0,
    maxTeamsManaged: 1,
    calendarReminders: true,
    adFree: true,
    rsvpTracking: true,
    advancedAnalytics: false,
    tournamentManagement: false,
    customBranding: false,
    apiAccess: false,
    prioritySupport: false,
  },
  pro: {
    name: "Pro",
    price: 2999, // cents
    maxFollowedTeams: -1,
    canCreateClub: true,
    canManageRosters: true,
    canScoreGames: true,
    canStream: true,
    canUseAICoach: true,
    aiAnalysesPerMonth: 5,
    maxTeamsManaged: 3,
    calendarReminders: true,
    adFree: true,
    rsvpTracking: true,
    advancedAnalytics: true,
    tournamentManagement: false,
    customBranding: false,
    apiAccess: false,
    prioritySupport: false,
  },
  club: {
    name: "Club",
    price: 9999, // cents
    maxFollowedTeams: -1,
    canCreateClub: true,
    canManageRosters: true,
    canScoreGames: true,
    canStream: true,
    canUseAICoach: true,
    aiAnalysesPerMonth: -1, // unlimited
    maxTeamsManaged: -1, // unlimited
    calendarReminders: true,
    adFree: true,
    rsvpTracking: true,
    advancedAnalytics: true,
    tournamentManagement: true,
    customBranding: true,
    apiAccess: true,
    prioritySupport: true,
  },
} as const;

export type TierKey = keyof typeof TIERS;
export type TierConfig = (typeof TIERS)[TierKey];

// ============================================================
// VOLLEYBALL RULES & CONSTANTS
// ============================================================

export const VOLLEYBALL = {
  POINTS_TO_WIN_SET: 25,
  POINTS_TO_WIN_FINAL_SET: 15,
  MIN_LEAD_TO_WIN: 2,
  MAX_SETS: 5,
  SETS_TO_WIN_MATCH: 3,
  PLAYERS_ON_COURT: 6,
  MAX_SUBSTITUTIONS: 6,
  LIBERO_REPLACEMENTS: "unlimited",
} as const;

export const AGE_GROUPS = [
  "9U",
  "10U",
  "11U",
  "12U",
  "13U",
  "14U",
  "15U",
  "16U",
  "17U",
  "18U",
  "Adult",
  "Senior",
] as const;

export const DIVISIONS = ["Elite", "Club", "Recreational", "Open"] as const;

export const POSITIONS = {
  setter: { label: "Setter", abbreviation: "S", number: 1 },
  outside_hitter: { label: "Outside Hitter", abbreviation: "OH", number: 4 },
  opposite: { label: "Opposite", abbreviation: "OPP", number: 2 },
  middle_blocker: { label: "Middle Blocker", abbreviation: "MB", number: 3 },
  libero: { label: "Libero", abbreviation: "L", number: 5 },
  defensive_specialist: { label: "Defensive Specialist", abbreviation: "DS", number: 6 },
  serving_specialist: { label: "Serving Specialist", abbreviation: "SS", number: 7 },
} as const;

// ============================================================
// AI ANALYSIS CONFIG
// ============================================================

export const AI_CONFIG = {
  MAX_VIDEO_DURATION_SECONDS: 900, // 15 minutes
  MAX_VIDEO_SIZE_BYTES: 5 * 1024 * 1024 * 1024, // 5GB
  UPLOAD_CHUNK_SIZE_BYTES: 20 * 1024 * 1024, // 20MB
  MAX_UPLOAD_RETRIES: 10,
  ANALYSIS_TIMEOUT_MS: 600_000, // 10 minutes
  GEMINI_MODEL: "gemini-2.0-flash",
  SUPPORTED_VIDEO_TYPES: [
    "video/mp4",
    "video/quicktime",
    "video/x-msvideo",
    "video/webm",
    "video/x-matroska",
  ],
} as const;

// ============================================================
// API RATE LIMITS
// ============================================================

export const RATE_LIMITS = {
  general: { windowMs: 60_000, maxRequests: 100 },
  auth: { windowMs: 60_000, maxRequests: 10 },
  upload: { windowMs: 60_000, maxRequests: 5 },
  analysis: { windowMs: 3600_000, maxRequests: 5 },
  streaming: { windowMs: 60_000, maxRequests: 3 },
} as const;

// ============================================================
// WEBSOCKET EVENTS
// ============================================================

export const WS_EVENTS = {
  // Game events
  GAME_POINT_SCORED: "game:point_scored",
  GAME_SET_ENDED: "game:set_ended",
  GAME_ENDED: "game:ended",
  GAME_STATUS_CHANGED: "game:status_changed",

  // Stream events
  STREAM_STARTED: "stream:started",
  STREAM_ENDED: "stream:ended",
  STREAM_VIEWER_COUNT: "stream:viewer_count",

  // Analysis events
  ANALYSIS_PROGRESS: "analysis:progress",
  ANALYSIS_COMPLETE: "analysis:complete",
  ANALYSIS_ERROR: "analysis:error",

  // Notification events
  NOTIFICATION_NEW: "notification:new",

  // Score events
  SCORE_UPDATE: "score:update",
} as const;

// ============================================================
// APP ROUTES (shared between mobile & web)
// ============================================================

export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  REGISTER: "/register",
  ONBOARDING: "/onboarding",
  CLUBS: "/clubs",
  CLUB_DETAIL: (id: number) => `/club/${id}`,
  TEAM_DETAIL: (id: number) => `/team/${id}`,
  GAME_DETAIL: (id: number) => `/game/${id}`,
  PLAYER_DETAIL: (id: number) => `/player/${id}`,
  CALENDAR: "/calendar",
  LIVE: "/live",
  AI_COACH: "/coach",
  ANALYSIS: (id: number) => `/analysis/${id}`,
  STREAM: (id: number) => `/stream/${id}`,
  PROFILE: "/profile",
  SETTINGS: "/settings",
  SUBSCRIBE: "/subscribe",
} as const;
