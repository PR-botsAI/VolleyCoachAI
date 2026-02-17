import { useCallback, useEffect, useMemo } from "react";
import { useRouter } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { useAuthStore } from "../stores/auth";
import { api } from "../services/api";
import { wsService } from "../services/websocket";
import {
  signInWithEmail,
  signUpWithEmail,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  getIdToken,
} from "../services/firebase";
import type { AuthSession } from "@volleycoach/shared";

interface LoginCredentials {
  email: string;
  password: string;
}

interface RegisterCredentials {
  email: string;
  fullName: string;
  password: string;
  role: "player" | "coach" | "parent" | "club_admin";
}

export function useAuth() {
  const router = useRouter();
  const {
    user,
    firebaseIdToken,
    subscription,
    isLoading,
    isHydrated,
    login: storeLogin,
    logout: storeLogout,
    setFirebaseIdToken,
    setLoading,
  } = useAuthStore();

  const isAuthenticated = useMemo(
    () => user !== null && firebaseIdToken !== null,
    [user, firebaseIdToken]
  );

  /**
   * Listen to Firebase auth state changes.
   * On sign-in, sync with the backend. On sign-out, clear the store.
   */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const idToken = await firebaseUser.getIdToken();
          setFirebaseIdToken(idToken);

          // Sync user data with the backend
          const response = await api.post<AuthSession>("/auth/sync");
          if (response.data) {
            storeLogin(response.data, idToken);
          }

          wsService.connect();
        } catch (err) {
          console.error("[useAuth] Failed to sync with backend:", err);
        }
      } else {
        storeLogout();
      }
      setLoading(false);
    });

    return unsubscribe;
  }, [storeLogin, storeLogout, setFirebaseIdToken, setLoading]);

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginCredentials) => {
      // Sign in with Firebase
      const firebaseUser = await signInWithEmail(
        credentials.email,
        credentials.password
      );

      // Get the ID token
      const idToken = await firebaseUser.getIdToken();

      // Sync with backend (this creates/updates the DB record)
      const response = await api.post<AuthSession>("/auth/sync");
      return { session: response.data!, idToken };
    },
    onSuccess: ({ session, idToken }) => {
      storeLogin(session, idToken);
      wsService.connect();

      if (!session.user.onboardingDone) {
        router.replace("/(auth)/onboarding");
      } else {
        router.replace("/(tabs)/home");
      }
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: RegisterCredentials) => {
      // Create account in Firebase
      const firebaseUser = await signUpWithEmail(
        credentials.email,
        credentials.password,
        credentials.fullName
      );

      // Get the ID token
      const idToken = await firebaseUser.getIdToken();

      // Register with backend (creates the DB record)
      const response = await api.post<AuthSession>("/auth/register", {
        fullName: credentials.fullName,
        role: credentials.role,
      });
      return { session: response.data!, idToken };
    },
    onSuccess: ({ session, idToken }) => {
      storeLogin(session, idToken);
      wsService.connect();
      router.replace("/(auth)/onboarding");
    },
  });

  const logout = useCallback(async () => {
    try {
      await firebaseSignOut();
    } catch {
      // Continue with local logout even if Firebase sign-out fails
    }
    wsService.disconnect();
    storeLogout();
    router.replace("/(auth)/login");
  }, [storeLogout, router]);

  const loginWithEmail = useCallback(
    (credentials: LoginCredentials) => {
      loginMutation.mutate(credentials);
    },
    [loginMutation]
  );

  const registerWithEmail = useCallback(
    (credentials: RegisterCredentials) => {
      registerMutation.mutate(credentials);
    },
    [registerMutation]
  );

  /**
   * Refresh the Firebase ID token. Useful for forcing a token
   * refresh before making important API calls.
   */
  const refreshToken = useCallback(async () => {
    const newToken = await getIdToken(true);
    if (newToken) {
      setFirebaseIdToken(newToken);
    }
    return newToken;
  }, [setFirebaseIdToken]);

  return {
    user,
    subscription,
    isAuthenticated,
    isLoading,
    isHydrated,
    loginWithEmail,
    registerWithEmail,
    logout,
    refreshToken,
    loginError: loginMutation.error?.message ?? null,
    registerError: registerMutation.error?.message ?? null,
    isLoginLoading: loginMutation.isPending,
    isRegisterLoading: registerMutation.isPending,
  };
}
