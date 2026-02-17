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

/**
 * Firebase client configuration for the VolleyCoach mobile app.
 *
 * Uses the web Firebase SDK (firebase/app, firebase/auth) which works
 * in Expo Go without native modules. Config values are loaded from
 * EXPO_PUBLIC_* environment variables.
 */
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? "",
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID ?? "",
};

// Initialize Firebase (prevent re-initialization in hot reload)
let app: FirebaseApp;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

const auth: Auth = getAuth(app);

/**
 * Sign in with email and password.
 * Returns the Firebase User on success.
 */
export async function signInWithEmail(
  email: string,
  password: string
): Promise<User> {
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
