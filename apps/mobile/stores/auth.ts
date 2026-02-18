import { create } from "zustand";
import { createJSONStorage, persist, StateStorage } from "zustand/middleware";
import { Platform } from "react-native";
import type { AuthUser, AuthSession } from "@volleycoach/shared";
import type { TierKey } from "@volleycoach/shared";

// Use localStorage on web, SecureStore on native
const webStorage: StateStorage = {
  getItem: (name: string) => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(name);
  },
  setItem: (name: string, value: string) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(name, value);
    }
  },
  removeItem: (name: string) => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(name);
    }
  },
};

async function getStorage(): Promise<StateStorage> {
  if (Platform.OS === "web") return webStorage;
  try {
    const SecureStore = await import("expo-secure-store");
    return {
      getItem: async (name: string) => {
        try { return await SecureStore.getItemAsync(name); } catch { return null; }
      },
      setItem: async (name: string, value: string) => {
        try { await SecureStore.setItemAsync(name, value); } catch {}
      },
      removeItem: async (name: string) => {
        try { await SecureStore.deleteItemAsync(name); } catch {}
      },
    };
  } catch {
    return webStorage;
  }
}

const storageAdapter: StateStorage = Platform.OS === "web" ? webStorage : {
  getItem: async (name: string) => {
    try {
      const SecureStore = require("expo-secure-store");
      return await SecureStore.getItemAsync(name);
    } catch { return null; }
  },
  setItem: async (name: string, value: string) => {
    try {
      const SecureStore = require("expo-secure-store");
      await SecureStore.setItemAsync(name, value);
    } catch {}
  },
  removeItem: async (name: string) => {
    try {
      const SecureStore = require("expo-secure-store");
      await SecureStore.deleteItemAsync(name);
    } catch {}
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
      storage: createJSONStorage(() => storageAdapter),
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
