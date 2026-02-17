import { create } from "zustand";
import { createJSONStorage, persist, StateStorage } from "zustand/middleware";
import * as SecureStore from "expo-secure-store";
import type { AuthUser, AuthSession } from "@volleycoach/shared";
import type { TierKey } from "@volleycoach/shared";

const secureStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(name);
    } catch {
      return null;
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(name, value);
    } catch {
      // SecureStore may fail in some environments
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(name);
    } catch {
      // Silently fail
    }
  },
};

interface SubscriptionState {
  tier: TierKey;
  status: string;
  aiAnalysesUsed: number;
  aiAnalysesLimit: number;
  currentPeriodEnd: string | null;
}

interface AuthState {
  user: AuthUser | null;
  firebaseIdToken: string | null;
  subscription: SubscriptionState;
  isLoading: boolean;
  isHydrated: boolean;

  // Computed
  isAuthenticated: boolean;

  // Actions
  login: (session: AuthSession, firebaseIdToken: string) => void;
  logout: () => void;
  setUser: (user: AuthUser) => void;
  setFirebaseIdToken: (token: string | null) => void;
  setSubscription: (subscription: SubscriptionState) => void;
  setLoading: (loading: boolean) => void;
  setHydrated: (hydrated: boolean) => void;
  updateProfile: (updates: Partial<AuthUser>) => void;
}

const initialSubscription: SubscriptionState = {
  tier: "free",
  status: "active",
  aiAnalysesUsed: 0,
  aiAnalysesLimit: 0,
  currentPeriodEnd: null,
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      firebaseIdToken: null,
      subscription: initialSubscription,
      isLoading: true,
      isHydrated: false,

      get isAuthenticated() {
        return get().user !== null && get().firebaseIdToken !== null;
      },

      login: (session: AuthSession, firebaseIdToken: string) => {
        set({
          user: session.user,
          firebaseIdToken,
          subscription: {
            tier: session.subscription.tier,
            status: session.subscription.status,
            aiAnalysesUsed: session.subscription.aiAnalysesUsed,
            aiAnalysesLimit: session.subscription.aiAnalysesLimit,
            currentPeriodEnd: session.subscription.currentPeriodEnd,
          },
          isLoading: false,
        });
      },

      logout: () => {
        set({
          user: null,
          firebaseIdToken: null,
          subscription: initialSubscription,
          isLoading: false,
        });
      },

      setUser: (user: AuthUser) => {
        set({ user });
      },

      setFirebaseIdToken: (token: string | null) => {
        set({ firebaseIdToken: token });
      },

      setSubscription: (subscription: SubscriptionState) => {
        set({ subscription });
      },

      setLoading: (isLoading: boolean) => {
        set({ isLoading });
      },

      setHydrated: (isHydrated: boolean) => {
        set({ isHydrated });
      },

      updateProfile: (updates: Partial<AuthUser>) => {
        const current = get().user;
        if (current) {
          set({ user: { ...current, ...updates } });
        }
      },
    }),
    {
      name: "volleycoach-auth",
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({
        user: state.user,
        firebaseIdToken: state.firebaseIdToken,
        subscription: state.subscription,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
        state?.setLoading(false);
      },
    }
  )
);
