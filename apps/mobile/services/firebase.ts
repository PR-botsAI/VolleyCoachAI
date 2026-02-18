import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  updateProfile,
  type Auth,
  type User,
  type Unsubscribe,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? "demo-key",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "demo.firebaseapp.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? "demo-project",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? "1:000:web:000",
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID ?? "",
};

// Initialize Firebase safely — app must render even without valid keys
let app: FirebaseApp;
let auth: Auth;
let firebaseReady = false;

try {
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }
  auth = getAuth(app);
  firebaseReady = true;
} catch (error) {
  console.warn("[Firebase] Init failed (no valid config):", error);
  // Create dummy objects so the app still renders
  app = {} as FirebaseApp;
  auth = {} as Auth;
}

/**
 * Sign in with email and password.
 * Returns the Firebase User on success.
 */
export async function signInWithEmail(
  email: string,
  password: string
): Promise<User> {
  if (!firebaseReady) throw new Error("Firebase not configured. Add your Firebase keys to .env");
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

/**
 * Create a new account with email and password.
 * Sets the display name on the Firebase user profile.
 * Returns the Firebase User on success.
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  fullName: string
): Promise<User> {
  const credential = await createUserWithEmailAndPassword(
    auth,
    email,
    password
  );
  // Set display name on Firebase profile
  await updateProfile(credential.user, { displayName: fullName });
  return credential.user;
}

/**
 * Sign out the current user.
 */
export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

/**
 * Subscribe to auth state changes.
 * Returns an unsubscribe function.
 */
export function onAuthStateChanged(
  callback: (user: User | null) => void
): Unsubscribe {
  if (!firebaseReady) {
    // If Firebase isn't configured, just call back with null (not logged in)
    setTimeout(() => callback(null), 0);
    return () => {};
  }
  return firebaseOnAuthStateChanged(auth, callback);
}

/**
 * Get the current user's Firebase ID token for API authentication.
 * Forces a refresh if forceRefresh is true.
 * Returns null if no user is signed in.
 */
export async function getIdToken(
  forceRefresh = false
): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken(forceRefresh);
}

/**
 * Get the current Firebase user.
 */
export function getCurrentUser(): User | null {
  return auth.currentUser;
}

export { app as firebaseApp, auth };
export type { User };
