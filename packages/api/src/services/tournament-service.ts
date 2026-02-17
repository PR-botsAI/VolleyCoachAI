import { eq, and, sql, desc } from "drizzle-orm";
import { db } from "../lib/db.js";
import {
  tournaments,
  tournamentTeams,
  games,
  teams,
  clubs,
} from "@volleycoach/shared";

// ── Types ──────────────────────────────────────────────────

interface PoolTeam {
  tournamentTeamId: number;
  teamId: number;
  teamName: string;
  clubName: string;
  poolName: string;
  seed: number | null;
}

interface PoolStanding {
  teamId: number;
  teamName: string;
  clubName: string;
  poolName: string;
  wins: number;
  losses: number;
  setsWon: number;
  setsLost: number;
  pointsScored: number;
  pointsAllowed: number;
  pointDifferential: number;
}

interface BracketMatch {
  gameId: number | null;
  round: number;
  matchNumber: number;
  homeTeamId: number | null;
  homeTeamName: string | null;
  awayTeamId: number | null;
  awayTeamName: string | null;
  winnerId: number | null;
  status: string;
  homeScore: number;
  awayScore: number;
}

interface TournamentBracket {
  tournamentId: number;
  format: string;
  pools: Record<string, PoolStanding[]>;
  bracket: BracketMatch[];
}

// ── Pool Play Schedule Generation ──────────────────────────

/**
 * Generates a round-robin pool play schedule for a tournament.
 * Each team in a pool plays every other team in the same pool once.
 * Games are created in the database with the tournament's start date.
 */
export async function generatePoolPlaySchedule(
  tournamentId: number
): Promise<{ gamesCreated: number }> {
  // Fetch the tournament
  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .limit(1);

  if (!tournament) {
    throw new Error("Tournament not found");
  }

  if (tournament.status !== "registration") {
    throw new Error(
      "Pool play schedule can only be generated when tournament is in registration status"
    );
  }

  // Fetch all teams in the tournament, grouped by pool
  const tournamentTeamResults = await db
    .select({
      id: tournamentTeams.id,
      teamId: tournamentTeams.teamId,
      poolName: tournamentTeams.poolName,
      seed: tournamentTeams.seed,
    })
    .from(tournamentTeams)
    .where(eq(tournamentTeams.tournamentId, tournamentId));

  if (tournamentTeamResults.length < 2) {
    throw new Error(
      "At least 2 teams are required to generate a pool play schedule"
    );
  }

  // Group teams by pool
  const pools = new Map<string, typeof tournamentTeamResults>();
  for (const tt of tournamentTeamResults) {
    const poolName = tt.poolName ?? "A";
    const pool = pools.get(poolName) ?? [];
    pool.push(tt);
    pools.set(poolName, pool);
  }

  let gamesCreated = 0;
  const startDate = new Date(tournament.startDate + "T09:00:00Z");

  // Generate round-robin games within each pool
  for (const [poolName, poolTeams] of pools) {
    // Round-robin: every pair plays once
    for (let i = 0; i < poolTeams.length; i++) {
      for (let j = i + 1; j < poolTeams.length; j++) {
        const homeTeam = poolTeams[i];
        const awayTeam = poolTeams[j];

        // Stagger game times by 90 minutes
        const gameTime = new Date(
          startDate.getTime() + gamesCreated * 90 * 60 * 1000
        );

        await db.insert(games).values({
          homeTeamId: homeTeam.teamId,
          awayTeamId: awayTeam.teamId,
          tournamentId,
          venue: tournament.location,
          scheduledAt: gameTime,
          status: "scheduled",
          homeScore: 0,
          awayScore: 0,
          isPlayoff: false,
          notes: `Pool ${poolName}: ${poolName} play`,
        });

        gamesCreated++;
      }
    }
  }

  // Update tournament status to in_progress
  await db
    .update(tournaments)
    .set({ status: "in_progress" })
    .where(eq(tournaments.id, tournamentId));

  return { gamesCreated };
}

// ── Bracket Generation from Pool Results ───────────────────

/**
 * Generates a single-elimination bracket from completed pool play results.
 * Top teams from each pool advance to the elimination bracket.
 *
 * Seeding logic:
 * - For 2 pools: top 2 from each pool cross over (A1 vs B2, B1 vs A2)
 * - For 3+ pools: top teams ranked by record, then point differential
 */
export async function generateBracketFromPools(
  tournamentId: number
): Promise<{ bracketGames: number }> {
  // Fetch the tournament
  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .limit(1);

  if (!tournament) {
    throw new Error("Tournament not found");
  }

  if (tournament.status !== "in_progress") {
    throw new Error(
      "Bracket can only be generated when tournament is in progress"
    );
  }

  // Calculate pool standings from completed tournament games
  const tournamentGames = await db
    .select()
    .from(games)
    .where(
      and(
        eq(games.tournamentId, tournamentId),
        eq(games.status, "completed"),
        eq(games.isPlayoff, false)
      )
    );

  if (tournamentGames.length === 0) {
    throw new Error(
      "No completed pool play games found. Complete pool play before generating bracket."
    );
  }

  // Get tournament teams with pool assignments
  const ttResults = await db
    .select({
      teamId: tournamentTeams.teamId,
      poolName: tournamentTeams.poolName,
      teamName: teams.name,
      clubId: teams.clubId,
    })
    .from(tournamentTeams)
    .innerJoin(teams, eq(tournamentTeams.teamId, teams.id))
    .where(eq(tournamentTeams.tournamentId, tournamentId));

  // Build pool standings
  const standingsMap = new Map<
    number,
    {
      teamId: number;
      teamName: string;
      poolName: string;
      wins: number;
      losses: number;
      setsWon: number;
      setsLost: number;
      pointsScored: number;
      pointsAllowed: number;
    }
  >();

  for (const tt of ttResults) {
    standingsMap.set(tt.teamId, {
      teamId: tt.teamId,
      teamName: tt.teamName,
      poolName: tt.poolName ?? "A",
      wins: 0,
      losses: 0,
      setsWon: 0,
      setsLost: 0,
      pointsScored: 0,
      pointsAllowed: 0,
    });
  }

  // Tabulate results from each completed game
  for (const game of tournamentGames) {
    const homeStanding = standingsMap.get(game.homeTeamId);
    const awayStanding = standingsMap.get(game.awayTeamId);
    if (!homeStanding || !awayStanding) continue;

    homeStanding.setsWon += game.homeScore;
    homeStanding.setsLost += game.awayScore;
    awayStanding.setsWon += game.awayScore;
    awayStanding.setsLost += game.homeScore;

    if (game.winnerTeamId === game.homeTeamId) {
      homeStanding.wins++;
      awayStanding.losses++;
    } else if (game.winnerTeamId === game.awayTeamId) {
      awayStanding.wins++;
      homeStanding.losses++;
    }
  }

  // Group standings by pool and rank
  const poolStandings = new Map<string, typeof ttResults & { wins: number; losses: number; setsWon: number; setsLost: number }[]>();
  for (const standing of standingsMap.values()) {
    const pool = poolStandings.get(standing.poolName) ?? [];
    pool.push(standing);
    poolStandings.set(standing.poolName, pool);
  }

  // Sort each pool by wins (desc), then set differential (desc), then point differential (desc)
  for (const [poolName, pool] of poolStandings) {
    pool.sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      const aSetDiff = a.setsWon - a.setsLost;
      const bSetDiff = b.setsWon - b.setsLost;
      if (bSetDiff !== aSetDiff) return bSetDiff - aSetDiff;
      const aPtDiff = a.pointsScored - a.pointsAllowed;
      const bPtDiff = b.pointsScored - b.pointsAllowed;
      return bPtDiff - aPtDiff;
    });
  }

  // Determine advancing teams based on pool count
  const poolNames = Array.from(poolStandings.keys()).sort();
  const advancingTeams: { teamId: number; seed: number; poolName: string }[] =
    [];

  if (poolNames.length === 2) {
    // Classic 2-pool crossover: A1 vs B2, B1 vs A2
    const poolA = poolStandings.get(poolNames[0]) ?? [];
    const poolB = poolStandings.get(poolNames[1]) ?? [];

    if (poolA.length >= 2 && poolB.length >= 2) {
      advancingTeams.push(
        { teamId: poolA[0].teamId, seed: 1, poolName: poolNames[0] },
        { teamId: poolB[0].teamId, seed: 2, poolName: poolNames[1] },
        { teamId: poolA[1].teamId, seed: 3, poolName: poolNames[0] },
        { teamId: poolB[1].teamId, seed: 4, poolName: poolNames[1] }
      );
    }
  } else {
    // For 1 or 3+ pools: take top teams overall, ranked across all pools
    const allTeams: (typeof standingsMap extends Map<number, infer V>
      ? V
      : never)[] = [];
    for (const standing of standingsMap.values()) {
      allTeams.push(standing);
    }

    allTeams.sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      const aSetDiff = a.setsWon - a.setsLost;
      const bSetDiff = b.setsWon - b.setsLost;
      if (bSetDiff !== aSetDiff) return bSetDiff - aSetDiff;
      const aPtDiff = a.pointsScored - a.pointsAllowed;
      const bPtDiff = b.pointsScored - b.pointsAllowed;
      return bPtDiff - aPtDiff;
    });

    // Take enough teams to fill a bracket (next power of 2 up to team count, min 4)
    const bracketSize = Math.min(
      nextPowerOf2(Math.min(allTeams.length, 8)),
      allTeams.length
    );
    for (let i = 0; i < bracketSize; i++) {
      advancingTeams.push({
        teamId: allTeams[i].teamId,
        seed: i + 1,
        poolName: allTeams[i].poolName,
      });
    }
  }

  if (advancingTeams.length < 2) {
    throw new Error(
      "Not enough teams with completed pool play to generate a bracket"
    );
  }

  // Build single-elimination bracket
  const bracketSize = nextPowerOf2(advancingTeams.length);
  const seeded = seedBracket(advancingTeams, bracketSize);

  let bracketGames = 0;
  const startDate = new Date(tournament.endDate + "T09:00:00Z");

  // Create first-round games
  for (let i = 0; i < seeded.length; i += 2) {
    const home = seeded[i];
    const away = seeded[i + 1];

    const gameTime = new Date(
      startDate.getTime() + bracketGames * 90 * 60 * 1000
    );

    // If one side is a bye (null), we skip creating a game
    if (home && away) {
      await db.insert(games).values({
        homeTeamId: home.teamId,
        awayTeamId: away.teamId,
        tournamentId,
        venue: tournament.location,
        scheduledAt: gameTime,
        status: "scheduled",
        homeScore: 0,
        awayScore: 0,
        isPlayoff: true,
        notes: `Elimination Round 1 - Match ${Math.floor(i / 2) + 1}`,
      });
      bracketGames++;
    }
  }

  // Pre-create placeholder games for subsequent rounds
  let currentRoundMatches = Math.floor(seeded.length / 2);
  let round = 2;

  while (currentRoundMatches > 1) {
    const nextRoundMatches = Math.floor(currentRoundMatches / 2);
    for (let m = 0; m < nextRoundMatches; m++) {
      const roundLabel =
        nextRoundMatches === 1
          ? "Championship"
          : nextRoundMatches === 2
            ? "Semifinal"
            : `Elimination Round ${round}`;

      const gameTime = new Date(
        startDate.getTime() + (bracketGames + m) * 90 * 60 * 1000
      );

      // Use a self-referencing placeholder: assign a dummy team that will be
      // updated when the feeder games complete. We pick the first advancing
      // team as a placeholder (it will be overwritten).
      // Note: We create these as scheduled games with TBD markers in notes.
      await db.insert(games).values({
        homeTeamId: advancingTeams[0].teamId,
        awayTeamId: advancingTeams[0].teamId,
        tournamentId,
        venue: tournament.location,
        scheduledAt: gameTime,
        status: "scheduled",
        homeScore: 0,
        awayScore: 0,
        isPlayoff: true,
        notes: `${roundLabel} - Match ${m + 1} (TBD)`,
      });
    }
    bracketGames += nextRoundMatches;
    currentRoundMatches = nextRoundMatches;
    round++;
  }

  return { bracketGames };
}

// ── Get Tournament Bracket ─────────────────────────────────

/**
 * Returns the complete bracket structure for a tournament, including
 * pool standings and elimination bracket games.
 */
export async function getTournamentBracket(
  tournamentId: number
): Promise<TournamentBracket> {
  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .limit(1);

  if (!tournament) {
    throw new Error("Tournament not found");
  }

  // Get tournament teams with pool info
  const ttResults = await db
    .select({
      teamId: tournamentTeams.teamId,
      poolName: tournamentTeams.poolName,
      seed: tournamentTeams.seed,
      teamName: teams.name,
      clubId: teams.clubId,
    })
    .from(tournamentTeams)
    .innerJoin(teams, eq(tournamentTeams.teamId, teams.id))
    .where(eq(tournamentTeams.tournamentId, tournamentId));

  // Get club names for teams
  const clubIds = [...new Set(ttResults.map((t) => t.clubId))];
  const clubMap = new Map<number, string>();
  for (const clubId of clubIds) {
    const [club] = await db
      .select({ id: clubs.id, name: clubs.name })
      .from(clubs)
      .where(eq(clubs.id, clubId))
      .limit(1);
    if (club) clubMap.set(club.id, club.name);
  }

  // Get all tournament games
  const tournamentGames = await db
    .select()
    .from(games)
    .where(eq(games.tournamentId, tournamentId))
    .orderBy(games.scheduledAt);

  // Separate pool play and bracket games
  const poolGames = tournamentGames.filter((g) => !g.isPlayoff);
  const bracketGames = tournamentGames.filter((g) => g.isPlayoff);

  // Calculate pool standings
  const standingsMap = new Map<number, PoolStanding>();
  for (const tt of ttResults) {
    standingsMap.set(tt.teamId, {
      teamId: tt.teamId,
      teamName: tt.teamName,
      clubName: clubMap.get(tt.clubId) ?? "Unknown",
      poolName: tt.poolName ?? "A",
      wins: 0,
      losses: 0,
      setsWon: 0,
      setsLost: 0,
      pointsScored: 0,
      pointsAllowed: 0,
      pointDifferential: 0,
    });
  }

  for (const game of poolGames) {
    if (game.status !== "completed") continue;

    const home = standingsMap.get(game.homeTeamId);
    const away = standingsMap.get(game.awayTeamId);
    if (!home || !away) continue;

    home.setsWon += game.homeScore;
    home.setsLost += game.awayScore;
    away.setsWon += game.awayScore;
    away.setsLost += game.homeScore;

    if (game.winnerTeamId === game.homeTeamId) {
      home.wins++;
      away.losses++;
    } else if (game.winnerTeamId === game.awayTeamId) {
      away.wins++;
      home.losses++;
    }
  }

  // Update point differentials
  for (const standing of standingsMap.values()) {
    standing.pointDifferential = standing.pointsScored - standing.pointsAllowed;
  }

  // Group into pools
  const pools: Record<string, PoolStanding[]> = {};
  for (const standing of standingsMap.values()) {
    if (!pools[standing.poolName]) {
      pools[standing.poolName] = [];
    }
    pools[standing.poolName].push(standing);
  }

  // Sort each pool
  for (const poolName of Object.keys(pools)) {
    pools[poolName].sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      const aSetDiff = a.setsWon - a.setsLost;
      const bSetDiff = b.setsWon - b.setsLost;
      if (bSetDiff !== aSetDiff) return bSetDiff - aSetDiff;
      return b.pointDifferential - a.pointDifferential;
    });
  }

  // Build team name lookup
  const teamNameMap = new Map<number, string>();
  for (const tt of ttResults) {
    teamNameMap.set(tt.teamId, tt.teamName);
  }

  // Build bracket match structure
  const bracket: BracketMatch[] = [];
  let round = 1;
  let matchInRound = 1;
  let prevScheduledAt: string | null = null;

  for (const game of bracketGames) {
    const currentScheduled = game.scheduledAt.toISOString();

    // Detect round transitions based on time gaps
    if (prevScheduledAt && currentScheduled > prevScheduledAt) {
      const prevTime = new Date(prevScheduledAt).getTime();
      const currTime = new Date(currentScheduled).getTime();
      // If there's more than 2 hours gap, consider it a new round
      if (currTime - prevTime > 2 * 60 * 60 * 1000) {
        round++;
        matchInRound = 1;
      }
    }

    bracket.push({
      gameId: game.id,
      round,
      matchNumber: matchInRound,
      homeTeamId: game.homeTeamId,
      homeTeamName: teamNameMap.get(game.homeTeamId) ?? null,
      awayTeamId: game.awayTeamId,
      awayTeamName: teamNameMap.get(game.awayTeamId) ?? null,
      winnerId: game.winnerTeamId,
      status: game.status,
      homeScore: game.homeScore,
      awayScore: game.awayScore,
    });

    matchInRound++;
    prevScheduledAt = currentScheduled;
  }

  return {
    tournamentId,
    format: tournament.format,
    pools,
    bracket,
  };
}

// ── Utility Functions ──────────────────────────────────────

/**
 * Returns the next power of 2 greater than or equal to n.
 */
function nextPowerOf2(n: number): number {
  if (n <= 1) return 2;
  let power = 2;
  while (power < n) {
    power *= 2;
  }
  return power;
}

/**
 * Seeds teams into a bracket using standard tournament seeding.
 * 1 vs last, 2 vs second-to-last, etc.
 * Returns an array where adjacent pairs represent matchups.
 */
function seedBracket(
  advancingTeams: { teamId: number; seed: number }[],
  bracketSize: number
): ({ teamId: number; seed: number } | null)[] {
  // Fill to bracket size with null (byes)
  const filledTeams: ({ teamId: number; seed: number } | null)[] = [
    ...advancingTeams,
  ];
  while (filledTeams.length < bracketSize) {
    filledTeams.push(null);
  }

  // Sort by seed
  filledTeams.sort((a, b) => {
    if (a === null && b === null) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return a.seed - b.seed;
  });

  // Standard tournament bracket seeding order for the given size
  const order = generateSeedOrder(bracketSize);
  const seeded: ({ teamId: number; seed: number } | null)[] = new Array(
    bracketSize
  ).fill(null);

  for (let i = 0; i < order.length; i++) {
    seeded[order[i]] = filledTeams[i] ?? null;
  }

  return seeded;
}

/**
 * Generates the standard seeding order for a bracket of the given size.
 * For a bracket of 4: [0, 3, 1, 2] (1v4, 2v3)
 * For a bracket of 8: [0, 7, 3, 4, 1, 6, 2, 5] (1v8, 4v5, 2v7, 3v6)
 */
function generateSeedOrder(size: number): number[] {
  if (size === 2) return [0, 1];

  const halfSize = size / 2;
  const firstHalf = generateSeedOrder(halfSize);

  const result: number[] = [];
  for (const pos of firstHalf) {
    result.push(pos * 2);
    result.push(size - 1 - pos * 2);
  }

  return result;
}
