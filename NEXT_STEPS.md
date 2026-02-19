# VolleyCoachAI — Path to Fully Operational App

## CURRENT STATUS

**What's built:** 99 source files — full backend (13 API routes, 4 AI agents, 5 services) + full mobile app (18 screens, 13 components).

**What's broken:** The app crashes on startup with "Attempted to navigate before mounting the Root Layout". The AuthGuard calls `router.replace()` before the Expo Router Stack has finished its first render.

**Root causes identified:**
1. AuthGuard navigates before Stack mounts (Expo Router requires navigation AFTER first render)
2. API base URL hardcoded to `localhost:3000` but API runs on `:3001`
3. WebSocket URL hardcoded to `localhost:3000`
4. Shared package barrel export may not resolve properly in Metro bundler
5. NativeWind className styles need `nativewind/babel` preset working correctly

---

## AGENT TASKS (Parallel Execution)

### AGENT 1: Fix Mobile App Critical Blockers
**Goal:** Get the app rendering the login screen on a real phone.

Files to fix:
- `apps/mobile/app/_layout.tsx` — Fix AuthGuard to wait for navigation mount before calling router.replace()
- `apps/mobile/services/api.ts` — Fix BASE_URL to use correct port (3001) and /api prefix
- `apps/mobile/services/websocket.ts` — Fix WS_URL to match API server
- `apps/mobile/stores/auth.ts` — Verify AsyncStorage hydration works
- `apps/mobile/hooks/useAuth.ts` — Verify Firebase auth flow is complete

Key fix for AuthGuard:
```tsx
function AuthGuard({ children }) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // Wait one frame for Stack to mount
    requestAnimationFrame(() => setIsMounted(true));
  }, []);

  useEffect(() => {
    if (!isMounted || !isHydrated) return;
    // THEN navigate
  }, [isMounted, isHydrated, user, segments]);

  return <>{children}</>;
}
```

### AGENT 2: Fix All Import Resolution Issues
**Goal:** Every import resolves correctly in Metro bundler.

- Audit every `from "@volleycoach/shared"` import across all mobile files
- Create `metro.config.js` with proper workspace resolution for pnpm monorepo
- Verify `@volleycoach/shared` barrel exports work (schema, types, constants, validation)
- Install any missing packages at the correct workspace level
- Ensure `firebase`, `@react-native-async-storage/async-storage` resolve from apps/mobile

### AGENT 3: Fix Shared Package for Metro Compatibility
**Goal:** The shared package exports work in Metro bundler.

- `packages/shared/src/validation.ts` — This file is imported but may be empty/missing
- `packages/shared/src/index.ts` — Verify barrel exports
- Ensure no Node.js-only imports (drizzle-orm pg-specific) leak into mobile bundle
- May need to split shared into `shared/schema` (backend only) and `shared/types` (both)

### AGENT 4: End-to-End Screen Testing
**Goal:** Every screen renders without crashes.

- Read every screen file and verify imports exist
- Check that all referenced components exist and export correctly
- Check that all hooks return the expected shape
- Check that React Query hooks use correct API paths
- Fix any screen that would crash on render

---

## HUMAN TASKS (For the user)

### Step 1: Firebase Console Setup
In your Firebase Console (https://console.firebase.google.com):
1. Go to volleyai2026 project
2. Go to Authentication → Sign-in method
3. Enable **Email/Password** provider
4. (Optional) Enable **Google** sign-in

### Step 2: Create a Test User
1. In Firebase Console → Authentication → Users
2. Click "Add User"
3. Email: test@volleycoach.ai, Password: Test123456
4. This gives you a login to test with

### Step 3: Keep Docker Running
Make sure Docker Desktop is running with:
```
cd d:\Antigravity\VolleyCoachAI
docker compose up -d
```

### Step 4: Start API Server
```
cd packages/api
DATABASE_URL="postgresql://volleycoach:volleycoach_dev@localhost:5432/volleycoach" REDIS_URL="redis://localhost:6379" NODE_ENV=development API_PORT=3001 npx tsx src/index.ts
```

### Step 5: Start Mobile App
After agents fix the code:
```
cd apps/mobile
npx expo start --clear
```
Scan QR with Expo Go.

---

## DEPLOYMENT PLAN (After app works locally)

### Backend Deployment (Railway)
1. Create Railway project
2. Add PostgreSQL addon (or use Neon free tier)
3. Add Redis addon (or use Upstash free tier)
4. Deploy packages/api from GitHub
5. Set environment variables

### Mobile Deployment (EAS Build)
1. `npm install -g eas-cli`
2. `eas login`
3. `eas build --platform android --profile preview`
4. Get APK download link for testing
5. Later: `eas submit` for Play Store
