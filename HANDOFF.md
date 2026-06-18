# Frennix Project Handoff — New Agent Brief

**Last updated:** June 2025  
**Production:** https://frennix.vercel.app  
**Latest commits:** `cfed0f3` (profile editing), `36d2e59` (tab resume fix), `d96afc8` (tap responsiveness)  
**Git remote:** `github.com:Frennixofficial/Frennix.git` — **git root is `apps/mobile` only**

---

## 1. Current Architecture

### Monorepo layout (on disk)

```
/Users/startswithu/Source/frennix/
├── apps/mobile/          # @frennix/mobile — Expo app (ONLY path tracked in git)
├── packages/
│   ├── api/              # @frennix/api — Supabase + domain logic
│   ├── types/            # @frennix/types — shared TS types/enums
│   └── ui/               # @frennix/ui — design system + RN components
├── supabase/
│   ├── migrations/       # 29 SQL migrations (NOT in git remote)
│   └── functions/send-push/
├── vercel.json           # Production deploy config (NOT in git remote)
└── pnpm-workspace.yaml
```

**Critical:** Cloning the GitHub repo gives you only `apps/mobile`. Workspace packages (`@frennix/api`, `@frennix/ui`, `@frennix/types`), `supabase/`, and root `vercel.json` must exist on disk locally (symlinked via `node_modules/@frennix/*`). Deploy runs from monorepo root with full tree.

### Frontend stack

| Layer | Technology |
|-------|------------|
| Framework | Expo SDK 52, React Native 0.76, React 18.3 |
| Routing | Expo Router 4 (file-based, typed routes) |
| State | React Query 5 (server state) + `AuthProvider` context |
| Forms | react-hook-form + zod |
| Styling | `@frennix/ui` theme tokens + StyleSheet |
| Monitoring | Sentry (`lib/sentry.ts`) |

**Entry:** `expo-router/entry` → `app/_layout.tsx`

**Provider tree:**

```
GestureHandlerRootView
  └── AppErrorBoundary (scope: root)
        └── QueryProvider
              └── AppResumeCoordinator
                    └── AuthProvider
                          └── AppErrorBoundary (scope: navigation)
                                ├── NotificationBootstrap
                                ├── PushRegistrationBootstrap
                                ├── AuthNavigationGuard
                                └── Stack (all screens)
```

**Bootstrap redirect** (`app/index.tsx`): unconfigured Supabase → welcome; no session → login; password recovery → reset-password; incomplete onboarding → onboarding; else → `/(tabs)`.

### Supabase

| Concern | Location |
|---------|----------|
| Client init | `packages/api/src/supabase.ts` — singleton, `autoRefreshToken`, `detectSessionInUrl` on web |
| App bootstrap | `apps/mobile/lib/init-supabase.ts` (imported first in `_layout.tsx`) |
| Env vars | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` |
| Auth API | `packages/api/src/auth.ts` |
| Session lifecycle | `providers/AuthProvider.tsx` — `getSession`, `onAuthStateChange`, `applySession`, `TOKEN_REFRESHED` fast-path |
| Storage buckets | `avatars` (avatars + cover photos), `posts` (media + thumbnails), `messages` (DM attachments) |
| Push delivery | Edge function `supabase/functions/send-push/index.ts` on `notifications` INSERT webhook |
| Typing | `Database = Record<string, unknown>` — **no generated Supabase types** |

**Realtime channels:**

- Notifications: `subscribeToNotifications()` → `lib/useNotificationSubscription.ts`
- Chat messages/typing/reactions: `app/chat/[conversationId].tsx`
- Inbox unread count: **15s polling** (no realtime for conversation list)

### Vercel

**Authoritative config:** `/Users/startswithu/Source/frennix/vercel.json`

```json
{
  "buildCommand": "pnpm --filter @frennix/mobile run build:web",
  "installCommand": "pnpm install",
  "outputDirectory": "apps/mobile/dist",
  "rewrites": [{ "source": "/((?!_expo/).*)", "destination": "/index.html" }]
}
```

**Deploy:**

```bash
cd /Users/startswithu/Source/frennix && npx vercel --prod --yes
```

**Build:** `expo export -p web` → `apps/mobile/dist/`  
**SPA rewrite:** all non-`_expo/` paths → `/index.html`  
**Latest deployment:** `dpl_5ZZACwBWhFY8CnNUR1z9uquCAUbC` (profile editing)

### Expo

- **SDK:** ~52.0.23, **Router:** ~4.0.15, **New Architecture:** enabled
- **Web:** primary production target today (`build:web`)
- **Native:** iOS/Android configured; EAS profiles in `eas.json` (Apple IDs still placeholders)
- **Deep link scheme:** `frennix://`
- **Key native deps:** expo-notifications, expo-image-picker, expo-video-thumbnails, expo-apple-authentication

---

## 2. Features Completed & Deployed

| Feature | Status | Primary files |
|---------|--------|---------------|
| **Authentication** | ✅ Email, Apple (iOS), signup, forgot/reset password, session persistence, route guard | `(auth)/*`, `AuthProvider.tsx`, `lib/auth-navigation.ts`, `lib/recovery-session.ts` |
| **Onboarding** | ✅ Multi-step: profile, gender/prefs, goals, activities | `app/onboarding.tsx` |
| **Profiles** | ✅ View own/other, stats, follow/unfollow, followers/following lists | `ProfileScreenContent.tsx`, `app/user/[username].tsx`, `packages/api/src/profiles.ts` |
| **Premium profile page** | ✅ Cover photo, avatar, badges, streak, Posts/Photos tabs, achievements | `ProfileScreenContent.tsx`, `ProfileAchievementBadges`, `ProfileContentTabs`, `useCoverUpload.ts` |
| **Profile editing** | ✅ Sports, fitness goals, workout interests, bio, location, chips | `app/edit-profile.tsx`, `lib/profile-interests.ts` |
| **Cover photos** | ✅ Upload to `avatars` bucket, optimistic preview | `lib/useCoverUpload.ts`, `uploadCoverImage()` |
| **Feed** | ✅ Infinite scroll, pull-to-refresh, like/save/reaction/share/moderation | `app/(tabs)/index.tsx`, `FeedListItem.tsx`, `FeedPostCard.tsx` |
| **Stories** | ✅ Feed stories row + viewer | `packages/api/src/stories.ts`, `FeedStoriesRow`, `FeedStoryViewer.tsx` |
| **Comments** | ✅ Threading, likes, feed preview (2 comments) | `app/post/[id].tsx`, `packages/api/src/comments.ts` |
| **Reactions** | ✅ Emoji reactions on posts + chat messages | `packages/api/src/reactions.ts`, `ReactionBar`, `usePostReaction.ts` |
| **Messaging** | ✅ Conversations, realtime chat, typing, media, message reactions | `app/chat/[conversationId].tsx`, `packages/api/src/messaging.ts` |
| **Notifications Center** | ✅ List, mark read, realtime, bell badge | `app/notifications.tsx`, `useNotificationBadge.ts` |
| **Push notifications** | ✅ Expo tokens in Supabase, edge dispatch, preferences | `lib/notifications.ts`, `push-tokens.ts`, `send-push` function |
| **Suggested Athletes** | ✅ "People You May Know" carousel on feed | `packages/api/src/suggestions.ts`, `PeopleYouMayKnowCarousel`, `useSuggestedFollow.ts` |
| **Events** | ✅ List, create/edit, detail, invite, join | `app/(tabs)/events.tsx`, `app/event/*`, `packages/api/src/events.ts` |
| **Video thumbnails** | ✅ Web poster frames, loading fallback | `useVideoPoster.ts`, `VideoPreview.tsx`, `WebVideoFrame.tsx` |
| **Discover** | ✅ Search profiles, filters | `app/(tabs)/discover.tsx` |
| **Groups / Challenges** | ✅ Basic CRUD + detail screens | `app/group/*`, `app/challenge/*` |
| **Saved posts** | ✅ | `app/saved-posts.tsx`, `saved-posts.ts` |
| **Moderation** | ✅ Report/block, admin moderation | `lib/useModeration.tsx`, `admin-moderation.tsx` |
| **Referrals** | ✅ Invite friends, join codes | `referrals.ts`, `invite-friends.tsx` |
| **Matching** | ⚠️ **Stub only** — placeholder screen | `app/matching.tsx` |

---

## 3. Bugs Fixed (Recent)

| Bug | Root cause / fix | Commit |
|-----|------------------|--------|
| **Login issues** | Auth error formatting, web recovery hash handling, session bootstrap | Various early commits |
| **Onboarding** | Multi-step validation, avatar upload, referral claim, success navigation delay | `onboarding.tsx` |
| **RLS recursion** | Infinite RLS loops on profiles/posts | Migrations `20250617000001`, `20250617000002` |
| **Follow counts stuck at 0** | Stats not updated optimistically | `663df0a`, `useFollowUser.ts` optimistic cache patches |
| **Follow/unfollow UI lag** | Missing optimistic updates | `e414751` |
| **Notifications white screen** | Unsafe payload parsing, bad navigation targets re-pushing `/notifications` | `042510a` — `safeNotificationPayload`, `notification-navigation.ts` guards, loading/error states |
| **Logout broken on web** | Stack not reset after sign-out | `settings.tsx` — `queryClient.clear()` + `redirectToLogin()` with `dismissAll()` |
| **Cover upload did nothing** | `identityBlock` overlay intercepted taps on "Change cover" | `e2f0ea1` — absolute button, `pointerEvents="box-none"` |
| **Video preview blank** | Missing web poster frame, duplicate poster hooks | `1dfac3f` — `WebVideoFrame`, `useVideoPoster` cache |
| **Button/tap lag** | Feed `invalidateQueries` after every like/save/reaction; unstable FlatList handlers | `d96afc8` — optimistic-only updates, `memo(FeedListItem)`, `deferNavigation` |
| **White screen on tab resume** | React Query `refetchOnWindowFocus` storm + `TOKEN_REFRESHED` full profile refetch | `36d2e59` — disable focus refetch, `AppResumeCoordinator`, `AppErrorBoundary`, auth grace period |
| **Profile editing gaps** | Sports/goals/interests not clearly separated | `cfed0f3` — split sports vs workout interests, immediate `refreshProfile(updated)` |

---

## 4. Current Unresolved Issues

These are **known pain points** — partially mitigated but not fully resolved:

| Issue | Symptoms | Likely causes | Where to look |
|-------|----------|---------------|---------------|
| **Feed load performance** | Slow first paint, long spinner on feed | `getFeed()` runs heavy per-page enrichment: likes, comments, saves, preview comments, reactions, shared posts — multiple round trips | `packages/api/src/posts.ts` (`enrichPosts`), consider RPC/view |
| **Feed scroll lag (web)** | Janky scroll, especially with videos | `WebVideoFrame` per post, comment previews, large bundle, no virtualization tuning on web | `FeedPostCard.tsx`, `PostMedia.tsx`, `(tabs)/index.tsx` FlatList props |
| **Notifications lag** | Slow open, sluggish row taps | Realtime invalidation debounce (350ms), full list refetch, row re-renders | `useNotificationSubscription.ts`, `notifications.tsx` |
| **Back button lag** | Delay returning from stack screens | `router.back()` on web with deep stacks; `StackBackButton` has no `deferNavigation` | `StackBackButton.tsx`, `lib/press-utils.ts` |
| **White screen on background return** | Blank hang after switching tabs 5–10s | Mitigated in `36d2e59` — **needs retest** on production | `QueryProvider.tsx`, `AppResumeCoordinator.tsx`, `AuthProvider.tsx` |
| **Matching page white-screen glitch** | Flash/blank navigating to matching | Stub screen + possible stack/history issue on web; screen is minimal (`EmptyState` only) | `app/matching.tsx`, navigation from `settings.tsx` Link |

---

## 5. Database Migrations Already Applied

All under `supabase/migrations/` (29 files). Apply with `supabase db push` from monorepo root.

**Core (May 2025):**

- `20250529000000` — initial schema (profiles, posts, follows, groups, challenges, notifications, RLS)
- `20250529000001` — storage (`avatars`, `posts`)
- `20250529000003` — messaging + `messages` bucket
- `20250529000004`–`00007` — conversation RLS, DM helper, avatar storage fix, media delete
- `20250529000008`–`00011` — match notifications, search, events, video thumbnails
- `20250529000012`–`00015` — challenge/event post links, comments threading, direct share
- `20250529000016`–`00017` — push preferences + webhook dispatch
- `20250529000018`–`00021` — saved posts, user safety, referrals, beta feedback

**Recent fixes (June 2025):**

- `20250617000000` — profile referral code default
- `20250617000001` — **fix profiles RLS recursion**
- `20250617000002` — **fix posts RLS recursion**
- `20250617000003` — emoji reactions tables
- `20250617000004` — post reaction notifications
- `20250617000005` — event invitations push
- `20250617000006` — `profiles.cover_image_url`

---

## 6. Performance-Critical Files

| File | Role |
|------|------|
| `app/(tabs)/index.tsx` | Feed FlatList tuning (`initialNumToRender=5`, `windowSize=7`, `removeClippedSubviews` off on web) |
| `components/FeedListItem.tsx` | `memo()` + custom equality — prevents row re-renders |
| `packages/ui/src/FeedPostCard.tsx` | Heavy card: media, reactions, comment preview |
| `packages/ui/src/PostMedia.tsx` | Video/image rendering |
| `packages/ui/src/useVideoPoster.ts` | Web video poster generation + in-memory cache |
| `packages/ui/src/WebVideoFrame.tsx` | Paused `<video>` poster on web; visibility handler |
| `providers/QueryProvider.tsx` | `refetchOnWindowFocus: false`, `staleTime: 30s` |
| `lib/app-resume.ts` | Debounced stale refetch on tab resume (400ms) |
| `providers/AuthProvider.tsx` | Skips full bootstrap on `TOKEN_REFRESHED` |
| `lib/press-utils.ts` | `deferNavigation()` via `InteractionManager`; `guardDoublePress()` |
| `lib/usePostReaction.ts` | Optimistic reaction patches across feed/post/user queries |
| `lib/useFollowUser.ts` | Optimistic follow stats (reduced invalidations) |
| `lib/useSavePost.ts` | Optimistic save (no feed invalidation on success) |
| `lib/useNotificationSubscription.ts` | Debounced invalidation (350ms) + reconnect on resume |
| `app/notifications.tsx` | Memoized rows, FlatList tuning |
| `packages/api/src/posts.ts` | **`enrichPosts()` — main feed latency bottleneck** |
| `components/AppErrorBoundary.tsx` | Crash recovery UI (prevents permanent white screen) |

---

## 7. Recommended Next Debugging Steps

### Feed performance (highest impact)

1. **Profile `getFeed` in DevTools Network** — count Supabase requests per page load.
2. **Replace client-side enrichment** with a Postgres RPC or view returning like/comment counts + preview comments in one query (`packages/api/src/posts.ts`).
3. **Lazy-load video posters** — only generate posters for visible rows (Intersection Observer on web).
4. **Split feed header** — stories + suggestions load independently; defer suggestions query until feed paints.

### Scroll lag

1. React DevTools Profiler on feed scroll — identify re-rendering rows.
2. Test with `FeedPostCard` media disabled to isolate video cost.
3. On web, consider `content-visibility: auto` or reduce simultaneous `<video>` elements.

### Notifications lag

1. Replace full `invalidateQueries` with targeted cache updates on realtime INSERT.
2. Prefetch notifications when bell is tapped (before navigation completes).
3. Audit `NotificationRow` render cost in `@frennix/ui`.

### Back button lag

1. Wrap `StackBackButton.handlePress` in `deferNavigation`.
2. On web, test `router.back()` vs `router.replace(fallbackHref)` timing.
3. Check if stack depth grows on repeated settings → sub-screen navigation.

### Tab resume / white screen

1. Retest production after `36d2e59`: switch tab 5–10s, return.
2. If still failing, check Sentry for uncaught render errors caught by `AppErrorBoundary`.
3. Monitor Supabase realtime reconnect storms on visibility change.

### Matching white-screen

1. Navigate Settings → Partner matching on web with DevTools console open.
2. Check if error boundary triggers or if stack fails to mount `matching.tsx`.
3. Screen is a stub — consider removing from settings until feature ships, or add loading guard.

---

## 8. Technical Debt & Risky Areas

| Risk | Details |
|------|---------|
| **Split git vs monorepo** | Git tracks only `apps/mobile`; packages/supabase/vercel.json may be missing from remote clones |
| **Duplicate Vercel configs** | Root `vercel.json` vs `apps/mobile/vercel.json` — use root for production |
| **Cover photos in `avatars` bucket** | No dedicated bucket; path prefix only |
| **N+1 messaging queries** | `getConversations()` loops per conversation (`messaging.ts`) |
| **Global message-reaction subscription** | Listens to all `message_reactions`, not scoped per conversation |
| **No Supabase generated types** | Runtime schema drift possible; RLS errors hard to catch at compile time |
| **Duplicated video poster logic** | Both `packages/api/src/video-thumbnail.ts` and `packages/ui/src/useVideoPoster.ts` |
| **Polling vs realtime** | Unread messages polled every 15s; notifications use realtime — inconsistent |
| **Auth/navigation complexity** | Multiple workarounds: recovery hash, tab resume grace, `TOKEN_REFRESHED` special case, `redirectToLogin()` with `dismissAll()` |
| **Typed routes incomplete** | Many `router.push()` calls fail `tsc` — routes exist at runtime but types lag |
| **Zustand unused** | Listed in deps but app uses React Query + Auth context only |
| **Matching/premium/marketplace stubs** | `features/matching/`, `features/premium/` are README placeholders |
| **EAS submit placeholders** | `eas.json` has `YOUR_APPLE_ID` / `YOUR_ASC_APP_ID` |
| **Verbose auth logging** | `console.info/error` throughout auth and profile flows |

---

## 9. Key File Map (Quick Reference)

```
app/
  _layout.tsx              # Root providers + stack
  index.tsx                # Auth/onboarding redirect
  (tabs)/index.tsx         # Feed
  (tabs)/profile.tsx       # Own profile
  edit-profile.tsx         # Profile editing
  notifications.tsx        # Notifications Center
  chat/[conversationId].tsx
  settings.tsx             # Logout, links
  matching.tsx             # Stub

providers/
  AuthProvider.tsx
  QueryProvider.tsx

lib/
  init-supabase.ts
  auth-navigation.ts
  app-resume.ts
  press-utils.ts
  profile-interests.ts
  useNotificationSubscription.ts
  notification-navigation.ts
  usePostReaction.ts / useFollowUser.ts / useSavePost.ts
  useCoverUpload.ts / useAvatarUpload.ts

packages/api/src/
  supabase.ts auth.ts profiles.ts posts.ts
  messaging.ts notifications.ts reactions.ts
  stories.ts suggestions.ts events.ts

packages/ui/src/
  FeedPostCard.tsx PostMedia.tsx VideoPreview.tsx
  WebVideoFrame.tsx useVideoPoster.ts
  ProfileContentTabs.tsx ReactionBar.tsx

supabase/migrations/       # All DB schema
supabase/functions/send-push/
vercel.json                  # Production deploy
```

---

## 10. Agent Operating Notes

- **Do not commit** unless explicitly asked.
- **Deploy:** `cd /Users/startswithu/Source/frennix && npx vercel --prod --yes`
- **Local dev:** `cd apps/mobile && pnpm start` (requires monorepo `pnpm install` at root)
- **Env:** copy `apps/mobile/.env.example` → `.env`
- **Production URL for testing:** https://frennix.vercel.app
- **Recent work priority:** performance (feed/notifications/navigation) > matching stub cleanup > native store builds

---

## 11. Critical Gotchas & Known Issues

### Setup & deploy

**Vercel env vars (required for production builds)**  
`EXPO_PUBLIC_*` values are baked into the bundle at build time via `app.config.ts` → `extra`. They must be set in the **Vercel project dashboard** (`frennix-s-projects/frennix`), not only in a local `.env`:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- Optional: `EXPO_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_APP_URL`

**Supabase Auth dashboard config**  
Password reset requires whitelisted redirect URLs in Supabase Auth settings:

- Web: `https://frennix.vercel.app/reset-password` (from `lib/auth-redirect.ts`)
- Native: `frennix://reset-password`

Recovery tokens arrive in the **URL hash on web**. Expo Linking omits the hash, so `AuthProvider` has special hash handling (`lib/auth-redirect.ts`, `lib/recovery-session.ts`).

**Push notifications are native-only**  
`lib/notifications.ts` skips registration on web (`resolvePlatform()` returns null). Push requires:

- EAS project ID hardcoded in `app.config.ts` (`7910ebf1-56ce-4fa0-9777-6c88602c89c6`)
- Edge function `supabase/functions/send-push` deployed separately (`supabase functions deploy send-push`)
- DB webhook/trigger from migration `20250529000017`

**Wrong local Vercel project link**  
`apps/mobile/.vercel/project.json` points to a **"mobile"** Vercel project. Production deploys from **monorepo root** to the **"frennix"** project. Running `vercel` from `apps/mobile` deploys to the wrong target.

**HANDOFF.md is outside git by default**  
This file lives at monorepo root. Git only tracks `apps/mobile/`. A copy is committed at `apps/mobile/HANDOFF.md` for agents cloning from GitHub.

### Data model gotchas

**Sports are not a separate DB column**  
Sports and workout interests are split in the UI (`lib/profile-interests.ts`, `SPORTS` / `WORKOUT_INTERESTS` in `@frennix/types`) but both persist in `profiles.activities`. Do not add a `sports` migration without an explicit product decision.

**Founder bio is hardcoded**  
`lib/profile.ts` injects a default bio for username `"frennix"` even when `bio` is null — affects profile display and edit defaults.

**Admin access is DB-gated**  
`profile.is_admin` must be set manually in Supabase. It unlocks `admin-moderation` and `admin-feedback` in Settings. There is no in-app admin promotion flow.

**Matching tables exist; UI is a stub**  
`matches` and `match_swipes` tables exist (migration `20250529000002`). `features/matching/README.md` documents deferred work. Profile fields `matching_enabled`, `gender`, and `match_preference` are collected at onboarding but unused in the matching UI.

### Web vs native behavior

**Primary shipping target is web**  
Production is `expo export -p web` on Vercel. iOS/Android are configured but not the current production path. Apple Sign-In is iOS-only (`app/(auth)/login.tsx`).

**Alerts are not native on web**  
`lib/alerts.ts` uses `window.alert` / `window.confirm` on web — different UX from native `Alert.alert`, no styled modals.

**Image picking differs on web**  
`lib/pick-image.ts` skips permission prompts and passes `File` objects through to upload APIs. Critical for avatar, cover, and post uploads on web.

### Code patterns agents must know

**React Query key conventions** (informal but load-bearing):

| Key | Purpose |
|-----|---------|
| `["feed", userId]` | Infinite feed |
| `["profile", username]` | Other user's profile |
| `["user-posts", profileId, viewerId]` | Profile posts grid |
| `["suggested-athletes", userId]` | Feed "People You May Know" carousel |
| `["discover-suggestions", userId]` | Discover tab suggestions (separate cache from feed) |

**Optimistic updates — do not refetch the feed on success**  
Likes, saves, reactions, and follows patch the React Query cache directly and avoid `invalidateQueries` on success (performance fix in `d96afc8`). New mutations should follow this pattern.

**Create-post draft persistence**  
`lib/useCreatePostDraft.ts` + `lib/create-post-draft.ts` persist drafts across navigation and AppState changes. Easy to break unintentionally.

**Block/moderation filtering**  
`getBlockedIds()` filters feed, search, suggestions, and DMs. "Missing" users or posts may be block-related, not a data bug.

**Create tab is not a real screen**  
`(tabs)/create` intercepts `tabPress` and opens `/create-post` as a modal.

### Tooling & quality

**Typecheck is red**  
`npm run typecheck` fails on many `router.push()` typed-route mismatches and some package-level errors. Routes work at runtime — do not assume clean `tsc`.

**No automated test suite**  
No unit, integration, or E2E tests are present.

**pnpm + Node requirements**  
Root `package.json`: `pnpm@9.15.0`, Node `>=20`. Run `pnpm install` from monorepo root, not only inside `apps/mobile`.

**Metro monorepo config is required**  
`apps/mobile/metro.config.js` watches the monorepo root and resolves `node_modules` from both app and root. Local dev breaks without the full monorepo tree on disk.

**Packages/supabase changes are not in git**  
Changes under `packages/` and `supabase/` deploy via Vercel (full monorepo on disk) but are **not tracked in the GitHub repo**. Coordinate with the team before assuming remote clones have API/UI/migration changes.

---

*This document reflects codebase state through commit `cfed0f3` and deployment `dpl_5ZZACwBWhFY8CnNUR1z9uquCAUbC`.*
