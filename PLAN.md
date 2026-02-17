# VolleyCoachAI - Complete Platform Rebuild Plan

## VISION

Build the **definitive volleyball ecosystem platform** — not just a coaching tool, but the operating system for competitive volleyball. Every club, every parent, every coach, every player — one platform.

Think: **Hudl meets ESPN meets AI Coach** — purpose-built for volleyball.

---

## PART 1: TECH STACK (Complete Rewrite)

### Why Rewrite Instead of Iterate

The existing app is a **single-purpose video analyzer**. What we need is a **multi-tenant social sports platform with AI**. The gap is too large to bridge incrementally. We keep the battle-tested pieces (Gemini integration, GCS uploads, WebSocket patterns, agent architecture) and rebuild the scaffolding around them.

### Frontend: Expo (React Native) + Expo Router

```
WHY EXPO:
- True native iOS + Android from one codebase
- Camera access for live streaming (no PWA limitations)
- Push notifications (native, not web push)
- Offline-first calendar sync
- App Store / Play Store presence = credibility + discovery
- Expo SDK 52 has first-class web support (marketing site)
- 60fps animations, native gestures, haptic feedback
- OTA updates without app store review
```

| Library             | Purpose                        |
|---------------------|--------------------------------|
| Expo SDK 52+        | React Native framework         |
| Expo Router v4      | File-based navigation          |
| NativeWind v4       | Tailwind CSS for React Native  |
| React Query v5      | Server state (keep existing)   |
| Zustand             | Client state management        |
| Expo AV             | Video playback & recording     |
| Expo Camera         | Live streaming capture         |
| expo-notifications  | Push notifications             |
| React Native Reanimated | 60fps animations          |
| MMKV                | Ultra-fast local storage       |
| React Native Calendars | Calendar UI                |

### Backend: Node.js + Express (Evolved)

```
KEEP:    Express, Drizzle ORM, PostgreSQL, Socket.IO, GCS, Gemini
ADD:     Stripe, Clerk Auth, Redis, BullMQ, Mux (streaming)
REMOVE:  Wouter, Vite SSR, all frontend from server
```

| Component        | Technology                | Purpose                    |
|------------------|---------------------------|----------------------------|
| Runtime          | Node.js 22 LTS           | Server runtime             |
| Framework        | Express 5                 | HTTP API                   |
| Database         | PostgreSQL 16 (Neon)      | Primary data store         |
| ORM              | Drizzle ORM              | Type-safe queries          |
| Cache            | Redis (Upstash)          | Rankings, live scores, sessions |
| Queue            | BullMQ                   | Video processing jobs      |
| Auth             | Clerk                    | Auth + user management     |
| Payments         | Stripe                   | Subscriptions & billing    |
| Real-time        | Socket.IO 4              | Live updates               |
| Storage          | Google Cloud Storage     | Videos, images, assets     |
| Live Streaming   | Mux                      | HLS/DASH live video        |
| AI               | Google Gemini 2.0 Flash  | Video analysis             |
| Email            | Resend                   | Transactional emails       |
| Push             | Expo Push Service        | Mobile notifications       |

### Monorepo Structure (Turborepo)

```
volleycoach/
├── apps/
│   ├── mobile/               # Expo React Native app
│   │   ├── app/              # Expo Router (file-based routes)
│   │   │   ├── (auth)/       # Auth screens (login, register, onboarding)
│   │   │   ├── (tabs)/       # Main tab navigator
│   │   │   │   ├── home/     # Feed & dashboard
│   │   │   │   ├── clubs/    # Club discovery & pages
│   │   │   │   ├── live/     # Live streaming hub
│   │   │   │   ├── calendar/ # Game calendar
│   │   │   │   └── profile/  # User profile & settings
│   │   │   ├── club/[id]/    # Dynamic club pages
│   │   │   ├── team/[id]/    # Team pages (9U, 10U, etc.)
│   │   │   ├── game/[id]/    # Game detail / live score
│   │   │   ├── player/[id]/  # Player profile
│   │   │   ├── analysis/[id]/ # AI analysis results
│   │   │   ├── stream/[id]/  # Live stream viewer
│   │   │   └── coach/        # AI Coach interface (PRO)
│   │   ├── components/       # Shared UI components
│   │   │   ├── ui/           # Base design system
│   │   │   ├── clubs/        # Club-related components
│   │   │   ├── games/        # Game/score components
│   │   │   ├── streaming/    # Live stream components
│   │   │   ├── calendar/     # Calendar components
│   │   │   ├── analysis/     # AI analysis components
│   │   │   └── paywall/      # Subscription gate components
│   │   ├── hooks/            # Custom React hooks
│   │   ├── stores/           # Zustand stores
│   │   ├── services/         # API client, WebSocket
│   │   └── utils/            # Helpers, formatters
│   │
│   └── web/                  # Next.js marketing site (Phase 2)
│       └── ...               # Landing, SEO, blog
│
├── packages/
│   ├── shared/               # Shared types, validation, constants
│   │   ├── schema.ts         # Drizzle schema (source of truth)
│   │   ├── types.ts          # Shared TypeScript types
│   │   ├── validation.ts     # Zod schemas for API
│   │   └── constants.ts      # Tier limits, sport rules, etc.
│   │
│   ├── api/                  # Backend API server
│   │   ├── src/
│   │   │   ├── index.ts      # Express app entry
│   │   │   ├── routes/       # Route modules (REST)
│   │   │   │   ├── auth.ts
│   │   │   │   ├── clubs.ts
│   │   │   │   ├── teams.ts
│   │   │   │   ├── games.ts
│   │   │   │   ├── players.ts
│   │   │   │   ├── streaming.ts
│   │   │   │   ├── calendar.ts
│   │   │   │   ├── analysis.ts
│   │   │   │   ├── subscriptions.ts
│   │   │   │   └── upload.ts
│   │   │   ├── middleware/    # Auth, rate limiting, tier gates
│   │   │   ├── services/     # Business logic layer
│   │   │   ├── agents/       # AI Agent system
│   │   │   ├── jobs/         # BullMQ job processors
│   │   │   ├── realtime/     # WebSocket event handlers
│   │   │   └── lib/          # Database, cache, storage clients
│   │   └── drizzle/          # Migrations
│   │
│   └── agents/               # AI Agent Orchestration System
│       ├── orchestrator.ts   # Master orchestrator
│       ├── registry.ts       # Agent discovery & routing
│       ├── base-agent.ts     # Abstract agent (from existing)
│       ├── video-agent.ts    # Video analysis coordinator
│       ├── coaching-agent.ts # Exercise & training plans
│       ├── stats-agent.ts    # Rankings & statistics
│       ├── live-agent.ts     # Real-time game analysis
│       └── notification-agent.ts # Smart notifications
│
├── turbo.json                # Turborepo pipeline config
├── package.json              # Root workspace
└── docker-compose.yml        # Local dev (Postgres, Redis)
```

---

## PART 2: DATABASE SCHEMA (Complete)

### Entity Relationship Overview

```
Users ──┬── ClubMemberships ──── Clubs ──── Teams ──── TeamRosters ──── Players
        │                                     │
        ├── Subscriptions                     ├── Games ──── Sets ──── Points
        │                                     │
        ├── CalendarEvents                    ├── Seasons
        │                                     │
        └── Videos ──── Analyses              └── LiveStreams
```

### Core Tables

```typescript
// ==================== AUTHENTICATION & USERS ====================

users
  id              uuid PK (from Clerk)
  email           text UNIQUE NOT NULL
  fullName        text NOT NULL
  avatarUrl       text
  phone           text
  role            enum('player', 'coach', 'parent', 'club_admin', 'super_admin')
  onboardingDone  boolean DEFAULT false
  createdAt       timestamp
  updatedAt       timestamp

// ==================== SUBSCRIPTIONS & BILLING ====================

subscriptions
  id              serial PK
  userId          uuid FK -> users
  stripeCustomerId    text
  stripeSubscriptionId text
  tier            enum('free', 'starter', 'pro', 'club') NOT NULL
  status          enum('active', 'canceled', 'past_due', 'trialing')
  currentPeriodEnd    timestamp
  cancelAtPeriodEnd   boolean DEFAULT false
  aiAnalysesUsed      integer DEFAULT 0
  aiAnalysesLimit     integer DEFAULT 0
  createdAt       timestamp

tier_features
  id              serial PK
  tier            enum NOT NULL
  featureKey      text NOT NULL  -- e.g. 'live_streaming', 'ai_coach', 'club_page'
  enabled         boolean DEFAULT true
  limitValue      integer        -- null = unlimited
  metadata        jsonb          -- extra config per feature

// ==================== CLUBS & ORGANIZATIONS ====================

clubs
  id              serial PK
  name            text NOT NULL
  slug            text UNIQUE NOT NULL  -- URL-friendly: "miami-heat-volleyball"
  description     text
  logoUrl         text
  bannerUrl       text
  city            text
  state           text
  country         text DEFAULT 'US'
  website         text
  contactEmail    text
  contactPhone    text
  foundedYear     integer
  primaryColor    text           -- hex for club branding
  secondaryColor  text
  isVerified      boolean DEFAULT false
  ownerId         uuid FK -> users
  subscriptionId  integer FK -> subscriptions
  createdAt       timestamp
  updatedAt       timestamp

club_memberships
  id              serial PK
  clubId          integer FK -> clubs
  userId          uuid FK -> users
  role            enum('owner', 'admin', 'coach', 'player', 'parent', 'fan')
  joinedAt        timestamp
  UNIQUE(clubId, userId)

// ==================== TEAMS (Age Groups / Branches) ====================

teams
  id              serial PK
  clubId          integer FK -> clubs NOT NULL
  name            text NOT NULL       -- "12U Girls Elite"
  ageGroup        text NOT NULL       -- "9U", "10U", "12U", "14U", "16U", "18U", "Adult"
  gender          enum('boys', 'girls', 'coed')
  division        text                -- "Elite", "Club", "Rec"
  seasonId        integer FK -> seasons
  headCoachId     uuid FK -> users
  assistantCoaches uuid[]             -- array of user IDs
  maxRosterSize   integer DEFAULT 15
  isActive        boolean DEFAULT true
  createdAt       timestamp

seasons
  id              serial PK
  name            text NOT NULL       -- "Spring 2026"
  startDate       date NOT NULL
  endDate         date NOT NULL
  isActive        boolean DEFAULT true

// ==================== PLAYERS & ROSTERS ====================

players
  id              serial PK
  userId          uuid FK -> users    -- linked user account (optional)
  firstName       text NOT NULL
  lastName        text NOT NULL
  dateOfBirth     date
  jerseyNumber    integer
  position        enum('setter', 'outside_hitter', 'opposite', 'middle_blocker',
                       'libero', 'defensive_specialist', 'serving_specialist')
  height          text                -- "5'10"
  dominantHand    enum('right', 'left', 'ambidextrous')
  photoUrl        text
  bio             text
  createdAt       timestamp

team_rosters
  id              serial PK
  teamId          integer FK -> teams NOT NULL
  playerId        integer FK -> players NOT NULL
  status          enum('active', 'injured', 'inactive', 'tryout')
  joinedDate      date
  UNIQUE(teamId, playerId)

// ==================== GAMES & SCORING ====================

games
  id              serial PK
  homeTeamId      integer FK -> teams NOT NULL
  awayTeamId      integer FK -> teams NOT NULL
  seasonId        integer FK -> seasons
  tournamentId    integer FK -> tournaments
  venue           text
  scheduledAt     timestamp NOT NULL
  startedAt       timestamp
  endedAt         timestamp
  status          enum('scheduled', 'live', 'completed', 'canceled', 'postponed')
  homeScore       integer DEFAULT 0   -- sets won
  awayScore       integer DEFAULT 0   -- sets won
  winnerTeamId    integer FK -> teams
  isPlayoff       boolean DEFAULT false
  liveStreamId    integer FK -> live_streams
  notes           text
  createdAt       timestamp

sets
  id              serial PK
  gameId          integer FK -> games NOT NULL
  setNumber       integer NOT NULL    -- 1, 2, 3, 4, 5
  homePoints      integer DEFAULT 0
  awayPoints      integer DEFAULT 0
  winnerTeamId    integer FK -> teams
  status          enum('pending', 'in_progress', 'completed')
  startedAt       timestamp
  endedAt         timestamp

points
  id              serial PK
  setId           integer FK -> sets NOT NULL
  scoringTeamId   integer FK -> teams NOT NULL
  playerId        integer FK -> players  -- who scored/earned it
  pointType       enum('kill', 'ace', 'block', 'opponent_error', 'tip', 'other')
  homeScoreAfter  integer NOT NULL
  awayScoreAfter  integer NOT NULL
  timestamp       timestamp DEFAULT now()

// ==================== LIVE STREAMING ====================

live_streams
  id              serial PK
  gameId          integer FK -> games
  clubId          integer FK -> clubs NOT NULL
  streamerId      uuid FK -> users NOT NULL    -- who is streaming
  title           text NOT NULL
  muxStreamKey    text                         -- Mux stream key
  muxPlaybackId   text                         -- Mux playback ID
  muxAssetId      text                         -- Mux asset (for VOD after)
  status          enum('idle', 'preparing', 'live', 'ended')
  viewerCount     integer DEFAULT 0
  startedAt       timestamp
  endedAt         timestamp
  duration        integer                      -- seconds
  thumbnailUrl    text
  isPublic        boolean DEFAULT true
  createdAt       timestamp

// ==================== TOURNAMENTS ====================

tournaments
  id              serial PK
  name            text NOT NULL
  clubId          integer FK -> clubs           -- organizing club
  startDate       date NOT NULL
  endDate         date NOT NULL
  location        text
  format          enum('pool_play', 'bracket', 'round_robin', 'swiss')
  maxTeams        integer
  status          enum('registration', 'in_progress', 'completed')
  createdAt       timestamp

tournament_teams
  id              serial PK
  tournamentId    integer FK -> tournaments
  teamId          integer FK -> teams
  poolName        text                          -- "Pool A", "Pool B"
  seed            integer
  UNIQUE(tournamentId, teamId)

// ==================== CALENDAR ====================

calendar_events
  id              serial PK
  userId          uuid FK -> users              -- who created it
  clubId          integer FK -> clubs
  teamId          integer FK -> teams
  gameId          integer FK -> games
  title           text NOT NULL
  description     text
  eventType       enum('game', 'practice', 'tournament', 'tryout', 'meeting', 'other')
  startTime       timestamp NOT NULL
  endTime         timestamp
  location        text
  isAllDay        boolean DEFAULT false
  recurrence      jsonb                         -- iCal-style recurrence rules
  reminderMinutes integer[]                     -- [15, 60, 1440] = 15min, 1hr, 1day
  color           text                          -- hex color for display
  createdAt       timestamp

calendar_rsvps
  id              serial PK
  eventId         integer FK -> calendar_events
  userId          uuid FK -> users
  status          enum('going', 'maybe', 'not_going')
  UNIQUE(eventId, userId)

// ==================== AI VIDEO ANALYSIS (Evolved from existing) ====================

videos
  id              serial PK
  userId          uuid FK -> users NOT NULL
  clubId          integer FK -> clubs
  teamId          integer FK -> teams
  filename        text NOT NULL
  originalName    text NOT NULL
  fileSize        integer NOT NULL
  mimeType        text NOT NULL
  gcsPath         text
  gcsUrl          text
  duration        integer                      -- seconds
  thumbnailUrl    text
  status          enum('uploading', 'uploaded', 'processing', 'analyzing', 'complete', 'failed')
  analysisComplete boolean DEFAULT false
  isFromStream    boolean DEFAULT false         -- was this captured from a live stream?
  sourceStreamId  integer FK -> live_streams
  uploadedAt      timestamp

analysis_reports
  id              serial PK
  videoId         integer FK -> videos NOT NULL
  userId          uuid FK -> users NOT NULL
  overallScore    decimal(3,1)
  summary         text NOT NULL
  analysisType    text NOT NULL
  focusAreas      text[]
  playCount       integer                      -- total plays detected
  errorCount      integer                      -- total errors detected
  pointsHome      integer
  pointsAway      integer
  aiModel         text                         -- which model produced this
  processingTime  integer                      -- seconds it took
  createdAt       timestamp

analysis_errors
  id              serial PK
  analysisId      integer FK -> analysis_reports NOT NULL
  playerId        integer FK -> players
  title           text NOT NULL
  description     text NOT NULL
  severity        enum('high', 'medium', 'low') NOT NULL
  category        enum('serving', 'passing', 'setting', 'attacking',
                       'blocking', 'digging', 'positioning', 'communication')
  timeRange       text NOT NULL
  frequency       text NOT NULL
  playerDescription text
  videoTimestamp   integer                     -- seconds into video

analysis_exercises
  id              serial PK
  analysisId      integer FK -> analysis_reports NOT NULL
  playerId        integer FK -> players
  name            text NOT NULL
  description     text NOT NULL
  duration        text NOT NULL
  sets            text NOT NULL
  targetArea      text NOT NULL
  difficulty      enum('beginner', 'intermediate', 'advanced')
  videoUrl        text                         -- link to demo video

analysis_player_stats
  id              serial PK
  playerId        integer FK -> players NOT NULL
  analysisId      integer FK -> analysis_reports NOT NULL
  reception       text
  attack          text
  blocking        text
  serving         text
  setting         text
  defense         text
  overallRating   decimal(3,1)

// ==================== RANKINGS & STANDINGS ====================

standings
  id              serial PK
  teamId          integer FK -> teams NOT NULL
  seasonId        integer FK -> seasons NOT NULL
  wins            integer DEFAULT 0
  losses          integer DEFAULT 0
  setsWon         integer DEFAULT 0
  setsLost        integer DEFAULT 0
  pointsScored    integer DEFAULT 0
  pointsAllowed   integer DEFAULT 0
  winPercentage   decimal(5,4) DEFAULT 0
  rankInDivision  integer
  rankInAgeGroup  integer
  lastUpdated     timestamp
  UNIQUE(teamId, seasonId)

// ==================== NOTIFICATIONS ====================

notifications
  id              serial PK
  userId          uuid FK -> users NOT NULL
  type            enum('game_reminder', 'score_update', 'stream_live',
                       'analysis_ready', 'team_update', 'club_news')
  title           text NOT NULL
  body            text NOT NULL
  data            jsonb                        -- deep link params
  isRead          boolean DEFAULT false
  createdAt       timestamp

push_tokens
  id              serial PK
  userId          uuid FK -> users NOT NULL
  token           text NOT NULL
  platform        enum('ios', 'android', 'web')
  isActive        boolean DEFAULT true
  createdAt       timestamp
```

---

## PART 3: AI AGENT ORCHESTRATION SYSTEM

### Architecture: Hub-and-Spoke with Orchestrator

```
                         ┌─────────────────┐
                         │   ORCHESTRATOR   │
                         │  (Master Agent)  │
                         └────────┬────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              │                   │                   │
     ┌────────▼────────┐ ┌───────▼───────┐ ┌────────▼────────┐
     │  VIDEO ANALYSIS  │ │   COACHING    │ │   LIVE GAME     │
     │     AGENT        │ │    AGENT      │ │     AGENT       │
     └────────┬────────┘ └───────┬───────┘ └────────┬────────┘
              │                   │                   │
    ┌─────────┼──────┐     ┌─────┼─────┐      ┌─────┼─────┐
    │         │      │     │     │     │      │     │     │
  Play    Error  Player  Drill Train  Skill  Score  Stat  Play
  Detect  Detect Track   Gen   Plan   Assess Track  Calc  byPlay
```

### The Orchestrator

```typescript
// packages/agents/orchestrator.ts
//
// The Orchestrator is the brain. It receives high-level tasks,
// decomposes them into subtasks, routes to specialist agents,
// aggregates results, and returns unified responses.
//
// Key capabilities:
// 1. Task decomposition - breaks "analyze this video" into 5+ subtasks
// 2. Agent routing - knows which agent handles what
// 3. Parallel execution - runs independent subtasks concurrently
// 4. Result aggregation - merges agent outputs into coherent response
// 5. Context management - maintains conversation state across agents
// 6. Tier gating - enforces subscription limits before routing

interface OrchestratorTask {
  id: string;
  type: 'video_analysis' | 'coaching_plan' | 'live_game' | 'stats_query' |
        'player_assessment' | 'tournament_bracket' | 'training_schedule';
  userId: string;
  tier: SubscriptionTier;
  payload: Record<string, any>;
  priority: 'low' | 'normal' | 'high' | 'critical';
}

interface AgentResult {
  agentId: string;
  taskId: string;
  status: 'success' | 'partial' | 'failed';
  data: any;
  confidence: number;      // 0-1 how confident the agent is
  processingTime: number;  // ms
}
```

### Agent Definitions

**1. Video Analysis Agent** (evolved from existing `gemini-video-analyzer.ts`)
```
INPUT:  GCS video URL, analysis config, user tier
OUTPUT: Complete analysis report with errors, player stats, scoring

Sub-agents:
├── Play Detection    → Identifies every rally, serve, rotation
├── Error Detection   → Technical mistakes with timestamps + severity
├── Player Tracking   → Identifies players, tracks movement patterns
├── Score Counter     → Counts points, tracks set progression
└── Highlight Maker   → Extracts key moments for clips (PRO only)

FLOW:
1. Orchestrator sends video URL + config
2. Video Agent checks tier (PRO required for full analysis)
3. Sends video to Gemini with volleyball-specific prompt
4. Parses response into structured data
5. Runs sub-agents in parallel for detailed breakdowns
6. Aggregates into AnalysisReport + streams progress via WebSocket
```

**2. Coaching Agent** (evolved from existing `exercise-agent.ts`)
```
INPUT:  Analysis report, player profiles, team history
OUTPUT: Personalized training plans, drills, progression paths

Sub-agents:
├── Drill Generator   → Creates targeted drills for each weakness
├── Training Planner  → Builds weekly/monthly practice schedules
├── Skill Assessor    → Rates players on 20+ volleyball skills
└── Progress Tracker  → Compares current vs. historical performance

FLOW:
1. Receives analysis data from Video Agent (via Orchestrator)
2. Cross-references with player history in database
3. Generates personalized recommendations per player
4. Creates team-wide training plan
5. Stores in database, notifies coach via push notification
```

**3. Live Game Agent** (NEW)
```
INPUT:  Real-time score updates, game events
OUTPUT: Live statistics, play-by-play, auto-rankings

Sub-agents:
├── Score Tracker     → Maintains live score state
├── Stat Calculator   → Real-time player/team statistics
├── Play-by-Play      → Generates text commentary
└── Rankings Updater  → Updates standings after game

FLOW:
1. Receives point-by-point data from scorekeepers
2. Score Tracker maintains game state
3. Stat Calculator computes running averages
4. Play-by-Play generates human-readable updates
5. WebSocket broadcasts to all viewers
6. On game end, Rankings Updater recalculates standings
```

**4. Stats Agent** (NEW)
```
INPUT:  Queries about rankings, player stats, team comparisons
OUTPUT: Computed statistics, rankings, trend analysis

Capabilities:
├── Elo-style ranking system for teams
├── Player comparison (side-by-side stats)
├── Season trend analysis
├── Head-to-head records
└── Age-group-specific leaderboards
```

**5. Notification Agent** (NEW)
```
INPUT:  System events (game starting, analysis ready, etc.)
OUTPUT: Push notifications, in-app alerts, email digests

Smart routing:
├── Urgent (game live, score updates) → Push immediately
├── Important (analysis ready) → Push + in-app
├── Normal (team update) → In-app + email digest
└── Low (weekly recap) → Email only
```

---

## PART 4: SUBSCRIPTION TIERS

### Tier Matrix

```
┌──────────────────────────────┬────────┬──────────┬─────────┬──────────┐
│ FEATURE                      │  FREE  │ STARTER  │   PRO   │   CLUB   │
│                              │  $0    │ $9.99/mo │$29.99/mo│$99.99/mo │
├──────────────────────────────┼────────┼──────────┼─────────┼──────────┤
│ View public club pages       │   ✅   │    ✅    │   ✅    │    ✅    │
│ View scores & standings      │   ✅   │    ✅    │   ✅    │    ✅    │
│ Basic calendar (view only)   │   ✅   │    ✅    │   ✅    │    ✅    │
│ Follow up to 3 teams         │   ✅   │    ✅    │   ✅    │    ✅    │
│ Watch live streams            │   ✅   │    ✅    │   ✅    │    ✅    │
├──────────────────────────────┼────────┼──────────┼─────────┼──────────┤
│ Create club page             │   ❌   │    ✅    │   ✅    │    ✅    │
│ Manage rosters (1 team)      │   ❌   │    ✅    │   ✅    │    ✅    │
│ Score tracking (manual)      │   ❌   │    ✅    │   ✅    │    ✅    │
│ Full calendar + reminders    │   ❌   │    ✅    │   ✅    │    ✅    │
│ Follow unlimited teams       │   ❌   │    ✅    │   ✅    │    ✅    │
│ Ad-free experience           │   ❌   │    ✅    │   ✅    │    ✅    │
│ RSVP & attendance tracking   │   ❌   │    ✅    │   ✅    │    ✅    │
├──────────────────────────────┼────────┼──────────┼─────────┼──────────┤
│ Live game streaming (GO LIVE)│   ❌   │    ❌    │   ✅    │    ✅    │
│ AI Coach - video analysis    │   ❌   │    ❌    │ 5/month │ Unlimited│
│ AI training plans            │   ❌   │    ❌    │   ✅    │    ✅    │
│ Player development tracking  │   ❌   │    ❌    │   ✅    │    ✅    │
│ Advanced analytics dashboard │   ❌   │    ❌    │   ✅    │    ✅    │
│ Video highlight clips        │   ❌   │    ❌    │   ✅    │    ✅    │
│ Manage up to 3 teams         │   ❌   │    ❌    │   ✅    │    ✅    │
├──────────────────────────────┼────────┼──────────┼─────────┼──────────┤
│ Unlimited teams              │   ❌   │    ❌    │   ❌    │    ✅    │
│ Tournament management        │   ❌   │    ❌    │   ❌    │    ✅    │
│ Custom club branding         │   ❌   │    ❌    │   ❌    │    ✅    │
│ Bulk video analysis          │   ❌   │    ❌    │   ❌    │    ✅    │
│ API access                   │   ❌   │    ❌    │   ❌    │    ✅    │
│ Priority support             │   ❌   │    ❌    │   ❌    │    ✅    │
│ White-label streaming page   │   ❌   │    ❌    │   ❌    │    ✅    │
│ Multi-admin club management  │   ❌   │    ❌    │   ❌    │    ✅    │
└──────────────────────────────┴────────┴──────────┴─────────┴──────────┘
```

### Tier Enforcement Architecture

```typescript
// Middleware: checks subscription before every gated action
// packages/api/src/middleware/tier-gate.ts

function requireTier(minimumTier: 'free' | 'starter' | 'pro' | 'club') {
  return async (req, res, next) => {
    const userTier = await getUserTier(req.userId);
    if (tierLevel(userTier) < tierLevel(minimumTier)) {
      return res.status(403).json({
        error: 'upgrade_required',
        requiredTier: minimumTier,
        currentTier: userTier,
        upgradeUrl: '/subscribe'
      });
    }
    next();
  };
}

// Usage in routes:
router.post('/streams', requireTier('pro'), createStream);
router.post('/analysis', requireTier('pro'), rateLimit('ai_analyses'), uploadVideo);
```

---

## PART 5: FEATURE DEEP DIVES

### Feature 1: Live Game Streaming

```
FLOW (Streamer/Coach):
1. Open app → Go to game → Tap "GO LIVE"
2. App requests Mux stream key via API
3. Camera opens with overlay showing: score, set, team names
4. Video streams via RTMP/SRT to Mux
5. Mux transcodes to HLS (adaptive bitrate)
6. Score overlay can be updated in real-time
7. After stream ends, VOD is automatically saved

FLOW (Viewer/Parent):
1. Open app → See "LIVE NOW" badge on game
2. Tap to watch → HLS player loads (2-5s latency)
3. See live score overlay
4. Can react (emoji reactions) and chat
5. After game, can rewatch as VOD

TECH:
- Mux handles all transcoding, CDN, adaptive bitrate
- WebSocket for real-time score overlay sync
- Expo Camera + expo-av for capture
- react-native-video for HLS playback
- Chat via Socket.IO rooms
```

### Feature 2: Club Pages & Team Branches

```
STRUCTURE:
Club Page (e.g., /club/miami-heat-vb)
├── Overview: Logo, banner, description, location, contact
├── Teams tab:
│   ├── 9U Girls Rec
│   │   ├── Coach: Sarah Johnson
│   │   ├── Record: 12-3
│   │   ├── Roster: 12 players with photos
│   │   └── Schedule: Next 5 games
│   ├── 10U Girls Club
│   ├── 12U Girls Elite
│   ├── 14U Boys Club
│   └── ... (all age groups)
├── Schedule tab: All upcoming games across all teams
├── Standings tab: Rankings by age group
├── Gallery: Photos and highlight videos
└── Contact / Join tab: Inquiry form

DYNAMIC ROUTING:
/club/[slug]                → Club overview
/club/[slug]/teams          → All teams
/club/[slug]/team/[teamId]  → Specific team page
/club/[slug]/roster/[teamId]→ Full roster with player cards
/club/[slug]/schedule       → Club-wide schedule
/club/[slug]/standings      → Club rankings
```

### Feature 3: Scoring & Rankings System

```
SCORING FLOW:
1. Scorekeeper opens game → "Start Scoring" button
2. Simple tap interface: [HOME +1] or [AWAY +1]
3. Optional: Select who scored and point type (kill, ace, block, error)
4. Auto-detects set transitions (25 points, win by 2)
5. Final set to 15 points
6. WebSocket broadcasts every point to all viewers
7. After game: auto-updates standings, rankings

RANKING ALGORITHM:
- Win percentage (primary)
- Sets won/lost ratio (tiebreaker 1)
- Points scored/allowed ratio (tiebreaker 2)
- Head-to-head record (tiebreaker 3)
- Rankings computed per: age group, division, region
- Cached in Redis, recalculated after every game
```

### Feature 4: Calendar System

```
FEATURES:
- Aggregates games from all followed teams
- Practice schedules from coaches
- Tournament dates
- Tryout announcements
- Custom personal events
- Push notification reminders (15min, 1hr, 1day before)
- RSVP for practices (coaches track attendance)
- Syncs with native iOS/Android calendar (optional)
- Color-coded by team/event type
- Month view, week view, day view, agenda view

OFFLINE SUPPORT:
- Calendar data cached in MMKV
- Works without internet
- Syncs when back online
```

### Feature 5: AI Coach (PRO Tier)

```
FULL ANALYSIS PIPELINE:
1. User uploads video (up to 15 min, up to 5GB)
2. GCS resumable upload with progress (KEEP existing)
3. Orchestrator receives task, decomposes:
   a. Video Agent → analyzes footage via Gemini
   b. Player Tracking → identifies and tracks each player
   c. Error Detection → finds technical mistakes
   d. Score Counter → tracks points if it's a game
4. Results aggregated into unified report
5. Coaching Agent generates:
   a. Personalized drills for each player's weaknesses
   b. Team-wide training plan for the week
   c. Priority improvement areas
6. Results delivered:
   a. Push notification: "Your analysis is ready!"
   b. In-app: Rich interactive report with video timestamps
   c. Shareable: Coach can share with team/parents
   d. Exportable: PDF report for printing

ANALYSIS REPORT SECTIONS:
├── Overview Score (0-100)
├── Play-by-Play Timeline (clickable timestamps)
├── Error Breakdown (by player, by category, by severity)
├── Player Report Cards (individual stats)
├── AI Coaching Tips (natural language advice)
├── Recommended Drills (with video demos)
├── Weekly Training Plan (calendar-ready)
└── Progress Comparison (vs. previous analyses)
```

---

## PART 6: IMPLEMENTATION PHASES

### Phase 1: Foundation (Weeks 1-3)
```
GOAL: Monorepo skeleton, auth, database, basic navigation

Tasks:
□ Initialize Turborepo monorepo structure
□ Set up Expo app with Expo Router
□ Implement NativeWind design system (colors, typography, spacing)
□ Set up Clerk authentication (sign up, login, OAuth)
□ Create complete Drizzle schema (all tables above)
□ Run initial migration on Neon PostgreSQL
□ Set up Redis (Upstash) for caching
□ Set up BullMQ for job processing
□ Create Express API with modular route structure
□ Implement tier middleware (subscription checking)
□ Set up Stripe integration (products, prices, webhook)
□ Build onboarding flow (role selection, profile setup)
□ Build bottom tab navigation shell

DELIVERABLE: App that boots, authenticates, and has empty tab screens
```

### Phase 2: Club & Team Management (Weeks 4-6)
```
GOAL: Full club/team CRUD, roster management, club discovery

Tasks:
□ Club creation flow (name, logo, colors, location)
□ Club page (public-facing, branded)
□ Team creation within club (age group, division, coach assignment)
□ Roster management (add/remove players, jersey numbers, positions)
□ Player profile cards
□ Club search & discovery feed
□ Club membership system (join requests, invitations)
□ Club admin dashboard (manage members, roles)

DELIVERABLE: Fully functional club pages with team branches and rosters
```

### Phase 3: Games & Scoring (Weeks 7-9)
```
GOAL: Schedule games, live scoring, standings

Tasks:
□ Game scheduling (home/away, venue, time)
□ Live scoring interface (tap-to-score, point attribution)
□ Real-time score broadcasting (WebSocket)
□ Set management (auto-transition, tiebreak rules)
□ Game detail page (live score view for spectators)
□ Standings calculation engine (Redis-cached)
□ Standings display by age group / division
□ Season management (create seasons, assign teams)
□ Game history & results archive
□ Tournament bracket system (basic)

DELIVERABLE: Complete game lifecycle from scheduling to standings
```

### Phase 4: Calendar (Weeks 10-11)
```
GOAL: Unified calendar across all followed teams

Tasks:
□ Calendar UI (month/week/day/agenda views)
□ Auto-populate from followed teams' games
□ Practice scheduling for coaches
□ Event creation (tryouts, meetings, custom)
□ RSVP system with attendance tracking
□ Push notification reminders
□ Offline calendar sync (MMKV cache)
□ Native calendar export (iOS/Android)

DELIVERABLE: Full calendar system with reminders and RSVP
```

### Phase 5: Live Streaming (Weeks 12-14)
```
GOAL: Go live from the app, watch live games

Tasks:
□ Mux integration (API keys, webhook handlers)
□ Stream creation flow (linked to game)
□ Camera capture with score overlay
□ RTMP streaming to Mux
□ HLS playback for viewers (react-native-video)
□ Live viewer count
□ "LIVE NOW" badges in feed and game list
□ VOD auto-save after stream ends
□ Live chat (Socket.IO rooms)
□ Stream quality settings (adaptive bitrate)

DELIVERABLE: End-to-end live streaming tied to games
```

### Phase 6: AI Coach (Weeks 15-18)
```
GOAL: Full AI analysis pipeline for PRO users

Tasks:
□ Port GCS resumable upload to React Native
□ Orchestrator agent system
□ Video Analysis Agent (Gemini integration - port existing)
□ Coaching Agent (exercise generation - port existing)
□ Analysis results UI (interactive report)
□ Player-specific report cards
□ Training plan generator
□ Drill library with instructions
□ Progress tracking (compare analyses over time)
□ Share analysis with team members
□ PDF export of analysis report
□ Tier gating (5/month for PRO, unlimited for CLUB)

DELIVERABLE: Complete AI coaching pipeline with reports
```

### Phase 7: Polish & Launch (Weeks 19-21)
```
GOAL: Production readiness

Tasks:
□ Performance optimization (lazy loading, image caching)
□ Offline mode (graceful degradation)
□ Error boundaries & crash reporting (Sentry)
□ Analytics integration (Mixpanel/PostHog)
□ App Store assets (screenshots, descriptions, keywords)
□ Play Store assets
□ Beta testing with 3-5 real volleyball clubs
□ Load testing (simulate 1000 concurrent users)
□ Security audit
□ COPPA compliance (minors in youth sports)
□ Privacy policy & terms of service
□ Launch marketing site (Next.js - web app)

DELIVERABLE: App Store + Play Store submission
```

---

## PART 7: KEY TECHNICAL DECISIONS

### 1. Why Expo over PWA?
- Native camera access is critical for live streaming
- Push notifications are 10x more reliable native
- App Store presence drives discovery in sports niche
- Offline calendar needs native storage
- Parents expect an "app" not a "website"

### 2. Why Mux for Streaming?
- Handles all transcoding, CDN, adaptive bitrate
- Simple API (create stream → get key → go live)
- Automatic VOD generation from live streams
- Usage-based pricing (pay per minute streamed)
- React Native SDK available

### 3. Why Clerk for Auth?
- Native mobile SDKs (Expo-compatible)
- Social login (Google, Apple) out of the box
- User management dashboard
- Webhook integration for user events
- Free tier covers early growth

### 4. Why Redis?
- Rankings must be fast (cached, not computed per request)
- Live scores need sub-50ms reads
- Session data for real-time features
- BullMQ requires Redis for job queues
- Upstash = serverless Redis (no ops)

### 5. Why Stripe?
- Industry standard for subscriptions
- Mobile-friendly checkout (Stripe SDK for React Native)
- Handles proration, upgrades, downgrades automatically
- Webhook-driven (subscription.updated, invoice.paid, etc.)
- Apple Pay / Google Pay support

### 6. Why Keep Gemini for AI?
- Already battle-tested in existing codebase
- Video understanding is Gemini 2.0 Flash's strength
- Cost-effective for video analysis
- 2M token context handles long videos
- Can upgrade to Gemini 2.0 Pro for deeper analysis

---

## PART 8: REAL-TIME ARCHITECTURE

```
                    ┌─────────────────────────┐
                    │      Mobile App          │
                    │   (Expo/React Native)    │
                    └────────┬───┬────────────┘
                             │   │
                     REST    │   │  WebSocket
                     API     │   │  (Socket.IO)
                             │   │
                    ┌────────▼───▼────────────┐
                    │     Express Server       │
                    │                          │
                    │  ┌────────┐ ┌─────────┐  │
                    │  │ Routes │ │ WS Rooms│  │
                    │  └───┬────┘ └────┬────┘  │
                    │      │           │       │
                    │  ┌───▼───────────▼───┐   │
                    │  │  Service Layer     │   │
                    │  └───┬───────────┬───┘   │
                    │      │           │       │
                    │  ┌───▼───┐   ┌───▼───┐   │
                    │  │Postgres│  │ Redis  │   │
                    │  └───────┘   └───────┘   │
                    │      │                   │
                    │  ┌───▼───────────────┐   │
                    │  │   BullMQ Jobs     │   │
                    │  │  (video process)  │   │
                    │  └──────────────────┘   │
                    └─────────────────────────┘

WebSocket Rooms:
- game:{gameId}      → live scores, play-by-play
- stream:{streamId}  → stream status, viewer count
- club:{clubId}      → club-wide announcements
- analysis:{videoId} → analysis progress updates
- user:{userId}      → personal notifications
```

---

## PART 9: FILE-BY-FILE BUILD ORDER (Phase 1 Kickoff)

When approved, implementation starts with:

```
1.  turbo.json + root package.json (monorepo config)
2.  packages/shared/schema.ts (complete Drizzle schema)
3.  packages/shared/types.ts (shared TypeScript types)
4.  packages/shared/constants.ts (tiers, limits, enums)
5.  packages/api/src/index.ts (Express server entry)
6.  packages/api/src/lib/db.ts (Drizzle + Neon connection)
7.  packages/api/src/lib/redis.ts (Upstash Redis client)
8.  packages/api/src/lib/stripe.ts (Stripe client + webhook)
9.  packages/api/src/middleware/auth.ts (Clerk middleware)
10. packages/api/src/middleware/tier-gate.ts (subscription checks)
11. apps/mobile/app/_layout.tsx (Expo Router root layout)
12. apps/mobile/app/(auth)/login.tsx (authentication)
13. apps/mobile/app/(tabs)/_layout.tsx (bottom tab navigator)
14. apps/mobile/components/ui/ (design system primitives)
15. docker-compose.yml (local Postgres + Redis)
```

---

## SUMMARY

This is not just a volleyball app. This is the **infrastructure layer for competitive volleyball** — the platform where clubs live, parents watch, coaches analyze, and players grow.

**What exists today:** A video analysis tool.
**What we're building:** The volleyball operating system.

| Dimension         | Current App           | New Platform                    |
|-------------------|-----------------------|---------------------------------|
| Users             | Single user           | Multi-tenant (clubs, teams)     |
| Features          | Video analysis only   | Full ecosystem (7 major modules)|
| Mobile            | Mobile-responsive web | Native iOS + Android            |
| Real-time         | Analysis progress     | Live scores, streams, chat      |
| Monetization      | None                  | 4-tier subscription             |
| AI                | Video analysis        | Orchestrated multi-agent system |
| Scale             | Single server         | Distributed (Redis, queues)     |
| Data              | 6 tables              | 25+ tables                      |

**Estimated timeline:** 21 weeks to App Store submission.
**Reuse from existing:** ~40% of backend logic (agents, GCS, Gemini, WebSocket patterns).
**Complete rebuild:** Frontend (Expo native), database schema, auth, payments, streaming.
