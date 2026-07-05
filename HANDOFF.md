# Frennix — Comprehensive Agent Handoff

**Last updated:** July 5, 2026  
**Purpose:** Single source of truth for any agent continuing development  
**Production web:** https://frennix.vercel.app  
**Supabase project:** `wkrwncovmpsveatlrqel`  
**Git remote:** https://github.com/Frennix/Frennix.git (git root = `apps/mobile`)

**Companion documents (read these too):**
- [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) — all UI/UX standards
- [`ROADMAP.md`](./ROADMAP.md) — version-based product roadmap
- [`DEVELOPMENT_STANDARDS.md`](./DEVELOPMENT_STANDARDS.md) — permanent dev standards (stabilize → perform → polish → features)
- [`features/PRODUCT_VISION.md`](./features/PRODUCT_VISION.md) — mission and alignment rules
- [`features/releases/RELEASE_PROCESS.md`](./features/releases/RELEASE_PROCESS.md) — official release SOP

---

## Table of contents

1. [Project overview](#1-project-overview)
2. [Current feature status](#2-current-feature-status)
3. [UI / UX standards](#3-ui--ux-standards)
4. [Bugs](#4-bugs)
5. [Outstanding work](#5-outstanding-work)
6. [Performance improvements](#6-performance-improvements)
7. [Database](#7-database)
8. [Deployment](#8-deployment)
9. [Coding standards](#9-coding-standards)
10. [Next priorities](#10-next-priorities)
11. [New agent instructions](#11-new-agent-instructions)
12. [Technical debt](#12-technical-debt)
13. [Session summary](#13-session-summary)
14. [Final recommendations](#14-final-recommendations)
15. [Permanent development standards](#15-permanent-development-standards)
16. [Component architecture](#16-component-architecture)
17. [Branch status & repository state](#17-branch-status--repository-state)
18. [Assumptions, risks & verified state](#18-assumptions-risks--verified-state)

---

## 1. Project overview

### Purpose and vision

**Frennix** is a fitness social platform — not another generic social media app. The mission is to help people build lasting fitness habits through real human connection: find training partners, stay accountable, log workouts, and train together.

**Litmus test for every feature:**

> *"Does this make it easier or more motivating for someone to stay consistent with their fitness journey?"*

Frennix is in **product building mode** (Founder-approved 2026-07-04): architecture is mature enough; competitive advantage comes from execution, polish, and a best-in-class fitness experience.

**Read before coding:** `features/PRODUCT_VISION.md`

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Expo Router app (apps/mobile)                              │
│  ├── app/           File-based routes                       │
│  ├── components/    App-specific UI (~93 files)             │
│  ├── lib/           Client helpers (~142 files)             │
│  ├── providers/     AuthProvider, QueryProvider, TabBadge   │
│  └── features/      Docs, release SOP, QA checklists        │
├─────────────────────────────────────────────────────────────┤
│  @frennix/ui        Design tokens + shared components       │
│  @frennix/api       Supabase client + domain API (40+ mod)  │
│  @frennix/types     Shared TypeScript types                 │
│  @frennix/matching  Compatibility scoring engine            │
├─────────────────────────────────────────────────────────────┤
│  Supabase (wkrwncovmpsveatlrqel)                            │
│  ├── Postgres + RLS (78 migrations)                         │
│  ├── Auth (email, Apple)                                    │
│  ├── Storage (6 public buckets)                             │
│  ├── Realtime (messages, notifications, presence)           │
│  └── Edge Functions (send-push, founder-bootstrap-init)     │
└─────────────────────────────────────────────────────────────┘
```

| Layer | Technology |
|-------|------------|
| Mobile / Web | Expo SDK ~52, React Native 0.76.6, Expo Router ~4 |
| New Architecture | Enabled (`newArchEnabled: true`) |
| Web | react-native-web ~0.19; static export to `dist/` |
| State / data | **TanStack Query 5** (primary); React Context (auth, badges) |
| Forms | React Hook Form + Zod |
| Icons | **Lucide React Native** (migrated off Ionicons for Safari) |
| Animation | Reanimated 3, Gesture Handler |
| Images | expo-image (CachedImage, ProgressiveImage) |
| Monitoring | Sentry (`@sentry/react-native`) |
| Push | Expo Notifications → `push_tokens` → edge function → APNs |
| Package manager | pnpm 9.15.0 (Node ≥20) |

**Note:** `zustand` is in `package.json` but **has zero imports** — do not expect Zustand stores.

### Repository structure

**Important:** Two filesystem layouts exist.

| Location | Role |
|----------|------|
| `/Users/startswithu/Source/frennix/` | Parent monorepo — `apps/*`, `packages/*`, `supabase/` |
| `/Users/startswithu/Source/frennix/apps/mobile/` | **Git root** — self-contained clone with vendored `packages/` and `supabase/` |

Git tracks **`apps/mobile`** as the repo root. Local dev may use parent monorepo symlinks via `metro.config.js` (watches `../..`).

```
apps/mobile/                    ← GIT ROOT
├── app/                        Expo Router screens
│   ├── (auth)/                 login, signup, forgot-password, welcome
│   ├── (tabs)/                 feed, discover, messages, profile, events (Calendar)
│   ├── matching/               training partner deck + matches
│   ├── trainers/               trainer discovery
│   ├── chat/[conversationId]   DM thread
│   ├── training-calendar/      session CRUD
│   ├── founder/                founder dashboard
│   ├── stories/                story explore/discover
│   └── ...
├── components/                 BottomActionSheet, PostInteractionSheet, etc.
├── lib/                        hooks, caches, entity-actions, web helpers
├── providers/                  AuthProvider, QueryProvider, TabBadgeProvider
├── features/                   Phase docs, release SOP, product vision
├── scripts/                    54 verification/perf/repro scripts
├── packages/                   @frennix/api, @frennix/types, @frennix/ui, @frennix/matching
├── supabase/                   78 migrations, seed, edge functions
├── dist/                       Pre-built web export (committed for Vercel)
├── HANDOFF.md                  This document
├── DESIGN_SYSTEM.md            UI/UX standards
└── ROADMAP.md                  Product roadmap
```

### Key routes

| Route | Purpose |
|-------|---------|
| `/` | Auth gate → login / onboarding / tabs |
| `/(tabs)/index` | Main feed |
| `/(tabs)/discover` | People, Groups, Challenges |
| `/(tabs)/events` | **Calendar** tab (labeled "Calendar" in tab bar) |
| `/(tabs)/messages` | Conversation list |
| `/(tabs)/profile` | Own profile |
| `/matching` | Training partner swipe deck |
| `/matching/matches` | Active matches |
| `/create-post` | New post / workout log |
| `/create-story` | Workout story |
| `/chat/:conversationId` | DM |
| `/notifications` | Notification center |
| `/settings` | Account, safety, prefs |
| `/founder/*` | Founder dashboard (staff only) |

### Current production version

| Field | Value |
|-------|-------|
| **Production URL** | https://frennix.vercel.app |
| **Last closed release** | **v1.0.2** (2026-07-04) — workout sharing hotfix |
| **Active release** | **v1.0.3** (In Progress) — Safari overlay stabilization + Phase A feed interaction |
| **Production bundle** | `index-b58c16d64459ae4d864a05f61b1c4444.js` |
| **Latest deploy** | `dpl_3aKaPXDnxoccvELGGRwbfDxaptgZ` (Phase A) |
| **Supabase migrations** | 78 local; verified 78/78 remote at v1.0.2 ship |
| **Automated QA (2026-07-05)** | `verify-post-interaction.mjs` **PASS** on production |

**Note:** v1.0.3 code (BottomActionSheet, Phase A, BUG-004 fixes) is deployed to production but **not formally closed** — pending Founder physical iPhone Safari sign-off on BUG-002/003/004.

### Environment requirements

| Requirement | Version / detail |
|-------------|------------------|
| Node.js | ≥20 |
| Package manager | pnpm 9.15.0 |
| Expo SDK | ~52.0.23 |
| React Native | 0.76.6 |
| Supabase CLI | For `db push`, `migration list`, edge functions |
| Playwright | Optional — for local `verify-post-interaction.mjs` (Chromium) |
| EAS CLI | For iOS builds (`eas build`) |
| Vercel CLI | For production deploy (`npx vercel`) |

Copy `.env.example` → `.env` with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (required).

### Development environment

```bash
cd apps/mobile
cp .env.example .env          # Fill Supabase URL + anon key
pnpm install
pnpm start                    # Expo dev server
pnpm build:web                # Static web export + patch-web-html.js
pnpm typecheck
```

**EAS (iOS):** `eas build --profile preview --platform ios` (internal) or `production` (TestFlight).

### Deployment workflow

**Web production:**
```bash
cd apps/mobile
pnpm build:web
npx vercel deploy --prod --yes --project frennix   # NOT --project mobile
```

**Strategy:** Vercel serves **committed `dist/`** — does not build from source in git-root deploy. Engineers build locally, commit `dist/`, then deploy.

**Database (before client deploy):**
```bash
supabase link --project-ref wkrwncovmpsveatlrqel
supabase db push
supabase functions deploy send-push
```

**Release process:** Seven phases in `features/releases/RELEASE_PROCESS.md`. Gate validator:
```bash
npx tsx scripts/verify-release-gates.ts --release features/releases/RELEASE-vX.Y.Z.md --phase staging
```

---

## 2. Current feature status

Status legend: **Complete** | **Stable** | **In Progress** | **Needs Refactoring** | **Planned**

### Authentication — **Stable**

- Routes: `app/(auth)/login.tsx`, `signup.tsx`, `forgot-password.tsx`, `welcome.tsx`, `reset-password.tsx`
- Provider: `providers/AuthProvider.tsx` — session, profile cache, push, presence, password recovery
- API: `packages/api/src/auth.ts` — email, Apple OAuth
- Gate: `app/index.tsx` waits for `authReady` before routing
- **June 2026 fix:** Safari resume no longer routes completed users to onboarding

### Profiles — **Stable**

- Routes: `profile.tsx`, `edit-profile.tsx`, `user/[username].tsx`, followers/following
- API: `profiles.ts`, `follows.ts`
- Features: avatar/cover upload, lifestyle fields, workout streak, online status privacy toggle
- Onboarding: `app/onboarding.tsx` — username, goals, activities, lifestyle, match prefs

### Feed — **Needs Refactoring**

- Route: `app/(tabs)/index.tsx` — infinite feed, stories row, suggestions, story viewer
- UI: `FeedPostCard`, `PostInteractionSheet`, `BottomActionSheet`, `WebFeedScrollList`
- **Phase A deployed:** **⋯** → interaction sheet; **＋** removed from reaction bar
- **Open:** BUG-002 (sheet clipping), BUG-004 (post-dismiss freeze/black band) on iPhone Safari
- Docs: `features/releases/FEED-POST-INTERACTION-PATTERN.md`

### Posts — **Stable**

- Routes: `create-post.tsx`, `edit-post/[id].tsx`, `post/[id].tsx`, `saved-posts.tsx`
- API: `posts.ts`, `comments.ts`, `reactions.ts`, `saved-posts.ts`
- v1.0.2 fixed P0 workout/photo/video sharing (BUG-001 closed)
- Ownership: `usePostActions` + `EntityActionSheet` on detail/profile; feed uses `PostInteractionSheet`

### Stories — **Stable**

- Routes: `create-story.tsx`, `stories/explore.tsx`, `stories/discover.tsx`
- API: dedicated story system (`stories.ts`, `story-publish.ts`, `story-engagement.ts`, etc.)
- Feed: story row + full-screen viewer with hard scroll lock
- **Gap:** Story Replies = `coming_soon`

### Workout logging — **Stable**

- Primary: `app/create-post.tsx` — workout types, metrics, media, optional story cross-post
- Calendar CTA: "Start Workout" from Training Calendar
- API: `workout-activity.ts` — streaks from posts + calendar + story commitments
- **Planned:** **＋ Quick Log Workout** on reaction bar (Phase C)

### Messaging — **Stable**

- Routes: `messages.tsx`, `chat/[conversationId].tsx`
- v0.8.0 Realtime stability shipped
- Features: DMs, typing, reactions, pin/mute/favorite/hide/delete, presence banners
- Favorite Training Partners rail (max 5)
- **P2 planned:** read receipts, media polish, N+1 conversation list fix

### Notifications — **Stable**

- Routes: `notifications.tsx`, `notification-settings.tsx`
- Push pipeline: DB trigger → `send-push` edge function → Expo → APNs
- Realtime subscription + tab badges via `TabBadgeProvider`

### Calendar (Training Calendar) — **In Progress**

- Tab: `app/(tabs)/events.tsx` (labeled "Calendar")
- Sub-routes: `training-calendar/create.tsx`, `edit/[id].tsx`, `[id].tsx`
- v1.0.1 shipped: Today's Focus, month/week views, session CRUD, invites
- **Open:** BUG-003 — half blocked on iPhone Safari
- **Shell only:** Training Together Today (data in v1.1)

### Discover — **Stable**

- Route: `app/(tabs)/discover.tsx` — People | Groups | Challenges
- Frennix Match compatibility scoring in People tab
- Separate from swipe deck at `/matching`

### Frennix Match — **Stable** (scoring) / **In Progress** (swipe/P1)

- **Scoring (Discover):** `packages/matching/` — stable
- **Swipe deck (P1):** `/matching` — code ~95% complete; v1.0.0 rolled back; GA pending human QA

### Events — **Stable**

- Routes: `events/browse.tsx`, `create-event.tsx`, `event/[id].tsx`, invite, edit
- Integrated in Calendar tab
- **Known:** RSVP confirmations may lag (P2)

### Training partners — **In Progress**

- Swipe deck: `/matching` (P1)
- Favorite partners: Messages tab section — live
- **Planned v1.1:** Training Together Today, Need a Partner Today

### Run Club — **Planned**

- No app routes; schema stubs only (`run_club` source_type, `run_club_first` achievement)
- Target: P3 Groups v1.2 — Frennix Run Clubs creation wizard

### Settings — **Stable**

- Route: `app/settings.tsx` — account, matching, trainers, safety, notifications, privacy, feedback
- Staff gate → Founder Dashboard link

### Admin / Founder — **Stable** (expansion paused)

- Legacy: `admin-moderation.tsx`, `admin-analytics.tsx`, `admin-trainer-review.tsx`
- Founder Dashboard: `app/founder/*` — M7.1–M7.3 shipped; paused until P1–P7

### Storage — **Complete**

6 Supabase buckets: `avatars`, `posts`, `messages`, `feedback-attachments`, `trainer-certifications`, `trainer-portfolio`

### Database — **Complete**

78 migrations; RLS on all user tables; SECURITY DEFINER RPCs for hot paths

### API integrations — **Complete**

Supabase Auth + PostgREST + Realtime + Storage; Expo push; Apple Sign-In; Sentry; Vercel web

---

## 3. UI / UX standards

**Companion documents (read these too):**
- [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) — all UI/UX standards
- [`DEVELOPMENT_STANDARDS.md`](./DEVELOPMENT_STANDARDS.md) — permanent dev standards

### Agreed design decisions

| Area | Decision |
|------|----------|
| **BottomActionSheet** | Reusable shell for all action sheets — spring open/dismiss, swipe-down, `fitToContent`, no body scroll lock |
| **PostInteractionSheet** | Canonical reference — do not fork shell logic |
| **Safe area** | 28px (`OVERLAY_BOTTOM_SAFETY_MARGIN_PX`) above Safari toolbar / home indicator on all overlays |
| **Safari viewport** | `visualViewport`-based tab scene height; sheet-scoped layout hook only while visible |
| **Feed layout** | Wrapper flex-fill (`webTabSceneContainerStyle`) + bounded scroll child only (`webTabSceneHeightStyle`) |
| **Native iPhone feel** | Spring physics, content-sized sheets, no scroll for ≤6 actions, smooth dismiss |
| **Feed after sheet** | Fully interactive — no freeze, no black band, no scroll lock remnant |
| **Post trigger** | Header **⋯** only for sheet (Phase A); caption tap → sheet is secondary (remove in polish) |
| **Reaction bar +** | Removed (Phase A); reserved for **Quick Log Workout** (Phase C) — fitness identity |
| **Animations** | Sheet: damping 24/28 spring; navigation: 200ms fade; press: 0.97 scale |
| **Typography** | `@frennix/ui` theme tokens; action sheet font scale cap 1.35 |
| **Spacing** | xs=4, sm=8, md=16, lg=24, xl=32 |
| **Corner radius** | sm=8, md=12, lg=16, sheet top ~24px |
| **Colors** | Dark theme; background `#0A0A0B`, accent green `#22C55E` |
| **Component reuse** | `MenuIconButton`, `ActionSheetTile`, `ActionSheetPriorityGrid`, `ScalePressable` |
| **Icons** | Lucide SVG only (not font icons) |
| **Ownership menus** | `EntityActionSheet` + `use*Actions` hooks — migrate to BottomActionSheet (Phase B) |

### Design principles going forward

1. Physical iPhone Safari test before any new UI is "complete" (Rule 13)
2. Design system compliance before merge (Rule 14)
3. Extend existing components before creating new ones
4. Fitness-first affordances over generic social patterns
5. Never reintroduce global `OverlaySafeAreaProvider` (black screen regression)
6. Never set `document.body.overflow = hidden` from interaction sheets (BUG-004)

### Key files

| File | Role |
|------|------|
| `components/BottomActionSheet.tsx` | Reusable sheet shell |
| `components/PostInteractionSheet.tsx` | Feed post actions |
| `components/ActionSheetGrid.tsx` | Grid + tiles |
| `lib/use-bottom-action-sheet-layout.ts` | Safari toolbar lift |
| `lib/web-document-scroll-lock.ts` | Post-dismiss scroll restore |
| `lib/web-tab-scene-layout.ts` | Tab viewport height |
| `components/WebFeedScrollList.tsx` | Safari-safe feed scroll |
| `packages/ui/src/theme.ts` | Design tokens |

---

## 4. Bugs

**Canonical trackers:** `features/releases/v1.0.3-BUG-LIST.md`, `features/releases/RELEASE.md`

### Open (pending verification / in progress)

| ID | Sev | Priority | Found | Fixed | Status | Flow | Summary |
|----|-----|----------|-------|-------|--------|------|---------|
| **BUG-002** | P1 | Next patch | v1.0.2 | — | **In Progress** | Post interaction sheet | Bottom sheet cut off on iPhone Safari — buttons behind browser toolbar. Clipping improved; **not closed** until Founder confirms. |
| **BUG-003** | P2 | Next patch | v1.0.3 | — | **In Progress** | Training Calendar | Calendar half blocked on iPhone Safari — viewport height / dead scroll band |
| **BUG-004** | P1 | Fix immediately | v1.0.3 | — | **In Progress** | Feed + sheet | After closing sheet — feed black dead band and/or frozen. Fix deployed (automated PASS); **not closed** until Founder confirms. |

### Fixed (shipped, closed)

| ID | Sev | Found | Fixed | Status | Summary |
|----|-----|-------|-------|--------|---------|
| **BUG-001** | P0 | v1.0.1 | v1.0.2 | **Closed** | Workout/photo/video sharing fails — `event_type` column missing. Postmortem closed. |
| **STAB-001** | P1 | v1.0.1 | v1.0.2 | **Closed** | `getErrorMessage` exposed Supabase codes |
| **STAB-002** | P1 | v1.0.1 | v1.0.2 | **Closed** | Raw stack traces in error boundaries |
| **STAB-003** | P2 | v1.0.1 | v1.0.2 | **Closed** | Stale verify-post-login checks |

### Verified (automated PASS, awaiting Founder device sign-off)

| ID | Automated verification | Notes |
|----|------------------------|-------|
| BUG-002 | `verify-post-interaction.mjs` PASS — tiles visible, tappable | Founder iPhone Safari extended scenarios still ⬜ |
| BUG-004 | `verify-post-interaction.mjs` post-dismiss feed PASS | `touchBlocked: false`, `feedTappable: true` |
| BUG-003 | `verify-calendar-viewport.mjs` | Run after `build:web`; Founder device ⬜ |

### Known issues (no BUG-ID)

| Feature | Sev | Status | Notes |
|---------|-----|--------|-------|
| Events RSVP lag | P2 | temporary_issue | Confirmations may lag; RSVP still saved |
| Training Together Today | P3 | coming_soon | UI shell; data v1.1 |
| Story Replies | P3 | coming_soon | Planned |

### Known regressions (do not reintroduce)

| Regression | Cause | Fix reference |
|------------|-------|---------------|
| Feed black dead band after sheet | Triple-applied fixed height on feed wrapper | BUG-003/004 layout pattern |
| Feed freeze after sheet | `document.body.overflow = hidden` from sheet | `restoreWebDocumentScrollLock()` |
| Feed pointer freeze | `touchAction: none` on feed for sheets | Soft scroll lock only |
| Black screen overlay | Global `OverlaySafeAreaProvider` | Do not reintroduce |
| v1.0.0 Safari layout break | Matchmaking GA deploy | Rolled back to v0.8.0 |

### Doc gaps

- BUG-004 missing from `RELEASE.md` v1.0.3 bug fixes table (present in `v1.0.3-BUG-LIST.md`)
- `whats-new.ts` still shows v1.0.2 as latest version

---

## 5. Outstanding work

Prioritized by importance.

### P0 — Block release close

1. Founder physical iPhone Safari QA on BUG-002, BUG-003, BUG-004
2. Complete 43 Critical User Flows (`checklists/CRITICAL-USER-FLOWS.md`)
3. Overlay modal QA — 4 browsers + iPhone Safari extended (`checklists/OVERLAY-MODAL-QA.md`)
4. Postmortems for closed bugs per `POSTMORTEM-PROCESS.md`

### P1 — Next development (after v1.0.3 close)

1. **Phase B** — merge `EntityActionSheet` actions (Report, Delete, Copy Link, Block) into `PostInteractionSheet` More panel; retire separate ⋯ on feed/profile/detail
2. **Phase C** — **＋ Quick Log Workout** on reaction bar (Founder decision)
3. Feed polish — caption tap → post detail only; remove secondary sheet triggers
4. Screen alignment — post detail, profile, saved posts, groups still use `EntityActionSheet`

### P2 — v1.1.0 product work

1. Training Together Today data layer (`getPartnersTrainingToday` — currently returns `[]`)
2. P1 Matchmaking GA — human QA, privacy review, load test, deploy
3. P2 Messaging polish — read receipts, media, conversation list N+1 fix
4. Story Replies
5. Events RSVP lag fix
6. Migrate remaining overlays to `BottomActionSheet` per design system

### P3 — Backlog

1. Haptics on sheet open; staggered tile animation; inline double-tap like
2. Run Club creation wizard (P3 Groups)
3. Challenge/event analytics placeholders → real
4. Update `verify-post-login.ts` stale expectations
5. Commit design system docs if still uncommitted

---

## 6. Performance improvements

### Known issues

| Issue | Area | Status | Mitigation |
|-------|------|--------|------------|
| **Feed freeze after sheet** | Safari web | Fix deployed | `restoreWebDocumentScrollLock()`, soft scroll lock |
| **Feed black dead band** | Safari web | Fix deployed | Flex-fill wrapper + bounded scroll child |
| **Sheet clipping** | iPhone Safari | Improved | `useBottomActionSheetLayout`, 28px margin |
| **Calendar viewport** | iPhone Safari | Open (BUG-003) | `useTabScreenWebHeightStyle` on events tab |
| **Messaging N+1** | `getConversations` | Known | Per-conversation queries; needs batch RPC |
| **Feed cold load** | Network | Measured | `measure-feed-perf.ts`; client-side graph query |
| **Fast scroll jank** | Feed media | Mitigated | Deferred media mount, prefetch, windowSize tuning |
| **Tab switch cold cache** | Navigation | Mitigated | `TabPrefetchCoordinator`, lazy:false tabs |
| **Safari tab resume refetch** | Query | Mitigated | `refetchOnWindowFocus: false` |
| **RN Web FlatList bugs** | Feed scroll | Mitigated | `WebFeedScrollList` instead of FlatList |
| **Match candidates RPC** | Matching | Baseline needed | `load-test-match-candidates.ts` |
| **Trainer search RPC** | Trainers | Baseline needed | `measure-trainer-search-perf.ts` |
| **Performance baselines** | All | Empty | `features/validation/PERFORMANCE.md` — no numbers recorded |

### Safari-specific

| Issue | File | Notes |
|-------|------|-------|
| visualViewport toolbar | `lib/web-tab-scene-layout.ts` | Tab scene height from visualViewport |
| body overflow shell | `lib/web-document-styles.js` | Intentional for feed — not a sheet bug |
| Font icon breakage | Lucide migration | All icons SVG |
| Post-login layout | `patch-web-html.js` | Patches dist/index.html after build |

### Optimization patterns in use

- `FeedListItem` memo with granular equality
- `FeedMediaSlot` defers mount until near viewport (IntersectionObserver on web)
- `useFeedInfiniteScroll` — prefetch 3 viewport-heights early
- TanStack Query: staleTime 30s, gcTime 30min, exponential retry
- Optimistic cache updates for likes, comments, deletes
- Image prefetch via `prefetch-post-images.ts`

### Measurement scripts

```bash
npx tsx scripts/measure-feed-perf.ts
npx tsx scripts/measure-messaging-perf.ts
npx tsx scripts/measure-trainer-search-perf.ts
npx tsx scripts/load-test-match-candidates.ts   # needs TEST_USER_JWT
```

---

## 7. Database

### Overview

- **78 migrations** in `supabase/migrations/` (`20250529000000` → `20250722000001`)
- **~97 public tables** across social, messaging, matching, stories, calendar, achievements, founder ops
- **RLS enabled** on virtually all user-facing tables
- **Types:** `packages/types/src/` — manually maintained (not auto-generated)

### Last sync status

- v1.0.2 verified: **78/78** local = remote (2026-07-04)
- Latest migration: `20250722000001_fix_post_activity_trigger.sql`
- Verify: `npm run verify:schema-sync` and `npx supabase migration list`

### Core tables

| Domain | Tables |
|--------|--------|
| Social | `profiles`, `posts`, `follows`, `likes`, `comments`, `post_reactions`, `saved_posts` |
| Groups | `groups`, `group_members`, `challenges`, `challenge_participants` |
| Messaging | `conversations`, `conversation_members`, `messages`, `message_reactions`, `conversation_user_*` |
| Matching | `matches`, `match_swipes` |
| Events | `events` (as `workout_events`), `event_attendees`, `event_invitations` |
| Stories | `stories`, `story_slides`, + 18 engagement tables; legacy `story_views`/`story_reactions` |
| Calendar | `training_calendar_items`, `training_session_invites`, `training_session_participants` |
| Activity | `platform_activity_events`, `achievement_definitions`, `user_achievements`, `user_reputation_scores` |
| Trainers | `trainer_profiles`, `trainer_certifications`, `trainer_connections`, `trainer_reviews` |
| Safety | `blocks`, `reports` |
| Founder | 24 ops tables (`staff_memberships`, `feature_flags`, `founder_*`, etc.) |
| Growth | `referrals`, `beta_feedback`, `product_events`, `push_tokens`, `notifications` |

### Key relationships

- `profiles.id` → `auth.users(id)` ON DELETE CASCADE (hub for all FKs)
- `posts.author_id` → profiles; optional `group_id`, `challenge_id`, `event_id`, `shared_post_id`
- `conversations` ↔ `conversation_members` ↔ `messages`
- `match_swipes` → mutual `matches` via RPC
- `stories` → `story_slides` → engagement tables (24h expiry → `story_memories`)
- `platform_activity_events` → achievements + reputation (canonical activity ledger)

### Storage buckets

| Bucket | Purpose |
|--------|---------|
| `avatars` | Profile avatars + cover images |
| `posts` | Post media + story media (`{userId}/stories/...`) |
| `messages` | Chat media |
| `trainer-certifications` | Cert uploads |
| `trainer-portfolio` | Portfolio photos |
| `feedback-attachments` | Beta feedback files |

Path convention: `{userId}/filename`. RLS: `auth.uid()::text = split_part(name, '/', 1)`.

### RLS patterns

| Pattern | Example |
|---------|---------|
| Owner CRUD | profiles, posts, calendar items |
| Public read, owner write | likes, comments, follows |
| Visibility + block graph | profiles, posts via `users_are_blocked()` |
| Conversation membership | messages, conversations |
| Staff capability-gated | all founder/ops tables via `has_staff_capability()` |
| Story privacy | non-expired stories readable; owner manages |
| Service writes | `platform_activity_events` via SECURITY DEFINER triggers |

**Notable fixes:** `20250617000001/02` (RLS recursion), `20250720000001` (calendar RLS).

### Key RPCs

| RPC | Purpose |
|-----|---------|
| `get_match_candidates` | Discovery deck |
| `record_match_swipe` | Swipe + mutual match |
| `get_training_matches` | Active matches |
| `create_or_get_dm_conversation` | DM creation |
| `get_post_interaction_stats` | Feed enrichment |
| `set_presence` / `expire_stale_presence` | Online status |
| `search_trainers` | Trainer discovery |
| `publish_platform_activity` | Activity ledger writes |
| `dispatch_push_notification` | Push fan-out trigger |

### Pending migrations

Run `npx supabase migration list` to confirm remote state. If drift: `supabase db push` to staging first, then production **before** client deploy.

---

## 8. Deployment

### Vercel configuration

**Git-root (`apps/mobile/vercel.json`):**
```json
{
  "installCommand": "echo \"Using prebuilt dist\"",
  "buildCommand": "test -f dist/index.html || exit 1",
  "outputDirectory": "dist",
  "rewrites": [{ "source": "/((?!_expo/).*)", "destination": "/index.html" }]
}
```

**Vercel projects:**

| Location | Project | Use |
|----------|---------|-----|
| `apps/mobile/.vercel/` | `mobile` | Alternate |
| Parent `.vercel/` | **`frennix`** | **Production** ← use this |

### Production

| Field | Value |
|-------|-------|
| **URL** | https://frennix.vercel.app |
| **Active release** | v1.0.3 (In Progress) |
| **Last closed release** | v1.0.2 (2026-07-04) |
| **Latest deploy (Phase A)** | `dpl_3aKaPXDnxoccvELGGRwbfDxaptgZ` |
| **Bundle** | `index-b58c16d64459ae4d864a05f61b1c4444.js` |
| **v1.0.2 deploy** | `dpl_357TLT9m2EaRSG4fRe5Fem5QE6Fa` |

### Build commands

```bash
pnpm build:web          # expo export -p web && node scripts/patch-web-html.js
pnpm typecheck
pnpm start              # Expo dev
```

### Deploy commands

```bash
# Web production
cd apps/mobile
pnpm build:web
git add dist/           # Commit prebuilt dist
npx vercel deploy --prod --yes --project frennix

# Database
supabase link --project-ref wkrwncovmpsveatlrqel
supabase db push
supabase functions deploy send-push

# iOS
eas build --profile production --platform ios
eas submit --platform ios --profile production
```

### Environment variables

**Client (`.env`):**

| Variable | Required | Purpose |
|----------|----------|---------|
| `EXPO_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Yes | Client anon key |
| `EXPO_PUBLIC_SENTRY_DSN` | Optional | Error monitoring |
| `EXPO_PUBLIC_APP_URL` | Optional | Default: `https://frennix.vercel.app` |
| `EXPO_PUBLIC_PRIVACY_POLICY_URL` | Optional | Legal |
| `EXPO_PUBLIC_TERMS_URL` | Optional | Legal |
| `EAS_PROJECT_ID` | iOS | Expo/EAS project |

**Script-only:** `TEST_USER_JWT` for load/perf scripts.

**Edge functions (auto-injected):** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

### Verification scripts (pre/post deploy)

```bash
# Release gates
npx tsx scripts/verify-release-gates.ts --release features/releases/RELEASE-vX.Y.Z.md --phase production

# Safari / overlays (against production URL)
node scripts/verify-post-interaction.mjs --url https://frennix.vercel.app
node scripts/verify-safari-feed-fix.mjs --url https://frennix.vercel.app
node scripts/verify-calendar-viewport.mjs --url https://frennix.vercel.app

# Schema + sharing
npm run verify:schema-sync
npm run verify:post-sharing
npm run verify:sheet-safe-area
npm run verify:post-login          # after build:web

# Matching (if in scope)
npx tsx scripts/verify-matchmaking-qa.ts
```

**54 scripts** in `scripts/` — see `package.json` `verify:*` npm scripts.

---

## 9. Coding standards

### Folder organization

| Directory | Convention |
|-----------|------------|
| `app/` | Expo Router file-based routes; route groups `(auth)/`, `(tabs)/` |
| `components/` | App-specific UI; feature subdirs (`founder/`, `story/`, `training-calendar/`) |
| `lib/` | `*-actions.ts` + `use*Actions.tsx` pairs; `*-cache.ts`; `use*.ts(x)` hooks |
| `packages/ui/` | Design system components + tokens (shared across app) |
| `packages/api/` | Supabase domain API — one file per domain |
| `packages/types/` | Shared TypeScript interfaces |
| `features/` | Documentation only (not runtime) |

### Naming conventions

| Pattern | Example |
|---------|---------|
| Entity actions | `post-actions.ts` + `usePostActions.tsx` |
| Entity links | `post-link.ts`, `entity-link.ts` |
| Query caches | `post-cache.ts`, `entity-list-cache.ts` |
| Hooks | `useFeedLike.ts`, `usePostInteraction.tsx` |
| Screens | `app/post/[id].tsx` (dynamic segments) |
| Components | PascalCase files, named exports |
| API functions | camelCase: `getFeed`, `deletePost` |

### Component patterns

**Provider tree (root layout):**
```
SafeAreaProvider → ThemeProvider → GestureHandlerRootView → AppErrorBoundary
  → QueryProvider → AppResumeCoordinator → AuthProvider → TabBadgeProvider
    → NotificationBootstrap, PushRegistration, PresenceCoordinator
      → AuthNavigationGuard → Stack (expo-router)
```

**Entity ownership pattern:**
```
content-types.ts (registry) → *-actions.ts (action defs) → use*Actions.tsx (hook)
  → EntityActionSheet (UI) — migrating to BottomActionSheet
```

**Feed interaction pattern:**
```
FeedListItem → FeedPostCard (onInteractPress) → usePostInteraction → PostInteractionSheet
```

### State management

| Layer | Tool | Defaults |
|-------|------|----------|
| Server state | TanStack Query 5 | staleTime 30s, gcTime 30min, refetchOnWindowFocus false |
| Auth/session | React Context (`AuthProvider`) | authReady gate, profile cache |
| Tab badges | React Context (`TabBadgeProvider`) | shared unread counts |
| Forms | React Hook Form + Zod | |
| UI ephemeral | useState/useRef | sheet open, animation state |
| Realtime | Supabase postgres_changes | patches query cache directly |

**Do not use Zustand** — listed in deps but unused.

### Error handling

- `getErrorMessage()` — friendly messages, no raw Supabase codes (STAB-001 fix)
- `AppErrorBoundary` — no raw stack traces to users (STAB-002 fix)
- `QueryErrorState` — retry UI on failed queries
- Sentry capture on unhandled errors

### Testing strategy

**No Jest/Vitest unit test suite.** Testing is:

1. **Static verification scripts** (`scripts/verify-*.ts`, `*.mjs`) — 54 files
2. **Browser-based repros** (Playwright/Puppeteer against `dist/`)
3. **Manual QA checklists** — Critical User Flows, Overlay Modal QA
4. **Physical device QA** — mandatory for new UI (Rule 13)
5. **Release gate validator** — blocks deploy if checklist incomplete
6. **Typecheck** — `pnpm typecheck` (173 pre-existing errors documented — fix incrementally)

---

## 10. Next priorities

See [`ROADMAP.md`](./ROADMAP.md) for full version roadmap.

### Immediate (v1.0.3 close)

1. Founder iPhone Safari QA — BUG-002, BUG-003, BUG-004
2. Critical User Flows (43 flows)
3. Overlay modal QA (4 browsers)
4. Postmortems for closed bugs
5. Tag v1.0.3 release; update CHANGELOG + whats-new.ts

### Short-term (v1.0.4 / v1.1.0)

1. Phase B — unified post actions (EntityActionSheet → PostInteractionSheet)
2. Phase C — Quick Log Workout (**＋** on reaction bar)
3. Training Together Today data layer
4. P1 Matchmaking GA
5. P2 Messaging polish
6. Story Replies

### Medium-term (v1.2–v1.7)

1. Run Clubs (P3)
2. Challenge polish (P4)
3. Events enhancements (P6)
4. Referral program (P7)
5. Founder Dashboard expansion resume (P8)

### Long-term (v2.0+)

1. Marketplace (P9)
2. AI Coach (P10)
3. Server-side feed ranking at scale
4. Premium subscriptions
5. Multi-market expansion

---

## 11. New agent instructions

### Read-first checklist (do this before any code)

1. Read **this document** (`HANDOFF.md`) completely
2. Read **`DEVELOPMENT_STANDARDS.md`** — permanent rules including stabilize-first priority
3. Read **`DESIGN_SYSTEM.md`** — required before any UI work
4. Read **`ROADMAP.md`** — version roadmap and current priorities
5. Read **`features/PRODUCT_VISION.md`** — validate all work against mission
6. Read **`features/releases/RELEASE.md`** + **`v1.0.3-BUG-LIST.md`** — active bugs
7. Summarize understanding to Founder → **wait for approval before coding**

### Founder-approved development order

```
1. STABILIZE  → freezes, lag, viewport, scroll, Safari regressions (physical iPhone)
2. PERFORMANCE → fast, responsive app-wide; measure and fix bottlenecks
3. POLISH     → premium native iPhone UX, animations, design system consistency
4. FEATURES   → major new capabilities only after 1–3 are verified on device
```

**We are building a polished, scalable fitness platform — not shipping features into a broken shell.**

### What must NEVER be changed without Founder approval

| Item | Why |
|------|-----|
| Production deploy, git push, release tags | `RELEASE-WORKFLOW.md` requires explicit approval |
| Marking BUG-002, BUG-003, or BUG-004 as **Closed** | Founder physical iPhone Safari confirmation required |
| Reintroducing `OverlaySafeAreaProvider` app-wide | Caused full black screen regression |
| Setting `document.body.overflow = hidden` from interaction sheets | Causes post-dismiss feed freeze (BUG-004) |
| `touchAction: none` on feed for post interaction sheets | Causes pointer-event freeze; hard lock is for story viewer only |
| Removing `body { overflow: hidden }` from `web-document-styles.js` | Intentional feed scroll shell — not a sheet bug |
| Triple-applying fixed viewport height on feed wrapper + scroll + content | Causes black dead band (BUG-003/004 pattern) |
| Deploying to Vercel `mobile` project instead of `frennix` | Wrong production target |
| Adding features outside active release scope | Log in `FUTURE-IDEAS.md`; bug-fix releases stay focused |
| New parallel architecture / systems | Product building mode — extend `PLATFORM_CAPABILITIES.md` first |
| Closing bugs without postmortem | `POSTMORTEM-PROCESS.md` — mandatory for production user bugs |

### Areas needing the most attention next

| Priority | Area | Detail |
|----------|------|--------|
| **P0** | Physical iPhone Safari QA | Close BUG-002, BUG-003, BUG-004 with Founder confirmation |
| **P0** | Critical User Flows | 43 flows in `checklists/CRITICAL-USER-FLOWS.md` — all ⬜ |
| **P1** | Calendar viewport (BUG-003) | `app/(tabs)/events.tsx` + `web-tab-scene-layout.ts` |
| **P1** | Sheet safe area (BUG-002) | Confirm priority grid + `useBottomActionSheetLayout` on device |
| **P1** | Feed post-dismiss (BUG-004) | Confirm fix on device — automated PASS only |
| **P2** | Phase B feed interaction | Merge `EntityActionSheet` into `PostInteractionSheet` More panel |
| **P2** | Overlay migration | Retire one-off `BottomOverlayShell` menus app-wide |
| **P2** | Messaging N+1 | `getConversations` batch RPC before scale |
| **P3** | Phase C Quick Log Workout | **＋** on reaction bar — fitness identity (after B) |

### Open bugs (cannot close without Founder device QA)

| ID | Severity | Status | Summary |
|----|----------|--------|---------|
| BUG-002 | P1 | In Progress | Sheet clipped on iPhone Safari — improved, not closed |
| BUG-003 | P2 | In Progress | Calendar half blocked on iPhone Safari |
| BUG-004 | P1 | In Progress | Feed freeze/black band after sheet — fix deployed, not closed |

### Already verified (automated — July 5, 2026)

| Check | Result | Notes |
|-------|--------|-------|
| `verify-post-interaction.mjs` on production | **PASS** | iPhone Safari UA; all 4 tiles visible/tappable |
| Post-dismiss feed scroll + tap | **PASS** | `touchBlocked: false`, `feedTappable: true` |
| v1.0.2 sharing gate | **PASS** | `verify:post-sharing`, `verify:v1.0.2-complete` |
| Schema sync at v1.0.2 | **PASS** | 78/78 migrations |
| BUG-001 workout sharing | **Closed** | v1.0.2 shipped |
| Phase A feed trigger | **Deployed** | ⋯ → sheet; + removed from reaction bar |

**Automated PASS does not close bugs** — Founder physical iPhone Safari is still required.

### Next development priorities (after v1.0.3 close)

1. Phase B — unified post actions across feed, profile, detail, saved posts
2. Phase C — Quick Log Workout (**＋** reinforces fitness identity)
3. Feed polish — caption tap → detail only; haptics; staggered tile animation
4. Training Together Today data layer (v1.1)
5. P1 Matchmaking GA (human QA + deploy)
6. Performance baselines — `measure-feed-perf.ts`, `measure-messaging-perf.ts`

### Known risks

| Risk | Mitigation |
|------|------------|
| Safari behavior differs from desktop Chrome | Always test on physical iPhone Safari |
| Uncommitted implementation code on `main` | See §17 — code changes exist locally beyond this doc commit |
| `main` ahead of `origin/main` by 1 commit | Push pending; coordinate with Founder |
| v1.0.0 rollback precedent | Matchmaking GA needs thorough device QA before re-deploy |
| Committed `dist/` drift | Rebuild with `pnpm build:web` before every production deploy |
| 173 pre-existing TypeScript errors | Don't introduce new errors in touched files |
| No staging environment | Test thoroughly before production deploy |
| Dual story systems (legacy + dedicated) | Use dedicated story APIs; legacy deprecated |

### Assumptions made during development

| Assumption | Rationale |
|------------|-----------|
| **⋯** is the sole primary trigger for post interaction sheet (Phase A) | Founder approved; caption tap is secondary (to be removed) |
| **＋** becomes Quick Log Workout, not social actions (Phase C) | Reinforces fitness platform identity over social media |
| `BottomActionSheet` is the canonical overlay shell | Reusable across Frennix; do not fork shell logic |
| Soft scroll lock for interaction sheets; hard lock for story viewer only | Prevents BUG-004 freeze |
| Feed wrapper flex-fill + bounded scroll child | BUG-003/004 layout pattern |
| 28px overlay bottom margin is universal | Comfortable spacing above Safari toolbar |
| Automated verification on production URL is sufficient for CI gate | Physical device still required to close bugs |
| Git root is `apps/mobile` with vendored packages | Parent monorepo may exist locally at `/Users/startswithu/Source/frennix/` |
| Zustand is unused despite being in package.json | TanStack Query + Context is the actual pattern |

### Best practices for continuing this project

1. **Smallest correct diff** — match existing conventions; read surrounding code first
2. **Log bugs before fixing** — `v1.0.3-BUG-LIST.md` + `RELEASE.md`
3. **Run relevant verify scripts** after every change
4. **Build web + commit dist** before Vercel deploy
5. **Migrations before client** when schema changes
6. **Use theme tokens** — no magic numbers for spacing/radius/color
7. **Extend `@frennix/ui` and `@frennix/api`** before creating parallel implementations
8. **Document major features** in HANDOFF + ROADMAP when complete
9. **Ask Founder** when scope, architecture, or release timing is unclear

### What you must do

| Rule | Detail |
|------|--------|
| Classify bugs first | P0–P3 before fixing |
| Physical device QA | Rule 13 — mandatory for new UI |
| Design system | Rule 14–15 — `DESIGN_SYSTEM.md` + `DEVELOPMENT_STANDARDS.md` |
| Minimal diffs | Smallest correct change |
| Run verification | Relevant `verify-*` scripts after changes |
| Postmortems | Required before closing production bugs |

### Typical workflow

```
1. Read handoff + development standards + design system + active release
2. Summarize understanding → Founder approval
3. Stabilize → performance → polish → features (in that order)
4. Implement smallest correct diff
5. pnpm typecheck + verify scripts + build:web (if web)
6. Physical iPhone Safari QA (if UI)
7. Present changes → Founder approval for commit/deploy
```

---

## 12. Technical debt

### Infrastructure

| Item | Notes |
|------|-------|
| Git scope mobile-only | `packages/` and `supabase/` vendored in git root; consider elevating to monorepo root |
| Web deploys from committed `dist/` | CI should build from source long-term |
| No staging environment | P8 backlog |
| 173 pre-existing TypeScript errors | Documented in RELEASE-v1.0.1-READINESS; fix incrementally |
| `verify-post-login.ts` stale expectations | Update post-v1.0.1 |
| Performance baselines empty | Phase 15 — no numbers in PERFORMANCE.md |
| Zustand in package.json but unused | Remove or document intent |

### Code / API debt

| Item | Location |
|------|----------|
| Messaging N+1 conversations | `packages/api/src/messaging.ts` — needs batch RPC |
| No server-side feed RPC | Client-side graph query; consider materialized view at scale |
| Deprecated post-based story APIs | `story-engagement.ts`, `story-insights.ts` → dedicated story APIs |
| Deprecated lifestyle helpers | `lib/lifestyle-matching.ts` |
| Deprecated `useNotificationBadge` | → `useTabBadges()` |
| Deprecated `FeedStoryViewer` | → `WorkoutStoryViewer` |
| Deprecated `flex-layout.webScrollSurface` | Migration in progress |
| Dual story systems | Legacy post-based + dedicated 24h — legacy tables remain |
| `EntityActionSheet` vs `BottomActionSheet` | Two overlay patterns — Phase B unifies |
| Caption tap opens sheet | Secondary trigger — remove in polish |

### Placeholder UI ("coming soon")

| File | Placeholder |
|------|-------------|
| `lib/group-actions.ts` | `view_analytics` |
| `lib/challenge-actions.ts` | `duplicate`, `view_analytics` |
| `lib/event-actions.ts` | `view_analytics` |
| `lib/usePostActions.tsx` | Some actions show generic coming soon |
| `lib/ownership/content-types.ts` | `recipe`, `marketplace_listing` = deferred |

### Documented deferred features

Premium, marketplace, live streaming, payments, gesture swipe deck, server-side ranking at 1M, AI coach (P10).

### Intentional workarounds (do not "fix" blindly)

| Workaround | Why |
|------------|-----|
| `body { overflow: hidden }` in web-document-styles | Feed scroll shell — intentional |
| `WebFeedScrollList` instead of FlatList | RN Web Safari bugs |
| `refetchOnWindowFocus: false` | Safari tab-resume refetch storms |
| Committed `dist/` for Vercel | Workspace packages don't build on Vercel install |

---

## 13. Session summary

This section covers work accomplished across the development sessions leading to this handoff (June–July 2026).

### Priority 1 — Post Management (complete)

- Owner ⋯ menu: Edit, Delete, Share, Copy Link
- Viewer ⋯ menu: Share, Copy Link, Report, Block
- Full edit flow: caption, workout type, media add/remove/replace/reorder
- Delete with storage cleanup + optimistic cache removal
- `lib/post-link.ts` for deep links

### Challenge Management (complete)

- Creator ⋯ menu on challenge detail: Edit, Delete
- `app/edit-challenge/[id].tsx` — full edit flow
- CASCADE delete for participants; posts.challenge_id → NULL
- Migrations for challenge reports

### Phase A — Shared Ownership Framework (complete)

- `EntityActionSheet` + `entity-actions.ts` registry
- Unified menus for posts, challenges, events
- `usePostActions`, `useChallengeActions`, `useEventActions` hooks
- Block on viewer menus; Copy Link on owner menus
- Event share/report API + migrations

### Premium Social Feel (complete)

- Haptics (`lib/haptics.ts`)
- Reanimated post enter animations
- Skeleton placeholders, optimistic comments
- 30min query cache, `ScalePressable` press feedback
- 200ms fade navigation, `ProgressiveImage` blur placeholders
- `QueryErrorState` retry UI, exponential query retry

### Auth & Privacy Fixes (complete)

- Safari resume fix — `authReady` gate + profile cache
- Online status privacy toggle + backend masking
- Lucide SVG icon migration (Safari reliability)

### Feed & Media (complete)

- Instagram-style edge-to-edge feed media
- Photo lightbox with pinch/pan zoom
- Feed performance: memo, deferred media, prefetch, pull-to-refresh, new posts banner
- Matching crash fix — null-safe readiness + defensive RPC parsing

### Post Interaction Sheet System (v1.0.3 — deployed, QA pending)

- **`BottomActionSheet`** — reusable native spring shell
- **`PostInteractionSheet`** — priority grid (Like/Reply + Strong Work/More)
- **`ActionSheetGrid`** + **`ActionSheetTile`** components
- Safari safe-area via `useBottomActionSheetLayout` (BUG-002)
- Content-sized sheet (`fitToContent`) — no scroll for 4 actions
- **Phase A feed trigger:** **⋯** → sheet; **＋** removed from reaction bar
- **BUG-004 fix:** removed body scroll lock; soft feed scroll lock; flex-fill layout
- `restoreWebDocumentScrollLock()` on dismiss
- Verification scripts updated and passing on production

### Design System & Process (complete)

- `DESIGN_SYSTEM.md` — comprehensive UI/UX standards
- `ROADMAP.md` — version-based product roadmap
- `features/releases/FRENNIX-DESIGN-SYSTEM.md`
- `features/releases/FEED-POST-INTERACTION-PATTERN.md`
- `features/releases/BOTTOM-ACTION-SHEET-STANDARD.md`
- Release process Rule 13 (physical device QA) + Rule 14 (design system compliance)

### Production deployments (recent)

| Deploy | Notes |
|--------|-------|
| `dpl_3aKaPXDnxoccvELGGRwbfDxaptgZ` | Phase A — ⋯ trigger, + removed, priority grid |
| `dpl_8F8qnKnNgsnDgqDLj3gcDKTb5wz7` | BUG-004 feed freeze/layout fix |
| `dpl_3rvDC4FJVjs42J5N1KmnDmXfoko7` | Priority grid + content-sized sheet |
| `dpl_357TLT9m2EaRSG4fRe5Fem5QE6Fa` | v1.0.2 workout sharing hotfix |

---

## 14. Final recommendations

### Scalability

1. **Batch messaging queries** — `getConversations` N+1 will break at scale; add RPC before user growth
2. **Server-side feed RPC** — client graph query works for beta; materialized feed view at 10k+ users
3. **Match candidate ranking** — server-side ranking deferred to P3+; load test before GA
4. **CI builds from source** — stop relying on committed `dist/`; build in Vercel from monorepo root
5. **Staging environment** — needed before v1.7+ founder dashboard expansion

### Maintainability

1. **Complete Phase B** — single overlay pattern (`BottomActionSheet`) eliminates `EntityActionSheet` fork
2. **Remove deprecated APIs** — dedicated story APIs, lifestyle helpers, legacy post-story paths
3. **Elevate git to monorepo root** — eliminate vendored `packages/` duplication
4. **Fix TypeScript errors incrementally** — 173 pre-existing; block new errors in changed files
5. **Auto-generate types from Supabase** — reduce schema/code drift risk
6. **Commit design docs** — ensure HANDOFF, DESIGN_SYSTEM, ROADMAP are in git

### Security

1. **RLS audit before P1 GA** — `verify-phase-a-rls.ts` on linked Supabase
2. **Never expose service role key client-side** — edge functions only
3. **Block/ban enforcement in all candidate RPCs** — already in matchmaking; verify for trainers
4. **Postmortem process** — mandatory for all production bugs; update QA checklists from findings

### Performance

1. **Record baselines** — run `measure-feed-perf.ts`, `measure-messaging-perf.ts`; store in PERFORMANCE.md
2. **Physical device perf profiling** — Safari is slower than desktop; don't trust Chrome-only metrics
3. **Keep deferred media mount** — critical for feed scroll on mid-range iPhones
4. **Avoid rAF loops in layout hooks** — event-driven viewport only (learned from sheet layout bug)

### User experience

1. **Close v1.0.3 on device** — automated PASS ≠ done; Founder iPhone Safari is the gate
2. **Phase C Quick Log Workout** — reinforces fitness identity over social media patterns
3. **Unify post interaction everywhere** — feed, profile, detail, saved posts must behave identically
4. **Haptics + micro-animations** — polish pass after Phase B stabilizes interaction pattern
5. **Training Together Today** — high-impact v1.1 feature for daily fitness loop
6. **P1 Matchmaking GA** — core Frennix loop (match → message → train) still pending full release

---

## 15. Permanent development standards

**Full document:** [`DEVELOPMENT_STANDARDS.md`](./DEVELOPMENT_STANDARDS.md)  
**Enforcement:** `features/releases/RELEASE_PROCESS.md` Rules 12–15

### Core rules (summary)

| Standard | Rule |
|----------|------|
| **Documentation** | Every major feature updates HANDOFF, ROADMAP, and feature docs |
| **Device QA** | Every release verified on physical iPhone before bugs closed (Rule 13) |
| **Design system** | Every UI component follows `DESIGN_SYSTEM.md` (Rule 14) |
| **Overlay consistency** | Shared spacing, typography, animation, safe-area on all sheets/modals/menus |
| **No one-off UI** | Use `BottomActionSheet`, `MenuIconButton`, theme tokens |
| **Stabilize first** | Fix freezes/lag/viewport/scroll/Safari before major features (Rule 15) |
| **Performance second** | Measure baselines; optimize before adding scope |
| **Polish third** | Premium native iPhone feel before feature expansion |
| **Features last** | New capabilities only after stability + polish verified on device |

### Design rationale (key decisions)

| Decision | Rationale |
|----------|-----------|
| **⋯** opens post sheet; **＋** removed | Separates social actions (sheet) from fitness quick action (future Quick Log) |
| **＋** → Quick Log Workout (Phase C) | Reinforces fitness platform identity — Founder decision |
| `fitToContent` sheets | No scroll/dead space for 4 actions — premium native feel |
| Spring physics on sheets | Matches iOS system sheet behavior vs. web fade/slide |
| 28px bottom margin | Buttons never hidden behind Safari toolbar (BUG-002) |
| Soft vs hard scroll lock | Interaction sheets block scroll only; story viewer needs hard lock |
| Lucide SVG icons | Font icons broke on iOS Safari |
| TanStack Query over Zustand | Server state with cache; Context for auth/badges |
| Committed `dist/` for Vercel | Workspace packages don't build in Vercel install step |

---

## 16. Component architecture

### Layer model

```
┌─────────────────────────────────────────────────────────┐
│  app/ (Expo Router screens)                             │
│    └── wires hooks, providers, navigation               │
├─────────────────────────────────────────────────────────┤
│  components/ (app-specific UI)                          │
│    BottomActionSheet, PostInteractionSheet, FeedHeader  │
├─────────────────────────────────────────────────────────┤
│  packages/ui/ (@frennix/ui — design system)            │
│    FeedPostCard, MenuIconButton, theme tokens, Avatar   │
├─────────────────────────────────────────────────────────┤
│  lib/ (hooks, caches, actions, platform helpers)        │
│    usePostInteraction, post-cache, web-tab-scene-layout │
├─────────────────────────────────────────────────────────┤
│  packages/api/ (@frennix/api — Supabase domain API)     │
├─────────────────────────────────────────────────────────┤
│  providers/ (React Context)                             │
│    AuthProvider, QueryProvider, TabBadgeProvider        │
└─────────────────────────────────────────────────────────┘
```

### Overlay component hierarchy

| Pattern | Component | Animation | Use |
|---------|-----------|-----------|-----|
| Action sheet (grid) | `BottomActionSheet` | Spring | **Canonical** — post actions, future sheets |
| List menu (legacy) | `BottomOverlayShell` + `EntityActionSheet` | Fade | Migrating to BottomActionSheet (Phase B) |
| Centered modal | `CenterOverlayShell` | Fade | Confirmations, explainers |
| Story viewer | `WorkoutStoryViewer` | Custom | Full-screen; hard scroll lock |

### Feed interaction data flow

```
FeedListItem
  → FeedPostCard (onInteractPress prop)
    → usePostInteraction (lib/usePostInteraction.tsx)
      → PostInteractionSheet
        → BottomActionSheet (shell)
          → ActionSheetPriorityGrid
            → ActionSheetTile × N
```

### Entity ownership data flow

```
Screen
  → usePostActions / useEventActions / useChallengeActions
    → entity-actions registry
      → EntityActionSheet (migrating to BottomActionSheet)
```

### Animation standards (quick reference)

| Context | Standard |
|---------|----------|
| Bottom sheets | Spring: open d24/s310, dismiss d28/s340; backdrop 260ms fade |
| Navigation | 200ms stack fade (`animation.stackFadeMs`) |
| Press feedback | 0.97 scale (`ScalePressable`) |
| Feed enter | 260ms Reanimated enter |
| Skeleton | 700ms pulse |
| List overlays (legacy) | Fade only — migrate to spring |

Full detail: `DESIGN_SYSTEM.md` §8.

---

## 17. Branch status & repository state

**As of:** July 5, 2026

| Field | Value |
|-------|-------|
| **Current branch** | `main` |
| **Tracking** | `origin/main` — **ahead by 1 commit** (unpushed) |
| **Latest commit** | `a8e15f5` — "Enhance Post Interaction Sheet and Entity Action Sheet..." |
| **Other local branch** | `hotfix/v1.0.1-safari-tab-layout` (merged/shipped) |
| **Git remote** | https://github.com/Frennix/Frennix.git |
| **Git root** | `apps/mobile` (self-contained with vendored `packages/`, `supabase/`) |

### Uncommitted work at handoff (not in this documentation commit)

The following **implementation code** exists locally on `main` but is **not yet committed** — the next agent should review, test, and commit/deploy with Founder approval:

| Category | Files |
|----------|-------|
| Feed interaction | `components/BottomActionSheet.tsx`, `ActionSheetGrid.tsx`, `PostInteractionSheet.tsx`, `lib/use-bottom-action-sheet-layout.ts`, `lib/web-document-scroll-lock.ts`, `lib/post-interaction-actions.ts` |
| Feed layout | `app/(tabs)/index.tsx`, `components/WebFeedScrollList.tsx`, `lib/web-tab-scene-layout.ts`, `lib/screen-shell.ts` |
| Calendar | `app/(tabs)/events.tsx` |
| UI package | `packages/ui/src/FeedPostCard.tsx` |
| Verification | `scripts/verify-post-interaction.mjs`, `verify-calendar-viewport.mjs`, `verify-sheet-safe-area.ts` |
| Web build | `dist/` (new bundle `index-b58c16d64459ae4d864a05f61b1c4444.js`) |

**This documentation commit includes only docs** — implementation should be committed separately after Founder review.

### Important developer notes

1. **Parent monorepo** may exist at `/Users/startswithu/Source/frennix/` — git root is still `apps/mobile`
2. **Metro** watches parent monorepo via `metro.config.js`
3. **`.pnpm-store/`** is gitignored — do not commit
4. **`dist/` must be rebuilt** before production deploy: `pnpm build:web`
5. **Deploy project name** is `frennix`, not `mobile`
6. **`whats-new.ts`** still shows v1.0.2 — update on v1.0.3 close
7. **Playwright** needed locally for browser verification scripts (`npx playwright install chromium`)

---

## 18. Assumptions, risks & verified state

### Production verification log (July 5, 2026)

```bash
node scripts/verify-post-interaction.mjs --url https://frennix.vercel.app
# Result: PASS — iPhone Safari sheet QA
# - All 4 tiles visible and tappable (Like, Reply, Strong Work, More)
# - Post-dismiss feed: scroll + tap restored, no touchBlocked, no lingering modals
```

### What is deployed vs. what is closed

| Item | Deployed to production | Formally closed |
|------|------------------------|-----------------|
| Phase A (⋯ trigger, + removed) | ✅ Yes | ⬜ Pending device QA |
| BottomActionSheet + priority grid | ✅ Yes | ⬜ Pending device QA |
| BUG-004 feed freeze fix | ✅ Yes | ⬜ Pending device QA |
| BUG-002 clipping improvement | ✅ Yes (improved) | ⬜ Pending device QA |
| BUG-003 calendar viewport fix | Partial / in progress | ⬜ Open |
| v1.0.3 release tag | — | ⬜ Not tagged |
| Documentation (this commit) | — | ✅ Being committed now |

### Scalability, maintainability, security, performance, UX recommendations

See §14 Final recommendations. Top actions for next agent:

1. **Close v1.0.3 on physical iPhone** — highest leverage
2. **Commit + deploy uncommitted implementation** with Founder approval
3. **Complete Phase B** — eliminates dual overlay patterns
4. **Record performance baselines** — currently empty
5. **Batch messaging RPC** — before user scale
6. **Push `main`** — sync with remote after doc commit

---

## Quick reference

| Need | Where |
|------|-------|
| UI standards | `DESIGN_SYSTEM.md` |
| Dev standards | `DEVELOPMENT_STANDARDS.md` |
| Product roadmap | `ROADMAP.md` |
| Active release | `features/releases/RELEASE.md` |
| Open bugs | `features/releases/v1.0.3-BUG-LIST.md` |
| Release SOP | `features/releases/RELEASE_PROCESS.md` |
| Product vision | `features/PRODUCT_VISION.md` |
| Feed interaction | `features/releases/FEED-POST-INTERACTION-PATTERN.md` |
| Bottom sheets | `features/releases/BOTTOM-ACTION-SHEET-STANDARD.md` |
| Safe areas | `features/releases/OVERLAY-SAFE-AREA.md` |
| Env vars | `.env.example` |
| Theme tokens | `packages/ui/src/theme.ts` |
| Supabase init | `lib/init-supabase.ts` |
| Auth | `providers/AuthProvider.tsx` |
| Deploy | `pnpm build:web` → `npx vercel deploy --prod --yes --project frennix` |

**Production:** https://frennix.vercel.app  
**Supabase:** `wkrwncovmpsveatlrqel`  
**EAS project:** `7910ebf1-56ce-4fa0-9777-6c88602c89c6`
