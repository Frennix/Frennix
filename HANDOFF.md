# Frennix Agent Handoff — Online / Last Seen Presence

**Last updated:** June 2025  
**Primary goal for next agent:** Fix Frennix online / last-seen presence so `is_online` stays `true` while the app is open and active.

---

## 1. Goal

Users should see who is **online now** and **when someone was last online** (green dot + “Online now” / “Last seen 5 minutes ago” / etc.).

Backend uses Supabase `profiles.last_seen_at` + `profiles.is_online`, updated only via RPC `set_presence(p_is_online boolean)` (not profile PATCH).

**Current blocker:** `last_seen_at` updates correctly but **`is_online` remains `false`** while the user is actively using the app after login.

---

## 2. What works

| Area | Status |
|------|--------|
| DB migrations | `20250617000008_profile_presence.sql` and `20250617000009_set_presence_profile_fallback.sql` applied to remote Supabase (`supabase db push`) |
| RPC `set_presence` | Exists; client logs `[presence:api] rpc set_presence OK` |
| `last_seen_at` | Updates on heartbeat / presence calls |
| `updated_at` | Updates with presence RPC |
| Auth / login | Not broken; profile loading works |
| UI (when data is correct) | Green dot on `Avatar`, text via `formatPresenceStatus()` on discover cards, messages list, profile screen, chat header |

---

## 3. What is still broken

- **`profiles.is_online` stays `false`** for active users (e.g. `username = 'markeith'`) even while the app is foregrounded and RPC succeeds.
- Because `set_presence` sets **both** `is_online` and `last_seen_at` in one `UPDATE`, a updating `last_seen_at` with `is_online = false` strongly implies **`set_presence(false)` is winning** over `set_presence(true)` (async race or a lifecycle handler firing after login).
- Production web `dist/` may lag source; local dev must run from **`/Users/startswithu/Source/frennix/apps/mobile`** (`npx expo start --clear`), not monorepo root.

---

## 4. Files changed (presence workstream)

### Supabase (monorepo `supabase/migrations/` — not in `apps/mobile` git)

| File | Purpose |
|------|---------|
| `20250617000008_profile_presence.sql` | Adds `last_seen_at`, `is_online`; original `set_presence` (void) |
| `20250617000009_set_presence_profile_fallback.sql` | `DROP FUNCTION set_presence(boolean)`; recreate with `RETURNS jsonb`, upsert profile if missing |

### Mobile app (`apps/mobile/` — git root)

| File | Role |
|------|------|
| `providers/AuthProvider.tsx` | Calls `startPresenceTracking()` after `applySession` + profile load; `stopPresenceTracking()` on sign-out; **re-checks `getSession()` before `applySession(null)`** to avoid bootstrap race |
| `lib/presence.ts` | Heartbeat (60s), `enqueuePresence`, web `visibilitychange`, native `AppState`, debounced offline, RPC serialization attempt |
| `app/(auth)/login.tsx` | Login → `applySession(session)` only (duplicate `startPresenceTracking` removed) |
| `components/PresenceCoordinator.tsx` | Mounts `attachPresenceLifecycle()` at app root |
| `app/_layout.tsx` | Renders `<PresenceCoordinator />` inside `AuthProvider` |

### Workspace packages (on disk, symlinked — **not in mobile git**)

| File | Role |
|------|------|
| `packages/api/src/presence.ts` | `setPresence()`, verify read-back after RPC |
| `packages/api/src/profiles.ts` | Strips `is_online` / `last_seen_at` from `updateProfile()` |
| `packages/types/src/index.ts` | `Profile.is_online`, `Profile.last_seen_at` |
| `packages/ui/src/presence.ts` | `isProfileOnline()`, `formatPresenceStatus()` |
| `packages/ui/src/Avatar.tsx` | Green online dot |

### Git commits (local `main`, may be unpushed)

- `02bb3dc` — Add online presence tracking and status UI
- `17de409` — Fix presence tracking to start reliably on sign-in
- `a8d37df` — Fix presence tracking to start immediately after sign-in with visible logs

**Uncommitted local changes** (as of handoff): `lib/presence.ts`, `providers/AuthProvider.tsx`, `app/(auth)/login.tsx`, `lib/notifications.ts` (web guard only).

---

## 5. Current evidence

**Browser / Metro console**

- `[presence:api] rpc set_presence OK` with `{ isOnline: true, userId: "..." }`
- `[presence] setPresence OK` / `enqueuePresence` logs (when present in build)
- RPC success does **not** guarantee final DB state if a later `false` call completes afterward

**Supabase SQL**

```sql
SELECT id, username, is_online, last_seen_at, updated_at
FROM public.profiles
WHERE username = 'markeith';
```

Observed: `last_seen_at` and `updated_at` change over time; **`is_online` stays `false`**.

**Implication:** Something in the client calls offline presence after online presence. No DB trigger or cron resets `is_online` independently.

---

## 6. Next task (for you)

### Primary

Add **explicit, always-on logs** (not only `__DEV__`) around **every** true/false presence write and find what sets `false` after login:

1. **`lib/presence.ts`** — log at entry to `enqueuePresence(isOnline, reason)` with `{ isOnline, reason, presenceActive, trackingUserId, stack }` (optional `new Error().stack` snippet).
2. **`packages/api/src/presence.ts`** — log `{ isOnline, userId }` immediately before and after `supabase.rpc('set_presence', …)`; log verify read-back `{ is_online, last_seen_at }`.
3. Trace all callers of `false`:
   - `scheduleOffline("background")` ← web `visibilitychange` hidden, native `AppState === "background"`
   - `stopPresenceTracking(true)` → `enqueuePresence(false, "stop")` ← sign-out or **`applySession(null)`**
4. Filter DevTools Network for `POST .../rpc/set_presence` and compare request body `p_is_online` true vs false ordering.
5. After login, confirm no `setPresence(false)` with reason `stop` from bootstrap `applySession(null)` race.

### Suspected causes (investigate in order)

1. **Async RPC race** — parallel `true`/`false` without strict ordering; last completed RPC wins.
2. **`applySession(null)` after login** — stale `getSession()` from `bootstrapAuth()` calling `stopPresenceTracking(true)`.
3. **Web `visibilitychange` → hidden** — tab blur, DevTools, SPA navigation after `router.replace("/")`.
4. **Native `AppState: inactive`** — was previously treated as background (partially fixed; confirm build has latest `presence.ts`).

### Secondary (after root cause fixed)

- Remove noisy debug logs or gate behind `__DEV__`.
- Commit + push mobile changes; rebuild web `dist` if deploying to Vercel.
- Confirm `packages/api` presence changes are on disk in dev (Metro resolves `@frennix/api` → `packages/api/src`).

---

## 7. Exact SQL verification queries

**Profile row for a user by username**

```sql
SELECT id, username, is_online, last_seen_at, updated_at
FROM public.profiles
WHERE username = 'markeith';
```

**Match auth user to profile row (use UUID from console `userId`)**

```sql
SELECT u.id AS auth_id, u.email, p.username, p.is_online, p.last_seen_at, p.updated_at
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
WHERE p.username = 'markeith';
```

**Confirm RPC function definition on remote**

```sql
SELECT pg_get_functiondef('public.set_presence(boolean)'::regprocedure);
```

Expected body includes:

```sql
UPDATE public.profiles
SET is_online = p_is_online, last_seen_at = now(), updated_at = now()
WHERE id = auth.uid();
```

**Live watch (run in SQL editor while using app)**

```sql
SELECT username, is_online, last_seen_at, updated_at
FROM public.profiles
WHERE username = 'markeith';
-- Re-run every few seconds; is_online should be true while app is foregrounded.
```

---

## Architecture quick reference

| Item | Path |
|------|------|
| Git root | `/Users/startswithu/Source/frennix/apps/mobile` |
| Monorepo root | `/Users/startswithu/Source/frennix` |
| Expo start | `cd /Users/startswithu/Source/frennix/apps/mobile && npx expo start --clear` |
| Supabase push | `cd /Users/startswithu/Source/frennix && supabase db push` |
| Supabase project ref | `wkrwncovmpsveatlrqel` |
| Production | https://frennix.vercel.app |

**Presence lifecycle flow**

```
Login / bootstrap
  → AuthProvider.applySession()
  → startPresenceTracking(userId)
  → enqueuePresence(true) → RPC set_presence(true)
  → heartbeat every 60s → set_presence(true)

PresenceCoordinator (parallel)
  → attachPresenceLifecycle()
  → web: visibilitychange / native: AppState background
  → scheduleOffline → set_presence(false) after 2s debounce

Sign out
  → stopPresenceTracking(true) → set_presence(false)
```

**UI surfaces with presence**

- `packages/ui/src/DiscoverProfileCard.tsx`
- `packages/ui/src/PeopleYouMayKnowCarousel.tsx`
- `apps/mobile/components/ProfileScreenContent.tsx`
- `apps/mobile/app/(tabs)/messages.tsx`
- `apps/mobile/app/chat/[conversationId].tsx` (30s profile refetch)

**Online threshold:** 3 minutes (`PRESENCE_ONLINE_THRESHOLD_MS`) — user shown as online only if `is_online` and recent `last_seen_at`.

---

## Commands cheat sheet

```bash
# Dev server (must be apps/mobile, NOT monorepo root)
cd /Users/startswithu/Source/frennix/apps/mobile && npx expo start --clear

# Apply migrations
cd /Users/startswithu/Source/frennix && supabase db push

# Git status (mobile repo only)
cd /Users/startswithu/Source/frennix/apps/mobile && git status && git log -5 --oneline
```

---

*End of presence handoff.*
