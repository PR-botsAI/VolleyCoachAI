import { z } from "zod";
import { AGE_GROUPS, DIVISIONS } from "./constants";

// ============================================================
// AUTH VALIDATION
// ============================================================

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["player", "coach", "parent", "club_admin"]),
});

export const onboardingSchema = z.object({
  role: z.enum(["player", "coach", "parent", "club_admin"]),
  fullName: z.string().min(2),
  phone: z.string().optional(),
});

// ============================================================
// CLUB VALIDATION
// ============================================================

export const createClubSchema = z.object({
  name: z.string().min(2, "Club name must be at least 2 characters").max(100),
  description: z.string().max(500).optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  country: z.string().default("US"),
  website: z.string().url().optional().or(z.literal("")),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().optional(),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#6366f1"),
  secondaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#818cf8"),
});

export const updateClubSchema = createClubSchema.partial();

// ============================================================
// TEAM VALIDATION
// ============================================================

export const createTeamSchema = z.object({
  name: z.string().min(2).max(100),
  ageGroup: z.enum(AGE_GROUPS as unknown as [string, ...string[]]),
  gender: z.enum(["boys", "girls", "coed"]),
  division: z
    .enum(DIVISIONS as unknown as [string, ...string[]])
    .optional(),
  maxRosterSize: z.number().int().min(6).max(25).default(15),
});

// ============================================================
// PLAYER VALIDATION
// ============================================================

export const createPlayerSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  dateOfBirth: z.string().optional(),
  jerseyNumber: z.number().int().min(0).max(99).optional(),
  position: z
    .enum([
      "setter",
      "outside_hitter",
      "opposite",
      "middle_blocker",
      "libero",
      "defensive_specialist",
      "serving_specialist",
    ])
    .optional(),
  height: z.string().optional(),
  dominantHand: z.enum(["right", "left", "ambidextrous"]).optional(),
  bio: z.string().max(500).optional(),
});

// ============================================================
// GAME VALIDATION
// ============================================================

export const createGameSchema = z.object({
  homeTeamId: z.number().int().positive(),
  awayTeamId: z.number().int().positive(),
  scheduledAt: z.string().datetime(),
  venue: z.string().optional(),
  seasonId: z.number().int().positive().optional(),
  tournamentId: z.number().int().positive().optional(),
  isPlayoff: z.boolean().default(false),
});

export const scorePointSchema = z.object({
  gameId: z.number().int().positive(),
  setId: z.number().int().positive(),
  scoringTeamId: z.number().int().positive(),
  playerId: z.number().int().positive().optional(),
  pointType: z
    .enum(["kill", "ace", "block", "opponent_error", "tip", "other"])
    .default("other"),
});

// ============================================================
// CALENDAR VALIDATION
// ============================================================

export const createCalendarEventSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(1000).optional(),
  eventType: z.enum([
    "game",
    "practice",
    "tournament",
    "tryout",
    "meeting",
    "other",
  ]),
  startTime: z.string().datetime(),
  endTime: z.string().datetime().optional(),
  location: z.string().optional(),
  isAllDay: z.boolean().default(false),
  teamId: z.number().int().positive().optional(),
  clubId: z.number().int().positive().optional(),
  reminderMinutes: z.array(z.number().int().positive()).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
});

// ============================================================
// STREAMING VALIDATION
// ============================================================

export const createStreamSchema = z.object({
  title: z.string().min(1).max(200),
  gameId: z.number().int().positive().optional(),
  clubId: z.number().int().positive(),
  isPublic: z.boolean().default(true),
});

// ============================================================
// VIDEO UPLOAD VALIDATION
// ============================================================

export const initiateUploadSchema = z.object({
  filename: z.string().min(1),
  mimeType: z.string().refine(
    (type) =>
      [
        "video/mp4",
        "video/quicktime",
        "video/x-msvideo",
        "video/webm",
        "video/x-matroska",
      ].includes(type),
    "Unsupported video format"
  ),
  fileSize: z
    .number()
    .int()
    .positive()
    .max(5 * 1024 * 1024 * 1024, "File too large (max 5GB)"),
  teamId: z.number().int().positive().optional(),
  clubId: z.number().int().positive().optional(),
});

export const analysisConfigSchema = z.object({
  analysisType: z.string().default("full"),
  focusAreas: z.array(z.string()).optional(),
});

// ============================================================
// TOURNAMENT VALIDATION
// ============================================================

export const createTournamentSchema = z.object({
  name: z.string().min(2).max(200),
  startDate: z.string(),
  endDate: z.string(),
  location: z.string().optional(),
  format: z.enum(["pool_play", "bracket", "round_robin", "swiss"]).default("pool_play"),
  maxTeams: z.number().int().positive().optional(),
  clubId: z.number().int().positive().optional(),
});
