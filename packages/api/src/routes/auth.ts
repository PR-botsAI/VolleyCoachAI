import { Router, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../lib/db.js";
import { users, subscriptions, onboardingSchema } from "@volleycoach/shared";
import { requireAuth } from "../middleware/auth.js";
import { verifyIdToken } from "../lib/firebase-admin.js";
import type { ApiResponse, AuthSession } from "@volleycoach/shared";

const router = Router();

/**
 * POST /api/auth/register
 * After Firebase creates the user on the client side, this endpoint
 * creates the corresponding DB record. Expects a valid Firebase ID token.
 */
router.post("/api/auth/register", async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Missing Firebase ID token." },
      } satisfies ApiResponse);
      return;
    }

    const idToken = authHeader.split(" ")[1];
    const decodedToken = await verifyIdToken(idToken);

    if (!decodedToken) {
      res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Invalid Firebase ID token." },
      } satisfies ApiResponse);
      return;
    }

    const { uid, email, name, picture } = decodedToken;
    const { fullName, phone, role } = req.body;

    // Check if user already exists
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.firebaseUid, uid))
      .limit(1);

    if (existing.length > 0) {
      res.status(409).json({
        success: false,
        error: { code: "USER_EXISTS", message: "User already registered." },
      } satisfies ApiResponse);
      return;
    }

    // Insert user into database
    const [newUser] = await db
      .insert(users)
      .values({
        firebaseUid: uid,
        email: email ?? `${uid}@unknown.com`,
        fullName: fullName || name || "New User",
        avatarUrl: picture ?? null,
        phone: phone ?? null,
        role: role ?? "player",
        onboardingDone: false,
      })
      .returning();

    // Create free tier subscription for the new user
    await db.insert(subscriptions).values({
      userId: newUser.id,
      tier: "free",
      status: "active",
      aiAnalysesUsed: 0,
      aiAnalysesLimit: 0,
      cancelAtPeriodEnd: false,
    });

    // Fetch subscription for response
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, newUser.id))
      .limit(1);

    const session: AuthSession = {
      user: {
        id: newUser.id,
        firebaseUid: newUser.firebaseUid,
        email: newUser.email,
        fullName: newUser.fullName,
        avatarUrl: newUser.avatarUrl,
        role: newUser.role,
        tier: subscription?.tier ?? "free",
        onboardingDone: newUser.onboardingDone,
      },
      subscription: {
        tier: subscription?.tier ?? "free",
        status: subscription?.status ?? "active",
        aiAnalysesUsed: subscription?.aiAnalysesUsed ?? 0,
        aiAnalysesLimit: subscription?.aiAnalysesLimit ?? 0,
        currentPeriodEnd: subscription?.currentPeriodEnd?.toISOString() ?? null,
      },
    };

    console.log(`[Auth] User registered: ${newUser.id} (${newUser.email})`);

    res.status(201).json({
      success: true,
      data: session,
    } satisfies ApiResponse<AuthSession>);
  } catch (err) {
    console.error("[Auth] Error in /register:", err);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to register user." },
    } satisfies ApiResponse);
  }
});

/**
 * POST /api/auth/sync
 * Sync Firebase user data to local DB. Called after login to ensure the
 * local user record is up to date with Firebase profile data.
 */
router.post("/api/auth/sync", async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Missing Firebase ID token." },
      } satisfies ApiResponse);
      return;
    }

    const idToken = authHeader.split(" ")[1];
    const decodedToken = await verifyIdToken(idToken);

    if (!decodedToken) {
      res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Invalid Firebase ID token." },
      } satisfies ApiResponse);
      return;
    }

    const { uid, email, name, picture } = decodedToken;

    // Look up existing user
    let existingUsers = await db
      .select()
      .from(users)
      .where(eq(users.firebaseUid, uid))
      .limit(1);

    let user = existingUsers[0];

    if (!user) {
      // Auto-create user if they don't exist yet (e.g., first login via social provider)
      const [newUser] = await db
        .insert(users)
        .values({
          firebaseUid: uid,
          email: email ?? `${uid}@unknown.com`,
          fullName: name || "New User",
          avatarUrl: picture ?? null,
          phone: null,
          role: "player",
          onboardingDone: false,
        })
        .returning();

      // Create free tier subscription
      await db.insert(subscriptions).values({
        userId: newUser.id,
        tier: "free",
        status: "active",
        aiAnalysesUsed: 0,
        aiAnalysesLimit: 0,
        cancelAtPeriodEnd: false,
      });

      user = newUser;
      console.log(`[Auth Sync] New user auto-created: ${user.id} (${email})`);
    } else {
      // Update user data from Firebase profile
      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
      };
      if (email) updateData.email = email;
      if (name) updateData.fullName = name;
      if (picture !== undefined) updateData.avatarUrl = picture;

      await db
        .update(users)
        .set(updateData)
        .where(eq(users.firebaseUid, uid));

      // Re-fetch updated user
      const [updated] = await db
        .select()
        .from(users)
        .where(eq(users.firebaseUid, uid))
        .limit(1);
      user = updated;

      console.log(`[Auth Sync] User synced: ${user.id} (${email})`);
    }

    // Fetch subscription
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, user.id))
      .limit(1);

    const session: AuthSession = {
      user: {
        id: user.id,
        firebaseUid: user.firebaseUid,
        email: user.email,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
        role: user.role,
        tier: subscription?.tier ?? "free",
        onboardingDone: user.onboardingDone,
      },
      subscription: {
        tier: subscription?.tier ?? "free",
        status: subscription?.status ?? "active",
        aiAnalysesUsed: subscription?.aiAnalysesUsed ?? 0,
        aiAnalysesLimit: subscription?.aiAnalysesLimit ?? 0,
        currentPeriodEnd: subscription?.currentPeriodEnd?.toISOString() ?? null,
      },
    };

    res.json({
      success: true,
      data: session,
    } satisfies ApiResponse<AuthSession>);
  } catch (err) {
    console.error("[Auth] Error in /sync:", err);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to sync user data." },
    } satisfies ApiResponse);
  }
});

/**
 * GET /api/auth/me
 * Get the current authenticated user along with their subscription details.
 * Requires a valid Firebase ID token.
 */
router.get(
  "/api/auth/me",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const user = req.user!;

      // Fetch full subscription details
      const subResult = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, user.id))
        .limit(1);

      const subscription = subResult[0];

      const session: AuthSession = {
        user,
        subscription: {
          tier: subscription?.tier ?? "free",
          status: subscription?.status ?? "active",
          aiAnalysesUsed: subscription?.aiAnalysesUsed ?? 0,
          aiAnalysesLimit: subscription?.aiAnalysesLimit ?? 0,
          currentPeriodEnd:
            subscription?.currentPeriodEnd?.toISOString() ?? null,
        },
      };

      res.json({
        success: true,
        data: session,
      } satisfies ApiResponse<AuthSession>);
    } catch (err) {
      console.error("[Auth] Error in /me:", err);
      res.status(500).json({
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to fetch user data." },
      } satisfies ApiResponse);
    }
  }
);

/**
 * POST /api/auth/onboarding
 * Complete user onboarding. Updates the user's role and marks onboarding as done.
 */
router.post(
  "/api/auth/onboarding",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const validation = onboardingSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid onboarding data.",
            details: validation.error.flatten(),
          },
        } satisfies ApiResponse);
        return;
      }

      const { role, fullName, phone } = validation.data;
      const user = req.user!;

      await db
        .update(users)
        .set({
          role,
          fullName,
          phone: phone ?? null,
          onboardingDone: true,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));

      // Fetch updated user
      const [updatedUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1);

      res.json({
        success: true,
        data: {
          id: updatedUser.id,
          firebaseUid: updatedUser.firebaseUid,
          email: updatedUser.email,
          fullName: updatedUser.fullName,
          avatarUrl: updatedUser.avatarUrl,
          role: updatedUser.role,
          tier: user.tier,
          onboardingDone: updatedUser.onboardingDone,
        },
      } satisfies ApiResponse);
    } catch (err) {
      console.error("[Auth] Error in onboarding:", err);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to complete onboarding.",
        },
      } satisfies ApiResponse);
    }
  }
);

export default router;
