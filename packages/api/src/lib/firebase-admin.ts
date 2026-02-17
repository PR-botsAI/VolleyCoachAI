import admin from "firebase-admin";
import type { DecodedIdToken } from "firebase-admin/auth";

/**
 * Firebase Admin SDK initialization.
 *
 * Initializes from FIREBASE_SERVICE_ACCOUNT_JSON env var (a JSON string of
 * the service account key). Falls back to Application Default Credentials
 * if the env var is not set.
 */

let firebaseApp: admin.app.App;

try {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (serviceAccountJson) {
    const serviceAccount = JSON.parse(serviceAccountJson);
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id ?? process.env.FIREBASE_PROJECT_ID,
    });
    console.log("[Firebase Admin] Initialized with service account credentials.");
  } else if (process.env.FIREBASE_PROJECT_ID) {
    // Try Application Default Credentials with explicit project ID
    firebaseApp = admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: process.env.FIREBASE_PROJECT_ID,
    });
    console.log("[Firebase Admin] Initialized with application default credentials.");
  } else {
    // Graceful fallback: initialize without credentials (will fail on token verification)
    firebaseApp = admin.initializeApp();
    console.warn(
      "[Firebase Admin] WARNING: No Firebase credentials configured. " +
      "Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_PROJECT_ID env var. " +
      "Token verification will fail in production."
    );
  }
} catch (error) {
  console.error("[Firebase Admin] Failed to initialize:", error);
  // Initialize with defaults so the app can still start
  firebaseApp = admin.initializeApp();
  console.warn("[Firebase Admin] Falling back to default initialization.");
}

/**
 * Firebase Auth instance for verifying ID tokens.
 */
export const firebaseAuth = admin.auth(firebaseApp);

/**
 * Verify a Firebase ID token and return the decoded claims.
 * Returns null if the token is invalid or expired.
 */
export async function verifyIdToken(
  idToken: string
): Promise<DecodedIdToken | null> {
  try {
    const decodedToken = await firebaseAuth.verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    console.error("[Firebase Admin] Token verification failed:", error);
    return null;
  }
}

export { firebaseApp };
export default admin;
