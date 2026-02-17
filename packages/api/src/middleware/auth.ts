import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db } from "../lib/db.js";
import { users, subscriptions } from "@volleycoach/shared";
import type { AuthUser } from "@volleycoach/shared";
import type { TierKey } from "@volleycoach/shared";
import { verifyIdToken } from "../lib/firebase-admin.js";

/**
 * Extend Express Request to include our user object.
 */
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Mock user for development mode. Used when no valid token is provided
 * and NODE_ENV is "development".
 */
const MOCK_DEV_USER: AuthUser = {
  id: "00000000-0000-0000-0000-000000000001",
  firebaseUid: "dev_firebase_user_001",
  email: "dev@volleycoach.ai",
  fullName: "Dev Coach",
  avatarUrl: null,
  role: "coach",
  tier: "pro" as TierKey,
  onboardingDone: true,
};

/**
 * Extract the Bearer token from the Authorization header.
 */
function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return null;
  return parts[1];
}

/**
 * Look up a user by their Firebase UID and attach subscription tier info.
 */
async function resolveUser(firebaseUid: string): Promise<AuthUser | null> {
  const result = await db
    .select()
    .from(users)
    .where(eq(users.firebaseUid, firebaseUid))
    .limit(1);

  if (result.length === 0) return null;

  const user = result[0];

  // Fetch subscription to determine tier
  const subResult = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, user.id))
    .limit(1);

  const subscription = subResult[0];
  const tier: TierKey = subscription?.tier ?? "free";

  return {
    id: user.id,
    firebaseUid: user.firebaseUid,
    email: user.email,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl,
    role: user.role,
    tier,
    onboardingDone: user.onboardingDone,
  };
}

/**
 * Required authentication middleware. Returns 401 if no valid user is found.
 * Verifies Firebase ID tokens via the Firebase Admin SDK.
 * In development mode, falls back to a mock user if no token is provided.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractToken(req);

    if (token) {
      // Verify the Firebase ID token
      const decodedToken = await verifyIdToken(token);

      if (decodedToken) {
        const user = await resolveUser(decodedToken.uid);
        if (user) {
          req.user = user;
          next();
          return;
        }
      }
    }

    // Development fallback: use mock user
    if (process.env.NODE_ENV === "development") {
      req.user = MOCK_DEV_USER;
      next();
      return;
    }

    res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required. Provide a valid Firebase ID token.",
      },
    });
  } catch (err) {
    console.error("[Auth] Error in requireAuth middleware:", err);
    res.status(500).json({
      success: false,
      error: {
        code: "AUTH_ERROR",
        message: "An error occurred during authentication.",
      },
    });
  }
}

/**
 * Optional authentication middleware. Attaches user to request if a valid
 * Firebase ID token is present, but does not block the request if no token is found.
 */
export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractToken(req);

    if (token) {
      const decodedToken = await verifyIdToken(token);

      if (decodedToken) {
        const user = await resolveUser(decodedToken.uid);
        if (user) {
          req.user = user;
        }
      }
    } else if (process.env.NODE_ENV === "development") {
      req.user = MOCK_DEV_USER;
    }

    next();
  } catch (err) {
    // Don't fail the request on auth errors for optional auth
    console.error("[Auth] Error in optionalAuth middleware:", err);
    next();
  }
}
