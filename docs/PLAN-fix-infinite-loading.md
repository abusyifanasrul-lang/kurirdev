# Plan: Fix Infinite Loading After Long Idle

This plan addresses the cause of the infinite/long loading screen ("Memuat KurirDev...") when a laptop is opened after a long period of inactivity.

## User Review Required

> [!IMPORTANT]
> **Silent Profile Refresh**: I propose changing the authentication logic so that `isLoading` is only set to `true` during the *initial* session check (when no user is in memory). Subsequent profile refreshes (e.g., after token refresh or wake-from-sleep) will happen in the background without showing the full-page loader.

> [!WARNING]
> **Session Persistence**: I recommend switching Supabase and Zustand storage from `sessionStorage` to `localStorage` to ensure the session survives browser tab "discarding" by the OS during long sleep. Is there a specific security requirement to keep it in `sessionStorage`?

## Proposed Changes

### 🔐 Authentication Layer

#### [MODIFY] [AuthContext.tsx](file:///c:/Users/K4G3/Documents/GitHub/kurirdev/src/context/AuthContext.tsx)
- Refactor `fetchProfile` to accept an optional `silent` parameter.
- If `silent` is true (or if `state.user` already exists), do not set `isLoading: true`.
- Update `onAuthStateChange` to perform silent refreshes for `TOKEN_REFRESHED` events.
- Add a timeout/abort controller to the profile fetch to prevent infinite hanging if the network is unstable.

### 🌐 Initialization & Resilience

#### [MODIFY] [App.tsx](file:///c:/Users/K4G3/Documents/GitHub/kurirdev/src/App.tsx)
- Review the `fetchWithRetry` logic. Ensure that a failed chunk load after sleep doesn't cause an infinite reload loop.
- Improve `LoadingScreen` implementation to ensure it's only shown on critical failure or first-load authentication.

### 📡 Real-time & Synchronization

#### [MODIFY] [AppListeners.tsx](file:///c:/Users/K4G3/Documents/GitHub/kurirdev/src/components/AppListeners.tsx)
- Coordinate the `resyncAll` trigger with the `AuthContext` state to ensure we don't spam Supabase with identical requests right after a token refresh.

#### [MODIFY] [supabaseClient.ts](file:///c:/Users/K4G3/Documents/GitHub/kurirdev/src/lib/supabaseClient.ts)
- Switch `storage` from `sessionStorage` to `localStorage` for better wake-from-sleep persistence.

---

## Open Questions

1. **Console Errors**: You mentioned seeing errors in the console during the first Ctrl+F5. Do you remember any specific error messages (e.g., "Failed to fetch", "Uncaught SyntaxError")?
2. **Deployment**: Has there been a deployment of a new version recently? (This often triggers the "chunk load failed" scenario).
3. **Role**: Does this happen for all roles, or primarily for the **Courier** role (which uses more PWA features like FCM)?

## Verification Plan

### Automated Tests
- Verify that `isLoading` transitions from `true` to `false` during initial load.
- Simulate a `TOKEN_REFRESHED` event and verify that it does **not** trigger the full-page loader.

### Manual Verification
- Simulate "laptop sleep" by disconnecting the network, letting the token expire (manually clearing it or waiting), and then reconnecting.
- Verify that the app remains interactive or shows a subtle loading state instead of the blocking full-page loader.
