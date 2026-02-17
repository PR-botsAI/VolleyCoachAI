import {
  pgTable,
  pgEnum,
  text,
  serial,
  integer,
  boolean,
  jsonb,
  timestamp,
  decimal,
  date,
  uuid,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================================
// ENUMS
// ============================================================

export const userRoleEnum = pgEnum("user_role", [
  "player",
  "coach",
  "parent",
  "club_admin",
  "super_admin",
]);

export const subscriptionTierEnum = pgEnum("subscription_tier", [
  "free",
  "starter",
  "pro",
  "club",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "canceled",
  "past_due",
  "trialing",
  "incomplete",
]);

export const clubMemberRoleEnum = pgEnum("club_member_role", [
  "owner",
  "admin",
  "coach",
  "player",
  "parent",
  "fan",
]);

export const genderEnum = pgEnum("gender", ["boys", "girls", "coed"]);

export const playerPositionEnum = pgEnum("player_position", [
  "setter",
  "outside_hitter",
  "opposite",
  "middle_blocker",
  "libero",
  "defensive_specialist",
  "serving_specialist",
]);

export const rosterStatusEnum = pgEnum("roster_status", [
  "active",
  "injured",
  "inactive",
  "tryout",
]);

export const gameStatusEnum = pgEnum("game_status", [
  "scheduled",
  "live",
  "completed",
  "canceled",
  "postponed",
]);

export const setStatusEnum = pgEnum("set_status", [
  "pending",
  "in_progress",
  "completed",
]);

export const pointTypeEnum = pgEnum("point_type", [
  "kill",
  "ace",
  "block",
  "opponent_error",
  "tip",
  "other",
]);

export const streamStatusEnum = pgEnum("stream_status", [
  "idle",
  "preparing",
  "live",
  "ended",
]);

export const tournamentFormatEnum = pgEnum("tournament_format", [
  "pool_play",
  "bracket",
  "round_robin",
  "swiss",
]);

export const tournamentStatusEnum = pgEnum("tournament_status", [
  "registration",
  "in_progress",
  "completed",
]);

export const eventTypeEnum = pgEnum("event_type", [
  "game",
  "practice",
  "tournament",
  "tryout",
  "meeting",
  "other",
]);

export const rsvpStatusEnum = pgEnum("rsvp_status", [
  "going",
  "maybe",
  "not_going",
]);

export const videoStatusEnum = pgEnum("video_status", [
  "uploading",
  "uploaded",
  "processing",
  "analyzing",
  "complete",
  "failed",
]);

export const severityEnum = pgEnum("severity", ["high", "medium", "low"]);

export const skillCategoryEnum = pgEnum("skill_category", [
  "serving",
  "passing",
  "setting",
  "attacking",
  "blocking",
  "digging",
  "positioning",
  "communication",
]);

export const difficultyEnum = pgEnum("difficulty", [
  "beginner",
  "intermediate",
  "advanced",
]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "game_reminder",
  "score_update",
  "stream_live",
  "analysis_ready",
  "team_update",
  "club_news",
  "welcome",
]);

export const platformEnum = pgEnum("platform", ["ios", "android", "web"]);

export const dominantHandEnum = pgEnum("dominant_hand", [
  "right",
  "left",
  "ambidextrous",
]);

// ============================================================
// USERS & AUTH
// ============================================================

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    firebaseUid: text("firebase_uid").unique().notNull(),
    email: text("email").unique().notNull(),
    fullName: text("full_name").notNull(),
    avatarUrl: text("avatar_url"),
    phone: text("phone"),
    role: userRoleEnum("role").default("player").notNull(),
    onboardingDone: boolean("onboarding_done").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("users_firebase_uid_idx").on(table.firebaseUid)]
);

// ============================================================
// SUBSCRIPTIONS & BILLING
// ============================================================

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    tier: subscriptionTierEnum("tier").default("free").notNull(),
    status: subscriptionStatusEnum("status").default("active").notNull(),
    currentPeriodEnd: timestamp("current_period_end"),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
    aiAnalysesUsed: integer("ai_analyses_used").default(0).notNull(),
    aiAnalysesLimit: integer("ai_analyses_limit").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("subscriptions_user_id_idx").on(table.userId)]
);

export const tierFeatures = pgTable("tier_features", {
  id: serial("id").primaryKey(),
  tier: subscriptionTierEnum("tier").notNull(),
  featureKey: text("feature_key").notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  limitValue: integer("limit_value"),
  metadata: jsonb("metadata"),
});

// ============================================================
// CLUBS & ORGANIZATIONS
// ============================================================

export const clubs = pgTable(
  "clubs",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").unique().notNull(),
    description: text("description"),
    logoUrl: text("logo_url"),
    bannerUrl: text("banner_url"),
    city: text("city"),
    state: text("state"),
    country: text("country").default("US").notNull(),
    website: text("website"),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    foundedYear: integer("founded_year"),
    primaryColor: text("primary_color").default("#6366f1"),
    secondaryColor: text("secondary_color").default("#818cf8"),
    isVerified: boolean("is_verified").default(false).notNull(),
    ownerId: uuid("owner_id")
      .references(() => users.id)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("clubs_slug_idx").on(table.slug),
    index("clubs_owner_id_idx").on(table.ownerId),
  ]
);

export const clubMemberships = pgTable(
  "club_memberships",
  {
    id: serial("id").primaryKey(),
    clubId: integer("club_id")
      .references(() => clubs.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    role: clubMemberRoleEnum("role").default("fan").notNull(),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("club_memberships_unique").on(table.clubId, table.userId),
  ]
);

// ============================================================
// SEASONS
// ============================================================

export const seasons = pgTable("seasons", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
});

// ============================================================
// TEAMS (Age Group Branches)
// ============================================================

export const teams = pgTable(
  "teams",
  {
    id: serial("id").primaryKey(),
    clubId: integer("club_id")
      .references(() => clubs.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    ageGroup: text("age_group").notNull(), // "9U","10U","12U","14U","16U","18U","Adult"
    gender: genderEnum("gender").default("coed").notNull(),
    division: text("division"), // "Elite","Club","Rec"
    seasonId: integer("season_id").references(() => seasons.id),
    headCoachId: uuid("head_coach_id").references(() => users.id),
    maxRosterSize: integer("max_roster_size").default(15).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("teams_club_id_idx").on(table.clubId),
    index("teams_age_group_idx").on(table.ageGroup),
  ]
);

// ============================================================
// PLAYERS & ROSTERS
// ============================================================

export const players = pgTable(
  "players",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id").references(() => users.id),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    dateOfBirth: date("date_of_birth"),
    jerseyNumber: integer("jersey_number"),
    position: playerPositionEnum("position"),
    height: text("height"),
    dominantHand: dominantHandEnum("dominant_hand"),
    photoUrl: text("photo_url"),
    bio: text("bio"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("players_user_id_idx").on(table.userId)]
);

export const teamRosters = pgTable(
  "team_rosters",
  {
    id: serial("id").primaryKey(),
    teamId: integer("team_id")
      .references(() => teams.id, { onDelete: "cascade" })
      .notNull(),
    playerId: integer("player_id")
      .references(() => players.id, { onDelete: "cascade" })
      .notNull(),
    status: rosterStatusEnum("status").default("active").notNull(),
    joinedDate: date("joined_date"),
  },
  (table) => [
    uniqueIndex("team_rosters_unique").on(table.teamId, table.playerId),
  ]
);

// ============================================================
// GAMES & SCORING
// ============================================================

export const games = pgTable(
  "games",
  {
    id: serial("id").primaryKey(),
    homeTeamId: integer("home_team_id")
      .references(() => teams.id)
      .notNull(),
    awayTeamId: integer("away_team_id")
      .references(() => teams.id)
      .notNull(),
    seasonId: integer("season_id").references(() => seasons.id),
    tournamentId: integer("tournament_id").references(() => tournaments.id),
    venue: text("venue"),
    scheduledAt: timestamp("scheduled_at").notNull(),
    startedAt: timestamp("started_at"),
    endedAt: timestamp("ended_at"),
    status: gameStatusEnum("status").default("scheduled").notNull(),
    homeScore: integer("home_score").default(0).notNull(),
    awayScore: integer("away_score").default(0).notNull(),
    winnerTeamId: integer("winner_team_id").references(() => teams.id),
    isPlayoff: boolean("is_playoff").default(false).notNull(),
    liveStreamId: integer("live_stream_id"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("games_home_team_idx").on(table.homeTeamId),
    index("games_away_team_idx").on(table.awayTeamId),
    index("games_status_idx").on(table.status),
    index("games_scheduled_at_idx").on(table.scheduledAt),
  ]
);

export const sets = pgTable(
  "sets",
  {
    id: serial("id").primaryKey(),
    gameId: integer("game_id")
      .references(() => games.id, { onDelete: "cascade" })
      .notNull(),
    setNumber: integer("set_number").notNull(),
    homePoints: integer("home_points").default(0).notNull(),
    awayPoints: integer("away_points").default(0).notNull(),
    winnerTeamId: integer("winner_team_id").references(() => teams.id),
    status: setStatusEnum("status").default("pending").notNull(),
    startedAt: timestamp("started_at"),
    endedAt: timestamp("ended_at"),
  },
  (table) => [index("sets_game_id_idx").on(table.gameId)]
);

export const points = pgTable(
  "points",
  {
    id: serial("id").primaryKey(),
    setId: integer("set_id")
      .references(() => sets.id, { onDelete: "cascade" })
      .notNull(),
    scoringTeamId: integer("scoring_team_id")
      .references(() => teams.id)
      .notNull(),
    playerId: integer("player_id").references(() => players.id),
    pointType: pointTypeEnum("point_type").default("other").notNull(),
    homeScoreAfter: integer("home_score_after").notNull(),
    awayScoreAfter: integer("away_score_after").notNull(),
    timestamp: timestamp("timestamp").defaultNow().notNull(),
  },
  (table) => [index("points_set_id_idx").on(table.setId)]
);

// ============================================================
// LIVE STREAMING
// ============================================================

export const liveStreams = pgTable(
  "live_streams",
  {
    id: serial("id").primaryKey(),
    gameId: integer("game_id").references(() => games.id),
    clubId: integer("club_id")
      .references(() => clubs.id)
      .notNull(),
    streamerId: uuid("streamer_id")
      .references(() => users.id)
      .notNull(),
    title: text("title").notNull(),
    muxStreamKey: text("mux_stream_key"),
    muxPlaybackId: text("mux_playback_id"),
    muxAssetId: text("mux_asset_id"),
    status: streamStatusEnum("status").default("idle").notNull(),
    viewerCount: integer("viewer_count").default(0).notNull(),
    startedAt: timestamp("started_at"),
    endedAt: timestamp("ended_at"),
    duration: integer("duration"),
    thumbnailUrl: text("thumbnail_url"),
    isPublic: boolean("is_public").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("live_streams_status_idx").on(table.status),
    index("live_streams_club_id_idx").on(table.clubId),
  ]
);

// ============================================================
// TOURNAMENTS
// ============================================================

export const tournaments = pgTable("tournaments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  clubId: integer("club_id").references(() => clubs.id),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  location: text("location"),
  format: tournamentFormatEnum("format").default("pool_play").notNull(),
  maxTeams: integer("max_teams"),
  status: tournamentStatusEnum("status").default("registration").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tournamentTeams = pgTable(
  "tournament_teams",
  {
    id: serial("id").primaryKey(),
    tournamentId: integer("tournament_id")
      .references(() => tournaments.id, { onDelete: "cascade" })
      .notNull(),
    teamId: integer("team_id")
      .references(() => teams.id)
      .notNull(),
    poolName: text("pool_name"),
    seed: integer("seed"),
  },
  (table) => [
    uniqueIndex("tournament_teams_unique").on(
      table.tournamentId,
      table.teamId
    ),
  ]
);

// ============================================================
// CALENDAR
// ============================================================

export const calendarEvents = pgTable(
  "calendar_events",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    clubId: integer("club_id").references(() => clubs.id),
    teamId: integer("team_id").references(() => teams.id),
    gameId: integer("game_id").references(() => games.id),
    title: text("title").notNull(),
    description: text("description"),
    eventType: eventTypeEnum("event_type").default("other").notNull(),
    startTime: timestamp("start_time").notNull(),
    endTime: timestamp("end_time"),
    location: text("location"),
    isAllDay: boolean("is_all_day").default(false).notNull(),
    recurrence: jsonb("recurrence"),
    reminderMinutes: integer("reminder_minutes").array(),
    color: text("color"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("calendar_events_user_id_idx").on(table.userId),
    index("calendar_events_start_time_idx").on(table.startTime),
  ]
);

export const calendarRsvps = pgTable(
  "calendar_rsvps",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id")
      .references(() => calendarEvents.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    status: rsvpStatusEnum("status").default("going").notNull(),
  },
  (table) => [
    uniqueIndex("calendar_rsvps_unique").on(table.eventId, table.userId),
  ]
);

// ============================================================
// AI VIDEO ANALYSIS
// ============================================================

export const videos = pgTable(
  "videos",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    clubId: integer("club_id").references(() => clubs.id),
    teamId: integer("team_id").references(() => teams.id),
    filename: text("filename").notNull(),
    originalName: text("original_name").notNull(),
    fileSize: integer("file_size").notNull(),
    mimeType: text("mime_type").notNull(),
    gcsPath: text("gcs_path"),
    gcsUrl: text("gcs_url"),
    duration: integer("duration"),
    thumbnailUrl: text("thumbnail_url"),
    status: videoStatusEnum("status").default("uploading").notNull(),
    analysisComplete: boolean("analysis_complete").default(false).notNull(),
    isFromStream: boolean("is_from_stream").default(false).notNull(),
    sourceStreamId: integer("source_stream_id").references(() => liveStreams.id),
    uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  },
  (table) => [
    index("videos_user_id_idx").on(table.userId),
    index("videos_status_idx").on(table.status),
  ]
);

export const analysisReports = pgTable(
  "analysis_reports",
  {
    id: serial("id").primaryKey(),
    videoId: integer("video_id")
      .references(() => videos.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    overallScore: decimal("overall_score", { precision: 4, scale: 1 }),
    summary: text("summary").notNull(),
    analysisType: text("analysis_type").notNull(),
    focusAreas: text("focus_areas").array(),
    playCount: integer("play_count"),
    errorCount: integer("error_count"),
    pointsHome: integer("points_home"),
    pointsAway: integer("points_away"),
    aiModel: text("ai_model"),
    processingTime: integer("processing_time"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("analysis_reports_video_id_idx").on(table.videoId)]
);

export const analysisErrors = pgTable(
  "analysis_errors",
  {
    id: serial("id").primaryKey(),
    analysisId: integer("analysis_id")
      .references(() => analysisReports.id, { onDelete: "cascade" })
      .notNull(),
    playerId: integer("player_id").references(() => players.id),
    title: text("title").notNull(),
    description: text("description").notNull(),
    severity: severityEnum("severity").notNull(),
    category: skillCategoryEnum("category"),
    timeRange: text("time_range").notNull(),
    frequency: text("frequency").notNull(),
    playerDescription: text("player_description"),
    videoTimestamp: integer("video_timestamp"),
  },
  (table) => [index("analysis_errors_analysis_id_idx").on(table.analysisId)]
);

export const analysisExercises = pgTable(
  "analysis_exercises",
  {
    id: serial("id").primaryKey(),
    analysisId: integer("analysis_id")
      .references(() => analysisReports.id, { onDelete: "cascade" })
      .notNull(),
    playerId: integer("player_id").references(() => players.id),
    name: text("name").notNull(),
    description: text("description").notNull(),
    duration: text("duration").notNull(),
    sets: text("sets").notNull(),
    targetArea: text("target_area").notNull(),
    difficulty: difficultyEnum("difficulty").default("intermediate").notNull(),
    videoUrl: text("video_url"),
  },
  (table) => [
    index("analysis_exercises_analysis_id_idx").on(table.analysisId),
  ]
);

export const analysisPlayerStats = pgTable(
  "analysis_player_stats",
  {
    id: serial("id").primaryKey(),
    playerId: integer("player_id")
      .references(() => players.id)
      .notNull(),
    analysisId: integer("analysis_id")
      .references(() => analysisReports.id, { onDelete: "cascade" })
      .notNull(),
    reception: text("reception"),
    attack: text("attack"),
    blocking: text("blocking"),
    serving: text("serving"),
    setting: text("setting"),
    defense: text("defense"),
    overallRating: decimal("overall_rating", { precision: 4, scale: 1 }),
  },
  (table) => [
    index("analysis_player_stats_analysis_id_idx").on(table.analysisId),
  ]
);

// ============================================================
// RANKINGS & STANDINGS
// ============================================================

export const standings = pgTable(
  "standings",
  {
    id: serial("id").primaryKey(),
    teamId: integer("team_id")
      .references(() => teams.id, { onDelete: "cascade" })
      .notNull(),
    seasonId: integer("season_id")
      .references(() => seasons.id)
      .notNull(),
    wins: integer("wins").default(0).notNull(),
    losses: integer("losses").default(0).notNull(),
    setsWon: integer("sets_won").default(0).notNull(),
    setsLost: integer("sets_lost").default(0).notNull(),
    pointsScored: integer("points_scored").default(0).notNull(),
    pointsAllowed: integer("points_allowed").default(0).notNull(),
    winPercentage: decimal("win_percentage", { precision: 5, scale: 4 }).default("0"),
    rankInDivision: integer("rank_in_division"),
    rankInAgeGroup: integer("rank_in_age_group"),
    lastUpdated: timestamp("last_updated").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("standings_unique").on(table.teamId, table.seasonId),
    index("standings_season_id_idx").on(table.seasonId),
  ]
);

// ============================================================
// NOTIFICATIONS
// ============================================================

export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    type: notificationTypeEnum("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    data: jsonb("data"),
    isRead: boolean("is_read").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("notifications_user_id_idx").on(table.userId),
    index("notifications_is_read_idx").on(table.isRead),
  ]
);

export const pushTokens = pgTable(
  "push_tokens",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    token: text("token").notNull(),
    platform: platformEnum("platform").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("push_tokens_user_id_idx").on(table.userId)]
);

// ============================================================
// RELATIONS
// ============================================================

export const usersRelations = relations(users, ({ many, one }) => ({
  subscriptions: many(subscriptions),
  clubMemberships: many(clubMemberships),
  ownedClubs: many(clubs),
  videos: many(videos),
  calendarEvents: many(calendarEvents),
  notifications: many(notifications),
  pushTokens: many(pushTokens),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
}));

export const clubsRelations = relations(clubs, ({ one, many }) => ({
  owner: one(users, {
    fields: [clubs.ownerId],
    references: [users.id],
  }),
  memberships: many(clubMemberships),
  teams: many(teams),
  liveStreams: many(liveStreams),
  tournaments: many(tournaments),
}));

export const clubMembershipsRelations = relations(
  clubMemberships,
  ({ one }) => ({
    club: one(clubs, {
      fields: [clubMemberships.clubId],
      references: [clubs.id],
    }),
    user: one(users, {
      fields: [clubMemberships.userId],
      references: [users.id],
    }),
  })
);

export const teamsRelations = relations(teams, ({ one, many }) => ({
  club: one(clubs, {
    fields: [teams.clubId],
    references: [clubs.id],
  }),
  season: one(seasons, {
    fields: [teams.seasonId],
    references: [seasons.id],
  }),
  headCoach: one(users, {
    fields: [teams.headCoachId],
    references: [users.id],
  }),
  roster: many(teamRosters),
  homeGames: many(games, { relationName: "homeTeam" }),
  awayGames: many(games, { relationName: "awayTeam" }),
  standings: many(standings),
}));

export const playersRelations = relations(players, ({ one, many }) => ({
  user: one(users, {
    fields: [players.userId],
    references: [users.id],
  }),
  teamRosters: many(teamRosters),
  analysisErrors: many(analysisErrors),
  analysisExercises: many(analysisExercises),
  analysisPlayerStats: many(analysisPlayerStats),
}));

export const teamRostersRelations = relations(teamRosters, ({ one }) => ({
  team: one(teams, {
    fields: [teamRosters.teamId],
    references: [teams.id],
  }),
  player: one(players, {
    fields: [teamRosters.playerId],
    references: [players.id],
  }),
}));

export const gamesRelations = relations(games, ({ one, many }) => ({
  homeTeam: one(teams, {
    fields: [games.homeTeamId],
    references: [teams.id],
    relationName: "homeTeam",
  }),
  awayTeam: one(teams, {
    fields: [games.awayTeamId],
    references: [teams.id],
    relationName: "awayTeam",
  }),
  season: one(seasons, {
    fields: [games.seasonId],
    references: [seasons.id],
  }),
  tournament: one(tournaments, {
    fields: [games.tournamentId],
    references: [tournaments.id],
  }),
  sets: many(sets),
}));

export const setsRelations = relations(sets, ({ one, many }) => ({
  game: one(games, {
    fields: [sets.gameId],
    references: [games.id],
  }),
  points: many(points),
}));

export const pointsRelations = relations(points, ({ one }) => ({
  set: one(sets, {
    fields: [points.setId],
    references: [sets.id],
  }),
  player: one(players, {
    fields: [points.playerId],
    references: [players.id],
  }),
}));

export const liveStreamsRelations = relations(liveStreams, ({ one }) => ({
  game: one(games, {
    fields: [liveStreams.gameId],
    references: [games.id],
  }),
  club: one(clubs, {
    fields: [liveStreams.clubId],
    references: [clubs.id],
  }),
  streamer: one(users, {
    fields: [liveStreams.streamerId],
    references: [users.id],
  }),
}));

export const tournamentsRelations = relations(tournaments, ({ one, many }) => ({
  club: one(clubs, {
    fields: [tournaments.clubId],
    references: [clubs.id],
  }),
  teams: many(tournamentTeams),
}));

export const tournamentTeamsRelations = relations(
  tournamentTeams,
  ({ one }) => ({
    tournament: one(tournaments, {
      fields: [tournamentTeams.tournamentId],
      references: [tournaments.id],
    }),
    team: one(teams, {
      fields: [tournamentTeams.teamId],
      references: [teams.id],
    }),
  })
);

export const calendarEventsRelations = relations(
  calendarEvents,
  ({ one, many }) => ({
    user: one(users, {
      fields: [calendarEvents.userId],
      references: [users.id],
    }),
    club: one(clubs, {
      fields: [calendarEvents.clubId],
      references: [clubs.id],
    }),
    team: one(teams, {
      fields: [calendarEvents.teamId],
      references: [teams.id],
    }),
    game: one(games, {
      fields: [calendarEvents.gameId],
      references: [games.id],
    }),
    rsvps: many(calendarRsvps),
  })
);

export const calendarRsvpsRelations = relations(calendarRsvps, ({ one }) => ({
  event: one(calendarEvents, {
    fields: [calendarRsvps.eventId],
    references: [calendarEvents.id],
  }),
  user: one(users, {
    fields: [calendarRsvps.userId],
    references: [users.id],
  }),
}));

export const videosRelations = relations(videos, ({ one, many }) => ({
  user: one(users, {
    fields: [videos.userId],
    references: [users.id],
  }),
  club: one(clubs, {
    fields: [videos.clubId],
    references: [clubs.id],
  }),
  team: one(teams, {
    fields: [videos.teamId],
    references: [teams.id],
  }),
  sourceStream: one(liveStreams, {
    fields: [videos.sourceStreamId],
    references: [liveStreams.id],
  }),
  analysisReports: many(analysisReports),
}));

export const analysisReportsRelations = relations(
  analysisReports,
  ({ one, many }) => ({
    video: one(videos, {
      fields: [analysisReports.videoId],
      references: [videos.id],
    }),
    user: one(users, {
      fields: [analysisReports.userId],
      references: [users.id],
    }),
    errors: many(analysisErrors),
    exercises: many(analysisExercises),
    playerStats: many(analysisPlayerStats),
  })
);

export const analysisErrorsRelations = relations(
  analysisErrors,
  ({ one }) => ({
    analysis: one(analysisReports, {
      fields: [analysisErrors.analysisId],
      references: [analysisReports.id],
    }),
    player: one(players, {
      fields: [analysisErrors.playerId],
      references: [players.id],
    }),
  })
);

export const analysisExercisesRelations = relations(
  analysisExercises,
  ({ one }) => ({
    analysis: one(analysisReports, {
      fields: [analysisExercises.analysisId],
      references: [analysisReports.id],
    }),
    player: one(players, {
      fields: [analysisExercises.playerId],
      references: [players.id],
    }),
  })
);

export const analysisPlayerStatsRelations = relations(
  analysisPlayerStats,
  ({ one }) => ({
    analysis: one(analysisReports, {
      fields: [analysisPlayerStats.analysisId],
      references: [analysisReports.id],
    }),
    player: one(players, {
      fields: [analysisPlayerStats.playerId],
      references: [players.id],
    }),
  })
);

export const standingsRelations = relations(standings, ({ one }) => ({
  team: one(teams, {
    fields: [standings.teamId],
    references: [teams.id],
  }),
  season: one(seasons, {
    fields: [standings.seasonId],
    references: [seasons.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const pushTokensRelations = relations(pushTokens, ({ one }) => ({
  user: one(users, {
    fields: [pushTokens.userId],
    references: [users.id],
  }),
}));

// ============================================================
// INSERT SCHEMAS (Zod validation for API input)
// ============================================================

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertClubSchema = createInsertSchema(clubs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  isVerified: true,
});

export const insertTeamSchema = createInsertSchema(teams).omit({
  id: true,
  createdAt: true,
});

export const insertPlayerSchema = createInsertSchema(players).omit({
  id: true,
  createdAt: true,
});

export const insertGameSchema = createInsertSchema(games).omit({
  id: true,
  createdAt: true,
  homeScore: true,
  awayScore: true,
  winnerTeamId: true,
  startedAt: true,
  endedAt: true,
});

export const insertCalendarEventSchema = createInsertSchema(calendarEvents).omit({
  id: true,
  createdAt: true,
});

export const insertVideoSchema = createInsertSchema(videos).omit({
  id: true,
  uploadedAt: true,
  analysisComplete: true,
});

export const insertLiveStreamSchema = createInsertSchema(liveStreams).omit({
  id: true,
  createdAt: true,
  viewerCount: true,
  muxStreamKey: true,
  muxPlaybackId: true,
  muxAssetId: true,
});

export const insertTournamentSchema = createInsertSchema(tournaments).omit({
  id: true,
  createdAt: true,
});

// ============================================================
// SELECT TYPES (for type inference)
// ============================================================

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Club = typeof clubs.$inferSelect;
export type InsertClub = z.infer<typeof insertClubSchema>;
export type Team = typeof teams.$inferSelect;
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type Player = typeof players.$inferSelect;
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type Game = typeof games.$inferSelect;
export type InsertGame = z.infer<typeof insertGameSchema>;
export type GameSet = typeof sets.$inferSelect;
export type Point = typeof points.$inferSelect;
export type LiveStream = typeof liveStreams.$inferSelect;
export type InsertLiveStream = z.infer<typeof insertLiveStreamSchema>;
export type Tournament = typeof tournaments.$inferSelect;
export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type InsertCalendarEvent = z.infer<typeof insertCalendarEventSchema>;
export type Video = typeof videos.$inferSelect;
export type InsertVideo = z.infer<typeof insertVideoSchema>;
export type AnalysisReport = typeof analysisReports.$inferSelect;
export type AnalysisError = typeof analysisErrors.$inferSelect;
export type AnalysisExercise = typeof analysisExercises.$inferSelect;
export type Standing = typeof standings.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type ClubMembership = typeof clubMemberships.$inferSelect;
export type TeamRoster = typeof teamRosters.$inferSelect;
export type Season = typeof seasons.$inferSelect;
