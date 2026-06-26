# Frennix — Comprehensive Agent Handoff

**Last updated:** June 25, 2026  
**Production web:** https://frennix.vercel.app  
**Supabase project:** `wkrwncovmpsveatlrqel`  
**Git remote:** https://github.com/Frennix/Frennix.git (root = `apps/mobile`)

---

## Executive summary

Frennix is a fitness social app (Expo 52 / React Native 0.76) with feed, DMs, workout events, training-partner matching, and trainer discovery. Phases **4–14A** and **15 tooling** are implemented and deployed to web.

**Current roadmap priority (June 2026):** Premium post management, media experience, and feed performance — core social functionality users expect before Phase 15 exit validation resumes.

Recent session work:

- **Phase A — Shared ownership framework** — `EntityActionSheet`, `entity-actions`, unified post/challenge/event menus (Edit, Delete, Share, Copy Link, Report, Block); events get ⋯ menu + share/report
- **Challenge management** — creator/viewer ⋯ menus on shared framework
- **Post management (Priority 1)** — unified `usePostActions`, owner gets Share + Copy Link, viewer gets Block
- **Logo clipping fix** — padded PNG + web-native `<img>` in `FrennixLogo.tsx`
- **Feed photo lightbox** — pinch/pan zoom, full-screen viewer on feed + post detail
- **Instagram-style feed media** — full-width, aspect-preserving photos/videos, large play button
- **Matching crash fix** — null-safe readiness gate + defensive RPC parsing + route error boundary

---

## Table of contents

1. [Architecture](#1-architecture)
2. [Project structure](#2-project-structure)
3. [Environment variables](#3-environment-variables)
4. [Authentication flow](#4-authentication-flow)
5. [Supabase database schema](#5-supabase-database-schema)
6. [Storage buckets & RLS](#6-storage-buckets--rls)
7. [Key RPC functions](#7-key-rpc-functions)
8. [Feed implementation](#8-feed-implementation)
9. [Messaging](#9-messaging)
10. [Notifications](#10-notifications)
11. [Events](#11-events)
12. [Matching (training partners & trainers)](#12-matching-training-partners--trainers)
13. [Media uploads](#13-media-uploads)
14. [Presence](#14-presence)
15. [Completed features by phase](#15-completed-features-by-phase)
16. [Deployment](#16-deployment)
17. [Verification scripts](#17-verification-scripts)
18. [Known issues](#18-known-issues)
19. [Technical debt](#19-technical-debt)
20. [Recommended next priorities](#20-recommended-next-priorities)
21. [Post management roadmap](#21-post-management-roadmap)
22. [Quick reference](#22-quick-reference)

---

## 1. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Expo Router app (apps/mobile)                              │
│  ├── app/           File-based routes                       │
│  ├── components/    App-specific UI                         │
│  ├── lib/           Client helpers (presence, push, etc.)   │
│  └── providers/     AuthProvider, QueryProvider             │
├─────────────────────────────────────────────────────────────┤
│  @frennix/ui        Design tokens + shared components       │
│  @frennix/api        Supabase client + domain API           │
│  @frennix/types      Shared TypeScript types                │
├─────────────────────────────────────────────────────────────┤
│  Supabase                                                   │
│  ├── Postgres + RLS                                         │
│  ├── Auth (email, Apple)                                    │
│  ├── Storage (avatars, posts, messages, trainer media)      │
│  ├── Realtime (messages, notifications, presence)           │
│  └── Edge Functions (send-push)                             │
└─────────────────────────────────────────────────────────────┘
```

| Layer | Technology |
|-------|------------|
| Mobile / Web | Expo 52, React Native 0.76, Expo Router 4 |
| State / data | TanStack Query 5, Zustand |
| Backend | Supabase (Postgres, Auth, Storage, Realtime) |
| Forms | React Hook Form + Zod |
| Monitoring | Sentry (`EXPO_PUBLIC_SENTRY_DSN`) |
| Push | Expo Notifications → `push_tokens` → edge function → APNs |

**Monorepo layout:** The canonical filesystem root is `/Users/startswithu/Source/frennix`. Git tracks **`apps/mobile`** as the repo root, which now **also contains vendored copies** of `packages/` and `supabase/` so clones are self-contained. Local dev may still use the parent monorepo via pnpm workspace symlinks.

---

## 2. Project structure

```
apps/mobile/                    ← GIT ROOT
├── app/                        Expo Router screens
│   ├── (auth)/                 login, signup, forgot-password, welcome
│   ├── (tabs)/                 feed, discover, create, events, messages, profile
│   ├── matching/               training partner deck + matches
│   ├── trainers/               trainer discovery + connections
│   ├── chat/[conversationId]   DM thread
│   ├── event/                  event detail, invite, edit
│   ├── trainer/                public trainer profile
│   ├── admin-*                 analytics, feedback, moderation, trainer review
│   └── ...
├── components/                 FeedHeader, FrennixLogo, ImageLightbox, etc.
├── lib/                        notifications, presence, analytics, auth helpers
├── providers/                  AuthProvider, QueryProvider, TabBadgeProvider
├── features/                   Phase documentation (matching, trainers, validation)
├── scripts/                    QA, perf measurement, verification
├── packages/                   @frennix/api, @frennix/types, @frennix/ui (vendored)
├── supabase/                   migrations (41), seed, edge functions
├── dist/                       Pre-built web export (committed for Vercel)
├── assets/                     Brand images, icons
├── pnpm-workspace.yaml         Workspace: `.` + `packages/*`
├── .gitignore                  Ignores `node_modules/`, `.pnpm-store/`, `.expo/`, secrets
└── HANDOFF.md                  This document
```

### Key routes

| Route | Purpose |
|-------|---------|
| `/` | Auth gate → login / onboarding / tabs |
| `/(tabs)/` | Main feed |
| `/(tabs)/discover` | Search athletes, matching entry |
| `/(tabs)/create` | New post |
| `/(tabs)/events` | Workout events list |
| `/(tabs)/messages` | Conversation list |
| `/matching-settings` | Training partner preferences |
| `/matching` | Discovery swipe deck |
| `/matching/matches` | Active training matches |
| `/trainers` | Trainer search |
| `/trainers/connections` | Connection requests |
| `/trainer/[username]` | Public trainer profile |
| `/chat/:conversationId` | DM |
| `/notifications` | Notification center |
| `/beta-feedback` | User feedback form |
| `/admin-analytics` | Product analytics (admin) |

---

## 3. Environment variables

Copy `.env.example` → `.env` in `apps/mobile`:

| Variable | Required | Purpose |
|----------|----------|---------|
| `EXPO_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Yes | Client anon key |
| `EXPO_PUBLIC_SENTRY_DSN` | Optional | Error monitoring |
| `EXPO_PUBLIC_PRIVACY_POLICY_URL` | Optional | Legal links |
| `EXPO_PUBLIC_TERMS_URL` | Optional | Legal links |
| `EXPO_PUBLIC_APP_URL` | Optional | Web/deep link base (default `https://frennix.vercel.app`) |
| `EAS_PROJECT_ID` | iOS builds | Expo/EAS project ID |

Runtime access: `lib/config.ts` and `app.config.ts` → `extra`.

**Script-only:** `TEST_USER_JWT` for load/perf scripts.

**Edge function (hosted):** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (auto-injected on deploy).

---

## 4. Authentication flow

**Provider:** `providers/AuthProvider.tsx`

```
App launch
  → ensureSupabaseInitialized()
  → getSession()
  → applySession(session)
       → setSession, refreshProfile()
       → startPresenceTracking()
       → registerForPushNotifications()
  → onAuthStateChange listener (sign-in, sign-out, PASSWORD_RECOVERY)
```

| Flow | Entry | Notes |
|------|-------|-------|
| Email login | `app/(auth)/login.tsx` | `signInWithEmail` → `applySession` |
| Email signup | `app/(auth)/signup.tsx` | Trigger `handle_new_user` creates profile |
| Apple OAuth | `login.tsx` | `expo-apple-authentication` → Supabase `signInWithIdToken` |
| Password recovery | `forgot-password.tsx` | Deep link / web hash → `PASSWORD_RECOVERY` → `/reset-password` |
| Onboarding | `app/onboarding.tsx` | Username, avatar, goals, activities → `onboarding_complete` |
| Sign out | AuthProvider | Stops presence, clears push, `supabaseSignOut` |

**Navigation guard:** `app/index.tsx` redirects: no config → welcome; no session → login; incomplete onboarding → `/onboarding`; password recovery → `/reset-password`; else tabs.

**Session resilience:** 1500 ms grace period on tab resume before treating session as lost (web background tab refresh).

**Referrals:** Optional `claimReferral(code)` during onboarding (`referrals` table).

---

## 5. Supabase database schema

Migrations live in `supabase/migrations/` (41 files, May–Jun 2025 timestamps). Apply with `supabase db push` from repo root.

### Core social

| Table | Purpose |
|-------|---------|
| `profiles` | Extends `auth.users`: username, display_name, avatar, bio, fitness_goals[], activities[], city, gender, match_preference, matching_enabled, visibility, is_premium, onboarding_complete, push prefs, presence (is_online, last_seen_at), is_trainer, referral_code, cover_image_url, notification_preferences JSONB, admin/ban flags |
| `posts` | content, media_urls[], thumbnail_url, post_type (text/photo/video/workout_update), workout_type, group_id, challenge_id, event_id, shared_post_id |
| `follows` | follower_id → following_id |
| `likes` | post likes (unique per user/post) |
| `comments` | threaded via parent_id |
| `comment_likes` | likes on comments |
| `post_reactions` | emoji reactions (❤️😂🔥👏💪) |
| `saved_posts` | bookmarks |

### Groups & challenges

| Table | Purpose |
|-------|---------|
| `groups` | name, sport_tags[], cover, owner, is_public |
| `group_members` | role: owner/admin/member |
| `challenges` | time-bound challenges, optional group; fields: title, description, **rules**, **cover_image_url**, start/end dates, created_by |
| `challenge_participants` | status: active/completed/left |

### Messaging

| Table | Purpose |
|-------|---------|
| `conversations` | DM threads |
| `conversation_members` | participants |
| `messages` | content, media_url, post_id (shared posts), read_at |
| `message_reactions` | emoji on messages |

### Notifications & push

| Table | Purpose |
|-------|---------|
| `notifications` | type + JSON payload, read_at; INSERT triggers push dispatch |
| `push_tokens` | Expo tokens per user/device/platform |
| `platform_config` | internal config (send_push URL for pg_net) |

### Training partners

| Table | Purpose |
|-------|---------|
| `matches` | user_a < user_b, status: pending/matched/unmatched |
| `match_swipes` | swipe history; clients SELECT-only (mutations via RPC) |

### Trainers (Phase 14A)

| Table | Purpose |
|-------|---------|
| `trainer_profiles` | bio, specialties, categories, budget, formats, verification, social |
| `trainer_certifications` | uploads + admin review status |
| `trainer_portfolio_photos` | portfolio images |
| `trainer_connections` | pending/connected/declined/removed |
| `trainer_reviews` | schema only — no UI yet |

### Events

| Table | Purpose |
|-------|---------|
| `events` | title, description, starts_at, location, workout_type, max_attendees, status |
| `event_attendees` | RSVP |
| `event_invitations` | invite athletes |

### Safety & admin

| Table | Purpose |
|-------|---------|
| `blocks` | triggers unfollow + auto-unmatch + decline trainer connections |
| `reports` | user/post/comment reports |

### Growth & analytics (Phase 15)

| Table | Purpose |
|-------|---------|
| `referrals` | referrer → referred |
| `beta_feedback` | bug/feature/general with feature_area, screen_path |
| `product_events` | client + DB-trigger analytics |

### Deferred stubs

| Table | Purpose |
|-------|---------|
| `products` | future marketplace |
| `subscription_plans`, `subscriptions` | future premium |

---

## 6. Storage buckets & RLS

All buckets are **public read** unless noted. Path convention: `{userId}/filename`.

| Bucket | Purpose | INSERT | UPDATE | DELETE |
|--------|---------|--------|--------|--------|
| `avatars` | Profile avatars + cover images | Own folder | Own | — |
| `posts` | Post photos/videos/thumbnails | Own folder | — | Own |
| `messages` | Chat media | Own folder | — | — |
| `trainer-certifications` | Cert PDFs/images | Trainer own | — | Trainer own |
| `trainer-portfolio` | Portfolio photos | Trainer own | — | Trainer own |
| `feedback-attachments` | Beta feedback files | Own folder | — | — |

RLS uses `auth.uid()::text = split_part(name, '/', 1)` (or `foldername(name)[1]` for trainer buckets).

Post table RLS was fixed for recursion (`20250617000002_fix_posts_rls_recursion.sql`) — visibility: self, follows, public groups.

Profile RLS (`20250617000001_fix_profiles_rls_recursion.sql`) — public profiles viewable; users update own; admins ban.

---

## 7. Key RPC functions

### Auth & profiles
- `handle_new_user()` — auto profile on signup
- `search_profiles(query, limit)`
- `claim_referral(code)`
- `set_presence(is_online)` / `expire_stale_presence(threshold)` — cron

### Feed
- `get_post_interaction_stats(post_ids, viewer_id)` — like/comment/saved counts
- `get_post_preview_comments(post_ids)` — top 2 comments per post

### Messaging
- `create_or_get_dm_conversation(user_a, user_b)`
- `is_conversation_member(conv_id, uid)` — RLS helper

### Training partners
- `get_match_candidates(limit)` — discovery deck
- `record_match_swipe(swipee_id, direction)` — swipe + mutual match
- `get_training_matches()` — active matches list
- `remove_training_match(match_id)`
- `gender_matches_preference`, `profiles_match_preferences`

### Trainers
- `upsert_trainer_profile(...)`, `get_trainer_profile(username)`, `search_trainers(...)`
- `request_trainer_connection`, `respond_trainer_connection`
- `start_trainer_conversation(other_user_id)` — gated after connect
- `review_trainer_certification`, `set_trainer_verification_level` — admin

### Safety
- `users_are_blocked`, `is_profile_banned`, `is_current_user_admin`
- `handle_block()` — side effects on block

### Analytics (Phase 15)
- `track_product_event`, `track_daily_active_user`, `get_product_analytics_summary(days)`

### Push
- `dispatch_push_notification()` — pg_net POST to `send-push` edge function

---

## 8. Feed implementation

### Data layer (`packages/api/src/posts.ts`)

- **`getFeed(userId, cursor)`** — fetches posts from followed users + self + group/challenge posts; cursor pagination (20/page)
- Enrichment via RPCs `get_post_interaction_stats` + `get_post_preview_comments` (falls back to direct queries)
- **`getFeedStories`** (`stories.ts`) — workout streaks from followed users
- **`getSuggestedAthletes`** (`suggestions.ts`)

Feed is a **client-side graph query**, not a single server RPC. RLS on `posts` controls visibility.

### UI layer

| File | Role |
|------|------|
| `app/(tabs)/index.tsx` | Infinite query `["feed", userId]`, stories, suggestions, lightbox hook |
| `components/FeedListItem.tsx` | Wraps `@frennix/ui` FeedPostCard |
| `packages/ui/src/FeedPostCard.tsx` | Post card layout |
| `packages/ui/src/FeedMediaSlot.tsx` | Feed-specific media container |
| `packages/ui/src/PostMediaCarousel.tsx` | Multi-image carousel |
| `packages/ui/src/PostMedia.tsx` | Single media; `layout="feed"` vs `"inline"` |
| `packages/ui/src/MediaAspectFrame.tsx` | Aspect-ratio container |
| `packages/ui/src/mediaLayout.ts` | Feed min height 280px, fallback ratios |
| `packages/ui/src/VideoPreview.tsx` | Video with poster + 72px play button |
| `components/ImageLightbox.tsx` | Full-screen pinch/pan (native) + zoom (web) |
| `lib/useImageLightbox.tsx` | Hook wired in feed + `app/post/[id].tsx` |

### Interactions

Hooks: `useFeedLike`, `usePostReaction`, `useSavePost`, `useSharePost`, `usePostOwnerActions`, `usePostViewerActions`.

**Post management (Priority 1 — live):**

| Surface | Owner menu | Non-owner menu |
|---------|------------|----------------|
| Three-dot (⋯) | Edit Post, Delete Post, Cancel | Share, Copy Link, Report, Cancel |

| Action | Implementation |
|--------|----------------|
| Edit | `app/edit-post/[id].tsx` — caption, workout type, media add/remove/replace/reorder (up to 10 photos or 1 video) |
| Delete | `usePostOwnerActions` → `deletePost()` — DB row + storage cleanup + optimistic cache removal |
| Copy link | `lib/post-link.ts` → `{APP_URL}/post/{id}` |
| Share (non-owner ⋯) | Opens in-app `SharePostSheet` (message/group/challenge) |
| Report | `useModeration.startPostReport` → `ReportReasonSheet` |

Cache helpers: `lib/post-cache.ts` — `removePostFromAllCaches`, `updatePostInAllCaches`, `invalidatePostQueries`.

Perf tracking: `trackFeedLoad` → `perf_feed_load` in `product_events`.

### Recent feed media behavior

- **Feed layout:** edge-to-edge, full width, `resizeMode="contain"`, dynamic height from image dimensions
- **Videos:** dynamic height, poster with contain (not cover), tap opens lightbox
- **Inline/detail:** rounded corners, smaller default height (220px)

---

## 9. Messaging

### API (`packages/api/src/messaging.ts`)

- `getConversations` — last message, unread count, other participant
- `getMessages`, `sendMessage`, `markMessagesAsRead`
- `getOrCreateConversation` → RPC `create_or_get_dm_conversation`
- `uploadMessageMedia` → `messages` bucket
- **Realtime:** `subscribeToMessages` (postgres_changes), `subscribeToTyping` (broadcast)

### App

- List: `app/(tabs)/messages.tsx`
- Chat: `app/chat/[conversationId].tsx` — realtime, typing, reactions, trainer badge, presence
- Training match → notification deep link → `getOrCreateConversation`

**Known perf issue:** `getConversations` uses N+1 queries per conversation.

---

## 10. Notifications

### In-app

- Table: `notifications`
- Types: follow, like, reaction, comment, comment_reply, message, match, trainer_connection_*, event_join, event_invite, challenge_join, post_share
- Realtime: `lib/useNotificationSubscription.ts`
- UI: `app/notifications.tsx`
- Deep links: `lib/notification-navigation.ts`

### Push pipeline

```
notifications INSERT
  → trigger dispatch_push_notification()
  → pg_net POST → supabase/functions/send-push/
  → Expo Push API → APNs
```

- Registration: `lib/notifications.ts` — permissions, token → `push_tokens`, badge sync
- Preferences: `profiles.notification_preferences` JSONB; `app/notification-settings.tsx`
- On receive: type-aware query invalidation (matches, conversations, trainer connections)

### Edge function

Deploy: `supabase functions deploy send-push`

Secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (auto on Supabase).

---

## 11. Events

- **API:** `packages/api/src/events.ts`
- **Routes:** `app/(tabs)/events.tsx`, `app/event/[id].tsx`, `app/create-event.tsx`, `app/edit-event/[id].tsx`, `app/event/[id]/invite.tsx`
- Join → creator notified (`event_join`); invite → `event_invite` + push
- Analytics: `event_joined` trigger on `event_attendees`

---

## 12. Matching (training partners & trainers)

### Training partners (Phases 4–13) — LIVE

Language: **Training partners / Connect / Training match** (not dating).

| Surface | Route | API |
|---------|-------|-----|
| Preferences | `/matching-settings` | `updateProfile`, `setMatchingEnabled` |
| Discovery | `/matching` | `getMatchCandidates`, `recordMatchSwipe` |
| Matches | `/matching/matches` | `get_training_matches` RPC |
| Readiness gate | — | `lib/training-partner-readiness.ts` |

Readiness requires: gender, city, ≥1 goal, ≥1 activity, matching_enabled.

**Recent fix:** null-safe readiness check in `app/matching/index.tsx`; defensive parsing in `packages/api/src/matching.ts`; `components/MatchingRouteErrorBoundary.tsx`.

### Trainers (Phase 14A) — LIVE

| Surface | Route |
|---------|-------|
| Discovery | `/trainers` |
| Connections | `/trainers/connections` |
| Public profile | `/trainer/[username]` |
| Setup/edit | `/trainer-profile/setup`, `/edit` |
| Admin cert review | `/admin-trainer-review` |

**Phase 14B** (Trainer Leads Dashboard): planning only — see `features/trainers/PHASE-14B.md`.

Docs: `features/matching/README.md`, `features/trainers/README.md`.

---

## 13. Media uploads

| Use case | Bucket | API module |
|----------|--------|------------|
| Avatar | `avatars` | `profiles.uploadAvatar` |
| Cover | `avatars` | `profiles.uploadCoverImage` |
| Post photo/video | `posts` | `posts.uploadPostMedia` |
| Video thumbnail | `posts` | `posts.uploadPostThumbnail` |
| Chat media | `messages` | `messaging.uploadMessageMedia` |
| Trainer cert | `trainer-certifications` | `trainer.ts` |
| Portfolio | `trainer-portfolio` | `trainer.ts` |
| Feedback | `feedback-attachments` | `feedback.ts` |

**Limits** (`packages/api/src/upload-utils.ts`): images 20 MB, videos 50 MB.

**Post flow:** pick media → upload to storage → insert `posts` row with URLs → optional thumbnail for video.

---

## 14. Presence

**Client:** `lib/presence.ts` — heartbeat every `PRESENCE_HEARTBEAT_MS`, offline debounce 2 s on background, RPC queue serialization.

**Server:** `profiles.is_online`, `profiles.last_seen_at`; `set_presence` RPC; cron `expire_stale_presence` (5 min threshold).

**UI:** Realtime subscription on profile presence fields; shown on matches list and chat.

---

## 15. Completed features by phase

| Phase | Feature | Status |
|-------|---------|--------|
| MVP | Auth, feed, DMs, groups, challenges, follow, report/block | Live |
| 4–6 | Training partner prefs, deck, matches | Live |
| 7 | Presence hardening | Live |
| 8–9 | Match notifications, push hardening | Live |
| 10 | Match removal & block auto-unmatch | Live |
| 11 | Settings + discovery readiness gate | Live |
| 12 | Pre-production QA scripts | Live |
| 13 | Production readiness (RLS, Sentry, cron) | Live |
| 14A | Trainer matching | Live |
| 14B | Trainer Leads Dashboard | Blocked |
| 15 | Analytics, feedback, perf tooling | Implemented — exit criteria **not met** |
| Premium | Subscriptions | Deferred |
| Marketplace | Products | Deferred |

### Phase 15 exit criteria (not yet met)

- [ ] ≥10 athlete testers — Training Partners critical path
- [ ] ≥5 athletes + ≥3 trainers — Trainer Matching critical path
- [ ] 2+ weeks analytics with real usage
- [ ] P0 bugs resolved; P1 triaged
- [ ] Performance baselines recorded

See `features/validation/PHASE-15.md`.

---

## 16. Deployment

### Database

```bash
cd apps/mobile   # or monorepo root if using parent supabase link
supabase link --project-ref wkrwncovmpsveatlrqel
supabase db push
supabase functions deploy send-push
```

### Local dev

```bash
pnpm install          # from apps/mobile (workspace includes packages/*)
npx expo start --clear
```

### Web (production)

Production currently deploys from **committed `dist/`** (pre-built static export):

```bash
pnpm build:web        # expo export -p web → dist/
npx vercel --prod --yes --project frennix   # from apps/mobile
```

Parent monorepo `vercel.json` expects `apps/mobile/dist` as output when building from monorepo root.

**Recent production deploys:**
- Logo fix: `dpl_H4HugR9ycrpgY9LHmS9Upy3CzfWi`
- Photo lightbox: `dpl_5Dxo2gLYVRTJvJbgoqt48W1zR3ej`
- Feed media sizing: `dpl_6Tx4aU8nDX88SSjLYwejGXKmJFWx`

### iOS (EAS)

```bash
eas build --profile preview --platform ios      # internal
eas build --profile production --platform ios   # TestFlight
eas submit --platform ios --profile production
```

Bundle ID: `com.frennix.app`. Profiles in `eas.json`.

---

## 17. Verification scripts

```bash
cd apps/mobile

# Matchmaking QA (Phases 4–13, expect 30+ PASS)
npx tsx scripts/verify-matchmaking-qa.ts

# Phase 15 analytics + feedback
npx tsx scripts/verify-phase15.ts

# Feed photo display (mock-based, 12 checks)
node scripts/verify-photo-display.cjs

# Load test (requires TEST_USER_JWT)
TEST_USER_JWT=... npx tsx scripts/load-test-match-candidates.ts

# Perf baselines
npx tsx scripts/measure-feed-perf.ts
npx tsx scripts/measure-messaging-perf.ts
npx tsx scripts/measure-trainer-search-perf.ts
```

Human QA checklists: `features/matching/QA.md`, `features/validation/*-RUT.md`.

---

## 18. Known issues

| Issue | Severity | Notes |
|-------|----------|-------|
| Phase 15 exit not met | High | Blocks 14B and new features |
| Human device QA pending | Medium | Training partners production sign-off |
| Privacy policy URL | Medium | May need live site update |
| Messaging N+1 | Medium | `getConversations` perf at scale |
| Legacy `profiles.push_token` | Low | Coexists with `push_tokens` table |
| `pg_cron` schedule | Low | May need manual setup if extension unavailable |
| Trainer reviews UI | Low | Table exists, no UI |
| eas.json placeholders | Low | Apple IDs for submit |

---

## 19. Technical debt

1. **Git scope was mobile-only** — `packages/` and `supabase/` now vendored inside git root; consider elevating git to full monorepo root to avoid duplication with parent `/Users/startswithu/Source/frennix`.
2. **Web deploys from committed `dist/`** — CI should build from source once packages are fully in git.
3. **No server-side feed RPC** — complex client OR + RLS; consider materialized feed view at scale.
4. **Messaging conversation list** — needs batch query or RPC.
5. **Performance baselines empty** — see `features/validation/PERFORMANCE.md`.
6. **Deferred features** — premium, marketplace, live streaming, payments/booking.

---

## 20. Recommended next priorities

1. **Priority 2 — Media experience** — pre-post crop/zoom/rotate polish, full-screen viewer enhancements, video thumbnail + playback UX.
2. **Priority 3 — Feed performance** — lazy loading, image/thumbnail caching, infinite scroll optimization, eliminate unnecessary re-renders, instant cache updates on all interactions.
3. **Priority 4 — Security verification** — confirm owner-only edit/delete, RLS policies, API guards.
4. **Priority 5 — Error handling** — friendly messages, no stuck loading states.
5. **Priority 6 — Testing** — full mobile + web QA checklist before marking complete.
6. **Phase 15 validation** — resume beta cohort recruitment after post-management milestones ship.
7. **Fix messaging perf** — batch conversation metadata query or RPC before scaling users.
8. **CI web builds** — stop relying solely on committed `dist/`; build in Vercel from source.

---

## 21. Post management roadmap

| Priority | Feature | Status |
|----------|---------|--------|
| 1 | Complete post management (menus, edit, delete, storage cleanup, cache updates) | **Done** |
| 2 | Media experience (crop, zoom, full-screen, video playback) | Pending |
| 3 | Feed performance (lazy load, caching, infinite scroll, instant updates) | Pending |
| 4 | Security verification (RLS, owner-only guards) | Pending |
| 5 | Error handling polish | Pending |
| 6 | Full mobile + web QA | Pending |

### Phase A — Shared ownership framework (completed)

All owner-managed content uses the same three-layer pattern:

| Layer | File | Role |
|-------|------|------|
| Core types | `lib/entity-actions.ts` | `EntityActionId`, `EntityActionDefinition`, standard owner/viewer presets |
| Shared UI | `components/EntityActionSheet.tsx` | Configurable ⋯ menu + Cancel |
| Shared UI | `components/EntityListSheet.tsx` | Participants / attendees modal |
| Link helpers | `lib/entity-link.ts` | `copyEntityLink`, `shareEntityLink` (used by `*-link.ts` per entity) |

**Per-entity wiring** (add a row for each new content type):

| Entity | Registry | Hook | Link helper |
|--------|----------|------|-------------|
| Post | `lib/post-actions.ts` | `lib/usePostActions.tsx` | `lib/post-link.ts` |
| Challenge | `lib/challenge-actions.ts` | `lib/useChallengeActions.tsx` | `lib/challenge-link.ts` |
| Event | `lib/event-actions.ts` | `lib/useEventActions.tsx` | `lib/event-link.ts` |

**Standard owner menu:** Edit, Delete, Share, Copy Link (+ entity extras: View Participants, Invite, Close Early, etc.)

**Standard viewer menu:** Share, Copy Link, Report, Block

**Removed (replaced by framework):** `PostActionSheet`, `PostViewerActionSheet`, `ChallengeActionSheet`, `usePostOwnerActions`, `usePostViewerActions`

### Priority 1 deliverables (completed)

- Unified `usePostActions` on `EntityActionSheet` — owner: Edit, Delete, Share, Copy Link; viewer: Share, Copy Link, Report, Block
- Edit: caption, workout type, photos/videos with add/remove/replace/reorder
- Delete: confirmation, DB + storage cleanup, instant feed removal
- Profile grid: long-press opens owner menu for **all** own posts (not media-only)
- API: `updatePost` extended for media fields; `removePostsStorageFiles` helper
- Cache: optimistic updates across feed, profile, group, challenge, event, saved-posts

### Challenge management

| Layer | File |
|-------|------|
| Registry | `lib/challenge-actions.ts` |
| Hook | `lib/useChallengeActions.tsx` |
| Links | `lib/challenge-link.ts` |

**Owner ⋯:** Edit, Delete, Share, Copy Link, Duplicate (placeholder), View Participants, Close Early (hidden when ended)

**Viewer ⋯:** Share, Copy Link, Report, Block

- Migrations: `20250630000001_challenge_management.sql`, `20250630000002_challenge_reports.sql`

### Event management (Phase A)

| Layer | File |
|-------|------|
| Registry | `lib/event-actions.ts` |
| Hook | `lib/useEventActions.tsx` |
| Links | `lib/event-link.ts` |

**Owner ⋯:** Edit, Cancel, Share, Copy Link, View Attendees, Invite Athletes (hidden when cancelled)

**Viewer ⋯:** Share, Copy Link, Report, Block

- Report: `reportEvent` → `reports.reported_event_id` (migration `20250630000003_event_reports.sql`)
- Event detail: header ⋯ replaces inline creator buttons; Join/Leave remains a primary CTA

**Apply migrations:** `supabase db push` (`20250630000001`, `20250630000002`, `20250630000003`).

### Phase A QA checklist

Test on **web + mobile** before Priority 2 (Media Experience):

- [ ] Post owner ⋯: Edit, Delete, Share (in-app sheet), Copy Link
- [ ] Post viewer ⋯: Share, Copy Link, Report, Block
- [ ] Profile grid long-press on text-only own post → owner menu
- [ ] Challenge owner/viewer menus match standard + View Participants / Close Early
- [ ] Event ⋯ menu: creator vs non-creator actions; Cancel event; View Attendees sheet
- [ ] Event share/copy link opens correct `/event/{id}` URL
- [ ] Block removes author content from feed after refresh

**Do not start Priority 2 until user approves after QA passes.**

### Priority 1 QA checklist (superseded by Phase A above)

---

## 22. Quick reference

### `packages/api/src/` modules

| Module | Domain |
|--------|--------|
| `supabase`, `auth` | Client init, email/Apple auth |
| `profiles`, `profile-utils` | CRUD, avatar/cover, search |
| `posts`, `comments`, `reactions`, `saved-posts`, `share` | Feed + post management |
| `follows`, `suggestions`, `groups`, `challenges` | Social graph |
| `messaging`, `presence` | DMs, typing, presence |
| `notifications`, `notification-preferences`, `push-tokens` | Notifications |
| `matching`, `trainer` | Matching |
| `events` | Workout events |
| `moderation` | Block/report |
| `stories`, `streaks`, `achievements` | Stories, streaks, badges |
| `referrals`, `feedback`, `analytics` | Growth & Phase 15 |
| `upload-utils`, `media-utils`, `video-thumbnail` | Media |

### Sentry tags

`matchmaking_domain`: `match_swipe`, `match_candidates`, `match_remove`, `presence`, `push_registration`

### Related docs

| Doc | Path |
|-----|------|
| Training partners | `features/matching/README.md` |
| Trainer matching | `features/trainers/README.md` |
| Phase 15 | `features/validation/PHASE-15.md` |
| Security / RLS | `features/matching/SECURITY.md` |
| Production | `features/matching/PRODUCTION.md` |
| QA checklist | `features/matching/QA.md` |

### Commands cheat sheet

```bash
pnpm install && npx expo start --clear
supabase db push
supabase functions deploy send-push
pnpm build:web
npx tsx scripts/verify-matchmaking-qa.ts
npx tsx scripts/verify-phase15.ts
```
