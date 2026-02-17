import { Router, type Request, type Response } from "express";
import { eq, ilike, sql, and, count } from "drizzle-orm";
import { db } from "../lib/db.js";
import {
  clubs,
  clubMemberships,
  teams,
  users,
  standings,
  createClubSchema,
  updateClubSchema,
} from "@volleycoach/shared";
import type { ApiResponse, ClubWithTeams, TeamSummary } from "@volleycoach/shared";
import { requireAuth, optionalAuth } from "../middleware/auth.js";
import { requireTier } from "../middleware/tier-gate.js";
import { nanoid } from "nanoid";

const router = Router();

/**
 * Generate a URL-safe slug from a club name.
 */
function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
  return `${base}-${nanoid(6)}`;
}

/**
 * GET /api/clubs
 * List/search clubs (public). Supports ?search= query parameter.
 */
router.get("/api/clubs", optionalAuth, async (req: Request, res: Response) => {
  try {
    const { search, page = "1", limit = "20" } = req.query;
    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    let whereClause;
    if (search && typeof search === "string" && search.trim()) {
      whereClause = ilike(clubs.name, `%${search.trim()}%`);
    }

    const clubResults = await db
      .select()
      .from(clubs)
      .where(whereClause)
      .limit(limitNum)
      .offset(offset)
      .orderBy(clubs.name);

    // Get total count
    const [countResult] = await db
      .select({ total: count() })
      .from(clubs)
      .where(whereClause);
    const total = countResult?.total ?? 0;

    // Build club response with member counts and team summaries
    const clubsWithTeams: ClubWithTeams[] = await Promise.all(
      clubResults.map(async (club) => {
        const [memberCountResult] = await db
          .select({ total: count() })
          .from(clubMemberships)
          .where(eq(clubMemberships.clubId, club.id));

        const teamResults = await db
          .select()
          .from(teams)
          .where(eq(teams.clubId, club.id));

        const teamSummaries: TeamSummary[] = await Promise.all(
          teamResults.map(async (team) => {
            // Get head coach name
            let headCoachName: string | null = null;
            if (team.headCoachId) {
              const [coach] = await db
                .select({ fullName: users.fullName })
                .from(users)
                .where(eq(users.id, team.headCoachId))
                .limit(1);
              headCoachName = coach?.fullName ?? null;
            }

            // Get player count from roster
            const [rosterCount] = await db
              .select({ total: count() })
              .from(
                sql`team_rosters`
              )
              .where(sql`team_id = ${team.id}`);

            // Get win/loss record from standings
            const standingResult = await db
              .select()
              .from(standings)
              .where(eq(standings.teamId, team.id))
              .limit(1);

            const standing = standingResult[0];

            return {
              id: team.id,
              name: team.name,
              ageGroup: team.ageGroup,
              gender: team.gender,
              division: team.division,
              headCoachName,
              playerCount: Number(rosterCount?.total ?? 0),
              record: {
                wins: standing?.wins ?? 0,
                losses: standing?.losses ?? 0,
              },
            };
          })
        );

        return {
          id: club.id,
          name: club.name,
          slug: club.slug,
          description: club.description,
          logoUrl: club.logoUrl,
          bannerUrl: club.bannerUrl,
          city: club.city,
          state: club.state,
          primaryColor: club.primaryColor ?? "#6366f1",
          secondaryColor: club.secondaryColor ?? "#818cf8",
          isVerified: club.isVerified,
          memberCount: Number(memberCountResult?.total ?? 0),
          teams: teamSummaries,
        };
      })
    );

    res.json({
      success: true,
      data: clubsWithTeams,
      meta: {
        page: pageNum,
        limit: limitNum,
        total: Number(total),
        hasMore: offset + limitNum < Number(total),
      },
    } satisfies ApiResponse<ClubWithTeams[]>);
  } catch (err) {
    console.error("[Clubs] Error listing clubs:", err);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to list clubs." },
    } satisfies ApiResponse);
  }
});

/**
 * GET /api/clubs/:slug
 * Get a single club by its slug, including teams (public).
 */
router.get(
  "/api/clubs/:slug",
  optionalAuth,
  async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;

      const [club] = await db
        .select()
        .from(clubs)
        .where(eq(clubs.slug, slug))
        .limit(1);

      if (!club) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Club not found." },
        } satisfies ApiResponse);
        return;
      }

      const [memberCountResult] = await db
        .select({ total: count() })
        .from(clubMemberships)
        .where(eq(clubMemberships.clubId, club.id));

      const teamResults = await db
        .select()
        .from(teams)
        .where(eq(teams.clubId, club.id));

      const teamSummaries: TeamSummary[] = await Promise.all(
        teamResults.map(async (team) => {
          let headCoachName: string | null = null;
          if (team.headCoachId) {
            const [coach] = await db
              .select({ fullName: users.fullName })
              .from(users)
              .where(eq(users.id, team.headCoachId))
              .limit(1);
            headCoachName = coach?.fullName ?? null;
          }

          const [rosterCount] = await db
            .select({ total: count() })
            .from(sql`team_rosters`)
            .where(sql`team_id = ${team.id}`);

          const standingResult = await db
            .select()
            .from(standings)
            .where(eq(standings.teamId, team.id))
            .limit(1);
          const standing = standingResult[0];

          return {
            id: team.id,
            name: team.name,
            ageGroup: team.ageGroup,
            gender: team.gender,
            division: team.division,
            headCoachName,
            playerCount: Number(rosterCount?.total ?? 0),
            record: {
              wins: standing?.wins ?? 0,
              losses: standing?.losses ?? 0,
            },
          };
        })
      );

      const result: ClubWithTeams = {
        id: club.id,
        name: club.name,
        slug: club.slug,
        description: club.description,
        logoUrl: club.logoUrl,
        bannerUrl: club.bannerUrl,
        city: club.city,
        state: club.state,
        primaryColor: club.primaryColor ?? "#6366f1",
        secondaryColor: club.secondaryColor ?? "#818cf8",
        isVerified: club.isVerified,
        memberCount: Number(memberCountResult?.total ?? 0),
        teams: teamSummaries,
      };

      res.json({ success: true, data: result } satisfies ApiResponse<ClubWithTeams>);
    } catch (err) {
      console.error("[Clubs] Error fetching club:", err);
      res.status(500).json({
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to fetch club." },
      } satisfies ApiResponse);
    }
  }
);

/**
 * POST /api/clubs
 * Create a new club. Requires starter tier or above.
 */
router.post(
  "/api/clubs",
  requireAuth,
  requireTier("starter"),
  async (req: Request, res: Response) => {
    try {
      const validation = createClubSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid club data.",
            details: validation.error.flatten(),
          },
        } satisfies ApiResponse);
        return;
      }

      const data = validation.data;
      const user = req.user!;
      const slug = generateSlug(data.name);

      const [newClub] = await db
        .insert(clubs)
        .values({
          name: data.name,
          slug,
          description: data.description ?? null,
          city: data.city,
          state: data.state,
          country: data.country,
          website: data.website || null,
          contactEmail: data.contactEmail || null,
          contactPhone: data.contactPhone ?? null,
          primaryColor: data.primaryColor,
          secondaryColor: data.secondaryColor,
          ownerId: user.id,
          isVerified: false,
        })
        .returning();

      // Add the creator as the club owner in memberships
      await db.insert(clubMemberships).values({
        clubId: newClub.id,
        userId: user.id,
        role: "owner",
      });

      res.status(201).json({
        success: true,
        data: newClub,
      } satisfies ApiResponse);
    } catch (err) {
      console.error("[Clubs] Error creating club:", err);
      res.status(500).json({
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to create club." },
      } satisfies ApiResponse);
    }
  }
);

/**
 * PUT /api/clubs/:id
 * Update a club. Only the owner or admin can update.
 */
router.put(
  "/api/clubs/:id",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const clubId = parseInt(req.params.id, 10);
      if (isNaN(clubId)) {
        res.status(400).json({
          success: false,
          error: { code: "INVALID_ID", message: "Invalid club ID." },
        } satisfies ApiResponse);
        return;
      }

      const user = req.user!;

      // Check ownership or admin role
      const [membership] = await db
        .select()
        .from(clubMemberships)
        .where(
          and(
            eq(clubMemberships.clubId, clubId),
            eq(clubMemberships.userId, user.id)
          )
        )
        .limit(1);

      if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
        res.status(403).json({
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "You do not have permission to update this club.",
          },
        } satisfies ApiResponse);
        return;
      }

      const validation = updateClubSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid update data.",
            details: validation.error.flatten(),
          },
        } satisfies ApiResponse);
        return;
      }

      const updateData: Record<string, unknown> = {
        ...validation.data,
        updatedAt: new Date(),
      };

      // Replace empty strings with null for optional URL fields
      if (updateData.website === "") updateData.website = null;
      if (updateData.contactEmail === "") updateData.contactEmail = null;

      const [updated] = await db
        .update(clubs)
        .set(updateData)
        .where(eq(clubs.id, clubId))
        .returning();

      if (!updated) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Club not found." },
        } satisfies ApiResponse);
        return;
      }

      res.json({ success: true, data: updated } satisfies ApiResponse);
    } catch (err) {
      console.error("[Clubs] Error updating club:", err);
      res.status(500).json({
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to update club." },
      } satisfies ApiResponse);
    }
  }
);

/**
 * POST /api/clubs/:id/join
 * Request to join a club. Adds user as a "fan" member.
 */
router.post(
  "/api/clubs/:id/join",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const clubId = parseInt(req.params.id, 10);
      if (isNaN(clubId)) {
        res.status(400).json({
          success: false,
          error: { code: "INVALID_ID", message: "Invalid club ID." },
        } satisfies ApiResponse);
        return;
      }

      const user = req.user!;

      // Check the club exists
      const [club] = await db
        .select()
        .from(clubs)
        .where(eq(clubs.id, clubId))
        .limit(1);

      if (!club) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Club not found." },
        } satisfies ApiResponse);
        return;
      }

      // Check if already a member
      const [existing] = await db
        .select()
        .from(clubMemberships)
        .where(
          and(
            eq(clubMemberships.clubId, clubId),
            eq(clubMemberships.userId, user.id)
          )
        )
        .limit(1);

      if (existing) {
        res.status(409).json({
          success: false,
          error: {
            code: "ALREADY_MEMBER",
            message: "You are already a member of this club.",
          },
        } satisfies ApiResponse);
        return;
      }

      const [membership] = await db
        .insert(clubMemberships)
        .values({
          clubId,
          userId: user.id,
          role: "fan",
        })
        .returning();

      res.status(201).json({
        success: true,
        data: membership,
      } satisfies ApiResponse);
    } catch (err) {
      console.error("[Clubs] Error joining club:", err);
      res.status(500).json({
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to join club." },
      } satisfies ApiResponse);
    }
  }
);

/**
 * GET /api/clubs/:id/members
 * List all members of a club.
 */
router.get(
  "/api/clubs/:id/members",
  optionalAuth,
  async (req: Request, res: Response) => {
    try {
      const clubId = parseInt(req.params.id, 10);
      if (isNaN(clubId)) {
        res.status(400).json({
          success: false,
          error: { code: "INVALID_ID", message: "Invalid club ID." },
        } satisfies ApiResponse);
        return;
      }

      const memberships = await db
        .select({
          id: clubMemberships.id,
          role: clubMemberships.role,
          joinedAt: clubMemberships.joinedAt,
          userId: users.id,
          fullName: users.fullName,
          avatarUrl: users.avatarUrl,
          email: users.email,
        })
        .from(clubMemberships)
        .innerJoin(users, eq(clubMemberships.userId, users.id))
        .where(eq(clubMemberships.clubId, clubId))
        .orderBy(clubMemberships.joinedAt);

      res.json({
        success: true,
        data: memberships,
      } satisfies ApiResponse);
    } catch (err) {
      console.error("[Clubs] Error listing members:", err);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to list club members.",
        },
      } satisfies ApiResponse);
    }
  }
);

export default router;
