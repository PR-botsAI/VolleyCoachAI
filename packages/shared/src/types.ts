import type { TierKey } from "./constants";

// ============================================================
// API RESPONSE TYPES
// ============================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    hasMore?: boolean;
  };
}

// ============================================================
// AUTH TYPES
// ============================================================

export interface AuthUser {
  id: string;
  firebaseUid: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  role: "player" | "coach" | "parent" | "club_admin" | "super_admin";
  tier: TierKey;
  onboardingDone: boolean;
}

export interface AuthSession {
  user: AuthUser;
  subscription: {
    tier: TierKey;
    status: string;
    aiAnalysesUsed: number;
    aiAnalysesLimit: number;
    currentPeriodEnd: string | null;
  };
}

// ============================================================
// CLUB TYPES
// ============================================================

export interface ClubWithTeams {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  city: string | null;
  state: string | null;
  primaryColor: string;
  secondaryColor: string;
  isVerified: boolean;
  memberCount: number;
  teams: TeamSummary[];
}

export interface TeamSummary {
  id: number;
  name: string;
  ageGroup: string;
  gender: string;
  division: string | null;
  headCoachName: string | null;
  playerCount: number;
  record: { wins: number; losses: number };
}

export interface TeamWithRoster extends TeamSummary {
  roster: RosterPlayer[];
  upcomingGames: GameSummary[];
  season: { id: number; name: string } | null;
}

export interface RosterPlayer {
  id: number;
  firstName: string;
  lastName: string;
  jerseyNumber: number | null;
  position: string | null;
  photoUrl: string | null;
  status: string;
}

// ============================================================
// GAME TYPES
// ============================================================

export interface GameSummary {
  id: number;
  homeTeam: { id: number; name: string; clubName: string };
  awayTeam: { id: number; name: string; clubName: string };
  homeScore: number;
  awayScore: number;
  status: string;
  scheduledAt: string;
  venue: string | null;
  isLive: boolean;
  hasStream: boolean;
}

export interface GameDetail extends GameSummary {
  sets: SetDetail[];
  liveStream: LiveStreamInfo | null;
}

export interface SetDetail {
  setNumber: number;
  homePoints: number;
  awayPoints: number;
  status: string;
  winnerTeamId: number | null;
}

export interface LiveScoreUpdate {
  gameId: number;
  setNumber: number;
  homePoints: number;
  awayPoints: number;
  homeSetsWon: number;
  awaySetsWon: number;
  pointType: string | null;
  scoringPlayerId: number | null;
  timestamp: string;
}

// ============================================================
// STREAMING TYPES
// ============================================================

export interface LiveStreamInfo {
  id: number;
  title: string;
  playbackId: string | null;
  status: string;
  viewerCount: number;
  startedAt: string | null;
  streamerName: string;
  clubName: string;
  game: GameSummary | null;
}

// ============================================================
// AI ANALYSIS TYPES
// ============================================================

export interface AnalysisProgressUpdate {
  videoId: number;
  stage: "uploading" | "processing" | "analyzing" | "complete" | "error";
  progress: number; // 0-100
  message: string;
  details?: Record<string, unknown>;
}

export interface FullAnalysisReport {
  id: number;
  videoId: number;
  overallScore: number | null;
  summary: string;
  analysisType: string;
  focusAreas: string[];
  playCount: number | null;
  errorCount: number | null;
  processingTime: number | null;
  createdAt: string;
  errors: AnalysisErrorItem[];
  exercises: AnalysisExerciseItem[];
  playerStats: AnalysisPlayerStatItem[];
}

export interface AnalysisErrorItem {
  id: number;
  title: string;
  description: string;
  severity: "high" | "medium" | "low";
  category: string | null;
  timeRange: string;
  frequency: string;
  playerDescription: string | null;
  videoTimestamp: number | null;
}

export interface AnalysisExerciseItem {
  id: number;
  name: string;
  description: string;
  duration: string;
  sets: string;
  targetArea: string;
  difficulty: string;
  videoUrl: string | null;
}

export interface AnalysisPlayerStatItem {
  id: number;
  playerId: number;
  playerName: string;
  reception: string | null;
  attack: string | null;
  blocking: string | null;
  serving: string | null;
  setting: string | null;
  defense: string | null;
  overallRating: number | null;
}

// ============================================================
// CALENDAR TYPES
// ============================================================

export interface CalendarEventItem {
  id: number;
  title: string;
  description: string | null;
  eventType: string;
  startTime: string;
  endTime: string | null;
  location: string | null;
  isAllDay: boolean;
  color: string | null;
  teamName: string | null;
  clubName: string | null;
  gameId: number | null;
  rsvpStatus: string | null;
  rsvpCounts: { going: number; maybe: number; notGoing: number };
}

// ============================================================
// STANDINGS TYPES
// ============================================================

export interface StandingEntry {
  rank: number;
  teamId: number;
  teamName: string;
  clubName: string;
  ageGroup: string;
  wins: number;
  losses: number;
  setsWon: number;
  setsLost: number;
  pointsScored: number;
  pointsAllowed: number;
  winPercentage: number;
}

// ============================================================
// AGENT TYPES (Orchestrator system)
// ============================================================

export interface AgentTask {
  id: string;
  type:
    | "video_analysis"
    | "coaching_plan"
    | "live_game"
    | "stats_query"
    | "player_assessment"
    | "training_schedule";
  userId: string;
  tier: TierKey;
  payload: Record<string, unknown>;
  priority: "low" | "normal" | "high" | "critical";
  createdAt: string;
}

export interface AgentResult {
  agentId: string;
  taskId: string;
  status: "success" | "partial" | "failed";
  data: unknown;
  confidence: number;
  processingTimeMs: number;
}

export interface OrchestratorMessage {
  taskId: string;
  fromAgent: string;
  toAgent: string;
  type: "request" | "response" | "error" | "progress";
  payload: unknown;
  timestamp: string;
}
