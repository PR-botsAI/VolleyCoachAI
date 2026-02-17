import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../lib/db";
import { standings, teams, clubs, seasons, games, sets } from "@volleycoach/shared/schema";
import type { StandingEntry } from "@volleycoach/shared/types";

/**
 * Recalculates standings for all teams in a season after a game ends.
 * Called by the game:end route handler.
 */
export async function recalculateStandings(
  seasonId: number,
  gameId: number
): Promise<void> {
  const game = await db.query.games.findFirst({
    where: eq(games.id, gameId),
    with: { sets: true },
  });

  if (!game || game.status !== "completed") return;

  const homeTeamId = game.homeTeamId;
  const awayTeamId = game.awayTeamId;

  const homeSetsWon = game.sets?.filter(
    (s) => s.winnerTeamId === homeTeamId
  ).length ?? 0;
  const awaySetsWon = game.sets?.filter(
    (s) => s.winnerTeamId === awayTeamId
  ).length ?? 0;

  const homePointsScored = game.sets?.reduce((sum, s) => sum + s.homePoints, 0) ?? 0;
  const awayPointsScored = game.sets?.reduce((sum, s) => sum + s.awayPoints, 0) ?? 0;

  const winnerId = game.winnerTeamId;

  // Update both teams' standings
  for (const teamId of [homeTeamId, awayTeamId]) {
    const isHome = teamId === homeTeamId;
    const won = teamId === winnerId;

    // Upsert standings record
    const existing = await db.query.standings.findFirst({
      where: and(
        eq(standings.teamId, teamId),
        eq(standings.seasonId, seasonId)
      ),
    });

    const setsWonDelta = isHome ? homeSetsWon : awaySetsWon;
    const setsLostDelta = isHome ? awaySetsWon : homeSetsWon;
    const pointsScoredDelta = isHome ? homePointsScored : awayPointsScored;
    const pointsAllowedDelta = isHome ? awayPointsScored : homePointsScored;

    if (existing) {
      const newWins = existing.wins + (won ? 1 : 0);
      const newLosses = existing.losses + (won ? 0 : 1);
      const totalGames = newWins + newLosses;
      const winPct = totalGames > 0 ? (newWins / totalGames).toFixed(4) : "0";

      await db
        .update(standings)
        .set({
          wins: newWins,
          losses: newLosses,
          setsWon: existing.setsWon + setsWonDelta,
          setsLost: existing.setsLost + setsLostDelta,
          pointsScored: existing.pointsScored + pointsScoredDelta,
          pointsAllowed: existing.pointsAllowed + pointsAllowedDelta,
          winPercentage: winPct,
          lastUpdated: new Date(),
        })
        .where(eq(standings.id, existing.id));
    } else {
      const winPct = won ? "1.0000" : "0.0000";
      await db.insert(standings).values({
        teamId,
        seasonId,
        wins: won ? 1 : 0,
        losses: won ? 0 : 1,
        setsWon: setsWonDelta,
        setsLost: setsLostDelta,
        pointsScored: pointsScoredDelta,
        pointsAllowed: pointsAllowedDelta,
        winPercentage: winPct,
      });
    }
  }

  // Recalculate ranks within age groups for the season
  await recalculateRanks(seasonId);
}

/**
 * Recalculates rank positions within each age group for a season.
 */
async function recalculateRanks(seasonId: number): Promise<void> {
  // Get all standings for this season, grouped by age group
  const allStandings = await db
    .select({
      standingId: standings.id,
      teamId: standings.teamId,
      ageGroup: teams.ageGroup,
      winPercentage: standings.winPercentage,
      setsWon: standings.setsWon,
      setsLost: standings.setsLost,
      pointsScored: standings.pointsScored,
      pointsAllowed: standings.pointsAllowed,
    })
    .from(standings)
    .innerJoin(teams, eq(standings.teamId, teams.id))
    .where(eq(standings.seasonId, seasonId))
    .orderBy(desc(standings.winPercentage));

  // Group by age group
  const byAgeGroup = new Map<string, typeof allStandings>();
  for (const row of allStandings) {
    const group = byAgeGroup.get(row.ageGroup) ?? [];
    group.push(row);
    byAgeGroup.set(row.ageGroup, group);
  }

  // Assign ranks within each age group
  for (const [ageGroup, group] of byAgeGroup) {
    // Sort by win percentage (desc), then set ratio (desc), then point ratio (desc)
    group.sort((a, b) => {
      const winPctDiff =
        parseFloat(b.winPercentage ?? "0") - parseFloat(a.winPercentage ?? "0");
      if (winPctDiff !== 0) return winPctDiff;

      const aSetRatio = a.setsLost > 0 ? a.setsWon / a.setsLost : a.setsWon;
      const bSetRatio = b.setsLost > 0 ? b.setsWon / b.setsLost : b.setsWon;
      if (bSetRatio !== aSetRatio) return bSetRatio - aSetRatio;

      const aPtRatio =
        a.pointsAllowed > 0 ? a.pointsScored / a.pointsAllowed : a.pointsScored;
      const bPtRatio =
        b.pointsAllowed > 0 ? b.pointsScored / b.pointsAllowed : b.pointsScored;
      return bPtRatio - aPtRatio;
    });

    for (let i = 0; i < group.length; i++) {
      await db
        .update(standings)
        .set({ rankInAgeGroup: i + 1 })
        .where(eq(standings.id, group[i].standingId));
    }
  }

  // Overall division ranks
  let overallRank = 1;
  for (const row of allStandings) {
    await db
      .update(standings)
      .set({ rankInDivision: overallRank++ })
      .where(eq(standings.id, row.standingId));
  }
}

/**
 * Get standings for display, with team and club info.
 */
export async function getStandings(
  seasonId: number,
  ageGroup?: string
): Promise<StandingEntry[]> {
  let query = db
    .select({
      teamId: standings.teamId,
      teamName: teams.name,
      clubName: clubs.name,
      ageGroup: teams.ageGroup,
      wins: standings.wins,
      losses: standings.losses,
      setsWon: standings.setsWon,
      setsLost: standings.setsLost,
      pointsScored: standings.pointsScored,
      pointsAllowed: standings.pointsAllowed,
      winPercentage: standings.winPercentage,
      rankInAgeGroup: standings.rankInAgeGroup,
    })
    .from(standings)
    .innerJoin(teams, eq(standings.teamId, teams.id))
    .innerJoin(clubs, eq(teams.clubId, clubs.id))
    .where(
      ageGroup
        ? and(eq(standings.seasonId, seasonId), eq(teams.ageGroup, ageGroup))
        : eq(standings.seasonId, seasonId)
    )
    .orderBy(desc(standings.winPercentage));

  const rows = await query;

  return rows.map((row, index) => ({
    rank: row.rankInAgeGroup ?? index + 1,
    teamId: row.teamId,
    teamName: row.teamName,
    clubName: row.clubName,
    ageGroup: row.ageGroup,
    wins: row.wins,
    losses: row.losses,
    setsWon: row.setsWon,
    setsLost: row.setsLost,
    pointsScored: row.pointsScored,
    pointsAllowed: row.pointsAllowed,
    winPercentage: parseFloat(row.winPercentage ?? "0"),
  }));
}
