# Performance & Polish Sprint — Living Roadmap

**Status:** Active sprint (Phase 1 audit complete — implementation not started)  
**Started:** July 5, 2026  
**Owner:** Engineering + Founder  
**Rule:** No major new features until Critical + High items from this doc are addressed and re-QA’d on iPhone Safari.

**Related docs:** [`PERFORMANCE.md`](../PERFORMANCE.md) · [`ROADMAP.md`](../ROADMAP.md) · [`RELEASE_PROCESS.md`](releases/RELEASE_PROCESS.md) · [`BUG-TRACKER.md`](releases/BUG-TRACKER.md)

> **How to use this doc:** Every idea, bug, performance finding, and polish item goes here — not in chat. Update status (`🔴` open · `🟡` in progress · `✅` done · `⏸` deferred) and add a date when closing items.

---

## Table of contents

1. [Sprint goals & targets](#1-sprint-goals--targets)
2. [Phase 1 — Screen audit](#2-phase-1--screen-audit)
3. [Phase 2 — Performance improvements backlog](#3-phase-2--performance-improvements-backlog)
4. [Phase 3 — UI polish backlog](#4-phase-3--ui-polish-backlog)
5. [Phase 4 — Image optimization backlog](#5-phase-4--image-optimization-backlog)
6. [Phase 5 — Database recommendations](#6-phase-5--database-recommendations)
7. [Phase 6 — Network resiliency backlog](#7-phase-6--network-resiliency-backlog)
8. [Phase 7 — Production readiness checklist](#8-phase-7--production-readiness-checklist)
9. [Phase 8 — Prioritized report](#9-phase-8--prioritized-report)
10. [Feature backlog (post-sprint)](#10-feature-backlog-post-sprint)
11. [Bug backlog](#11-bug-backlog)
12. [Changelog](#12-changelog)

---

## 1. Sprint goals & targets

| Target | Goal | Status |
|--------|------|--------|
| Cached screen visible | **< 150ms** (tab switch with warm cache) | Messages ✅ recent work; others TBD |
| Fresh data load | **< 500ms** p95 on normal connection | Partially measured |
| Scroll | **≥ 55 fps** sustained on iPhone Safari | Feed web uses ScrollView — risk |
| No duplicate fetches | Tab badge + screen should not double-fetch same data | Messages overlap remains |
| Offline | Cached content visible + retry on reconnect | Messages only |
| Premium feel | Consistent spacing, skeletons, empty/error states | Audit needed per screen |

**Measurement scripts:**

```bash
npx tsx scripts/measure-feed-perf.ts <userId>
npx tsx scripts/measure-messaging-perf.ts <userId> <conversationId>
npx tsx scripts/verify-message-notification-delete.ts
```

**Dev logging:** `[messaging-perf]` in Messages; `trackFeedLoad` in Feed. Extend similar hooks per screen during Phase 2.

---

## 2. Phase 1 — Screen audit

Legend: **Initial** = cold / no cache · **Cached** = tab revisit with React Query warm · **API** = network round-trips per open · **Scroll** = list virtualization

### Feed (`app/(tabs)/index.tsx`)

| Metric | Finding | Severity |
|--------|---------|----------|
| Initial load | `getFeedStories` + `getFeed` page 1 + `getSuggestedAthletes` + `getFollowingIds` in parallel after mount | Medium |
| Cached load | `placeholderData` on infinite feed; stories 60s stale — good | Low |
| API requests | **4+ on mount**; auto page-2 prefetch; **45–90s peek** via `useFeedNewPostsBanner` (duplicate `getFeed`) | High |
| Duplicate requests | `getSuggestedAthletes` **twice** vs Discover (different query keys); `getFollowingIds` in hook + inside suggestions API; membership re-fetch **every feed page** in `getFeed` | High |
| Slow DB | `getFeed` OR filter + heavy posts RLS per row; enrich via RPC (good) with 4-query fallback | Medium |
| Re-renders | `FeedPostCard` memo’d; feed actions ref-stabilized; **FeedStoryViewer always mounted** with inline callbacks — re-renders on scroll | Medium |
| Images | `FeedMedia` + viewability gate + IO on web; `prefetchPostImages` on visible rows | Good |
| Memory | Web: **all posts in ScrollView** (`WebFeedScrollList`) — unbounded for long sessions | Critical (web) |
| Scroll | Native FlatList tuned; **web no virtualization** (Safari workaround) | Critical (web) |
| Animation | Reanimated entry **disabled on web**; interaction sheet uses shared viewport module | Known |

### Discover (`app/(tabs)/discover.tsx`)

| Metric | Finding | Severity |
|--------|---------|----------|
| Initial load | Only active tab queries (`enabled` gating) — good | Low |
| Cached load | All tab queries use `placeholderData`; prefetch warms suggestions/groups/challenges | Good |
| API requests | 1–2 per tab switch; search debounced 300ms | Low |
| Duplicate requests | Prefetch `discover-groups` key `""` **≠** screen key with search → cache miss | Medium |
| Slow DB | `discoverProfiles` / `searchProfiles`; client-side compatibility rescoring | Low |
| Re-renders | FlatList defaults; no row memo audit | Medium |
| Images | Avatar only on profile cards | Low |
| Scroll | FlatList **default** window props (not tuned) | Medium |
| Animation | Standard | Low |

### Messages (`app/(tabs)/messages.tsx`) — **recently optimized**

| Metric | Finding | Severity |
|--------|---------|----------|
| Initial load | Batch `getConversations`; AsyncStorage hydrate; prefetch-first | Good |
| Cached load | `initialData` + merge + offlineFirst; skeleton only cold | Good |
| API requests | Still **~8 round-trips** per full inbox fetch | Medium |
| Duplicate requests | `getUnreadMessageCount` overlaps ~80% with `getConversations` when badge polls | High |
| Slow DB | Last-message batch scan; `conversation_members` by `user_id` (index gap) | Medium |
| Re-renders | Row memo + merge on refresh | Good |
| Images | Avatar `deferImagePlaceholder` | Good |
| Scroll | FlatList tuned + `maintainVisibleContentPosition` | Good |
| Offline | Banner + offlineFirst | Good |

### Calendar (`app/(tabs)/events.tsx`)

| Metric | Finding | Severity |
|--------|---------|----------|
| Initial load | `getCalendarView` + stub `getPartnersTrainingToday` | High (waste) |
| Cached load | **Prefetch key mismatch** — prefetch does not hit tab cache | Critical |
| API requests | **8–10 DB round-trips** per `getCalendarView`; re-fetch on every month change | High |
| Duplicate requests | Tab `lazy: false` + prefetch + mount = **double calendar fetch at login** | Critical |
| Slow DB | `getWorkoutActivityDates` pulls 200+200+100 rows; joined events not date-filtered in SQL | High |
| Re-renders | ScrollView + maps — small cell count OK today | Low |
| Scroll | No virtualization (acceptable for calendar grid) | Low |
| Offline | None | High |

### Events browse (`app/events/browse.tsx`)

| Metric | Finding | Severity |
|--------|---------|----------|
| Initial load | `getWorkoutEvents` limit 50 | Low |
| Cached load | **Shares prefetch key** — good | Good |
| API requests | 1 + enrich (2 parallel attendee queries) | Low |
| Scroll | FlatList defaults | Medium |
| Offline | None | Medium |

### Event detail (`app/event/[id].tsx`)

| Metric | Finding | Severity |
|--------|---------|----------|
| API requests | **3 parallel** on mount (`event`, `attendees`, `posts`) | Medium |
| Scroll | ScrollView | Low |

### Notifications (`app/notifications.tsx`)

| Metric | Finding | Severity |
|--------|---------|----------|
| Initial load | `getNotifications` (50 rows + profile enrich) | Medium |
| Cached load | Bell prefetch 15s stale; not in tab prefetch | Medium |
| Duplicate requests | Badge count query separate from list (by design); push invalidates **and** re-fetches count | Low |
| Scroll | FlatList **tuned** + memo rows | Good |
| Offline | None | High |

### Profile (`app/(tabs)/profile.tsx`)

| Metric | Finding | Severity |
|--------|---------|----------|
| Initial load | **5 parallel queries** (stats, following, posts, achievements, highlights) | Medium |
| Cached load | Prefetch aligns — good | Good |
| Duplicate requests | `getProfileStats` + full `getFollowingIds` overlap | Medium |
| Scroll | **ScrollView + PostGrid — no virtualization** (max 21 posts) | Medium |
| Images | CachedImage cover + ProgressiveImage grid | OK |

### Story Viewer (`components/WorkoutStoryViewer.tsx`)

| Metric | Finding | Severity |
|--------|---------|----------|
| API requests | **6 engagement queries per slide** even when slide has no widgets | Critical |
| Re-renders | Not memo’d; countdown 1s interval re-renders full tree | High |
| Animation | Progress bar `useNativeDriver: false` (JS thread) | High |
| Images | Next-slide prefetch in `story-utils` | Good |

### Comments (`app/post/[id].tsx`)

| Metric | Finding | Severity |
|--------|---------|----------|
| API requests | `getPost` waterfall + **all comments** loaded | High |
| Scroll | **ScrollView — no virtualization** | High |
| Re-renders | `CommentRow` not memo’d; like = full invalidation | High |

### Workout posting (`app/create-post.tsx`, `create-story.tsx`)

| Metric | Finding | Severity |
|--------|---------|----------|
| Upload | Sequential media reads; create-story **serial uploads** | Medium |
| Draft | AsyncStorage persist on edit — OK off hot path | Low |

### Chat (`app/chat/[conversationId].tsx`)

| Metric | Finding | Severity |
|--------|---------|----------|
| API requests | Send success **invalidates** after realtime append | Medium |
| Re-renders | Reactions invalidate full list; dismiss callback identity churn | Medium |
| Scroll | FlatList tuned + memo rows | Good |

### Search / Following / Likes

| Surface | Notes |
|---------|-------|
| Search | Part of Discover people tab — debounced |
| Following | `useSuggestedFollow` shared `following-ids` cache |
| Likes | Inside post enrich / comment likes — batched at page level |

---

## 3. Phase 2 — Performance improvements backlog

| ID | Item | Screen | Status |
|----|------|--------|--------|
| P2-001 | Unify `getSuggestedAthletes` query keys (Feed + Discover) | Feed, Discover | 🔴 |
| P2-002 | Remove or gate `useFeedNewPostsBanner` duplicate `getFeed` peeks | Feed | 🔴 |
| P2-003 | Cache feed membership (`follows`, `group_members`, `challenge_participants`) per session | Feed API | 🔴 |
| P2-004 | Derive unread badge from `conversations` cache OR single RPC | Messages, TabBadge | 🔴 |
| P2-005 | Fix calendar prefetch cache key to include range (or hydrate tab from prefetch) | Calendar | 🔴 |
| P2-006 | Disable eager calendar fetch (`lazy: false`) or defer until tab visited | Calendar | 🔴 |
| P2-007 | Remove/gate stub `getPartnersTrainingToday` query until v1.1 | Calendar | 🔴 |
| P2-008 | Gate story engagement queries by slide widget type | Story Viewer | 🔴 |
| P2-009 | Memoize `WorkoutStoryViewer` + stabilize feed callbacks | Feed, Story | 🔴 |
| P2-010 | Comment thread → FlatList + pagination + optimistic likes | Comments | 🔴 |
| P2-011 | Replace `getGroups` N+1 member counts with aggregation | Discover, API | 🟡 |
| P2-012 | Align Discover groups prefetch key with search query | Discover | 🟡 |
| P2-013 | Profile PostGrid → virtualized list for >21 posts | Profile | 🟡 |
| P2-014 | Chat: patch reactions in cache; drop redundant send invalidation | Chat | 🟡 |
| P2-015 | Parallel create-story uploads (concurrency limit) | Posting | 🟡 |
| P2-016 | Extend perf logging to Calendar, Notifications, Discover | All | 🟡 |
| P2-017 | Disk cache for Calendar + Notifications (pattern from Messages) | Calendar, Notifications | 🟡 |
| P2-018 | Discover FlatList tuning (windowSize, initialNumToRender) | Discover | 🟡 |
| P2-019 | Event detail: lazy-load attendees/posts | Events | ⏸ |
| P2-020 | Feed web virtualized list research (Safari-safe) | Feed web | ⏸ |

---

## 4. Phase 3 — UI polish backlog

| ID | Item | Status |
|----|------|--------|
| U3-001 | Audit spacing/padding against `DESIGN_SYSTEM.md` per screen | 🔴 |
| U3-002 | Standardize skeleton loaders (Feed ✅, Messages ✅, Notifications ✅, Calendar partial) | 🟡 |
| U3-003 | Empty states audit — Discover groups/challenges, Calendar no-events | 🔴 |
| U3-004 | Error states with retry on all query-driven screens | 🟡 |
| U3-005 | Success snackbars pattern (extend UndoSnackbar pattern app-wide) | 🟡 |
| U3-006 | Haptic feedback audit (`expo-haptics` on primary actions) | 🟡 |
| U3-007 | Touch target minimum 44pt audit on secondary icons (⋮ menus) | 🟡 |
| U3-008 | Pin/archive/mute transitions — LayoutAnimation on reorder | 🟡 |
| U3-009 | Consistent loading → content crossfade (reduce hard swaps) | 🟡 |
| U3-010 | Typography token audit on Discover cards + Calendar cells | 🟡 |

---

## 5. Phase 4 — Image optimization backlog

| ID | Item | Status |
|----|------|--------|
| I4-001 | `deferImagePlaceholder` on all virtualized list avatars | 🟡 (Messages done) |
| I4-002 | Feed carousel: enforce aspect ratio to prevent CLS | ✅ FeedLayout |
| I4-003 | Thumbnail URLs for post grid + feed (storage transforms if available) | 🔴 |
| I4-004 | Avatar size variants (52px vs 40px) — request appropriate resolution | 🔴 |
| I4-005 | Story slide progressive load priority (current + next only) | 🟡 |
| I4-006 | Prefetch discover profile avatars on prefetch | 🟡 |
| I4-007 | Video poster frames before decode in feed | 🟡 |
| I4-008 | Central image cache policy doc in `PERFORMANCE.md` | 🟡 |

---

## 6. Phase 5 — Database recommendations

**Recommend before implementing** — ordered by impact.

| ID | Recommendation | Rationale | Status |
|----|----------------|-----------|--------|
| D5-001 | `CREATE INDEX ON conversation_members (user_id)` | Inbox entry point scans by user | 🔴 Recommend |
| D5-002 | `CREATE INDEX ON follows (follower_id)` | Every `getFeed` membership lookup | 🔴 Recommend |
| D5-003 | `CREATE INDEX ON group_members (user_id)` | Feed membership + discover | 🔴 Recommend |
| D5-004 | `CREATE INDEX ON group_members (group_id)` | Fix `getGroups` N+1 counts | 🔴 Recommend |
| D5-005 | `CREATE INDEX ON likes (post_id)` + `comments (post_id)` | Enrich fallback paths | 🟡 Recommend |
| D5-006 | Partial index `notifications(user_id) WHERE read_at IS NULL AND deleted_at IS NULL` | Faster badge count | 🟡 Recommend |
| D5-007 | Composite `message_user_deletions (user_id, message_id)` | Large IN lists in inbox | 🟡 Recommend |
| D5-008 | RPC `get_unread_message_count(user_id)` | Eliminate duplicate client-side inbox math | 🟡 Recommend |
| D5-009 | RPC `get_group_member_counts(group_ids[])` | Replace groups N+1 | 🟡 Recommend |
| D5-010 | SQL date filter on `getJoinedEventProjections` | Calendar over-fetch | 🟡 Recommend |
| D5-011 | Slim notification list columns (migration view or select list) | Payload size | ⏸ |
| D5-012 | Review posts RLS — materialized visibility or definer helper | Feed scale | ⏸ Research |

**Applied (July 2026):** `20260705000001_messaging_phase1_inbox.sql`, `20260705000002_messaging_inbox_perf_indexes.sql`

---

## 7. Phase 6 — Network resiliency backlog

| ID | Item | Status |
|----|------|--------|
| N6-001 | Shared `useNetworkStatus` hook (web-first; extend native) | 🟡 Messages only |
| N6-002 | `offlineFirst` on all tab primary queries | 🟡 Messages + badge partial |
| N6-003 | AsyncStorage disk cache — Feed head, Calendar month, Notifications | 🔴 |
| N6-004 | Offline banner component — reuse on Feed, Calendar, Notifications | 🔴 |
| N6-005 | Mutation offline queue (posts, messages, likes) with retry | 🔴 |
| N6-006 | Auto-sync on `online` event + `refetchOnReconnect` audit | 🟡 |
| N6-007 | Graceful degradation copy for read-only offline mode | 🟡 |

---

## 8. Phase 7 — Production readiness checklist

| Flow | Ready? | Blockers |
|------|--------|----------|
| Feed | 🟡 | Web scroll/memory; duplicate fetches; baseline TBD |
| Stories | 🟡 | Viewer query storm; JS-thread progress animation |
| Comments | 🔴 | No pagination; full refetch on like |
| Messaging | ✅ | QA passed July 2026; badge overlap remains |
| Events | 🟡 | Browse OK; detail triple-fetch |
| Notifications | 🟡 | No offline cache; list not prefetched |
| Discover | 🟡 | Prefetch key mismatch; FlatList defaults |
| Profile | 🟡 | No grid virtualization |
| Workout posting | 🟡 | Serial story uploads |
| Photo uploads | 🟡 | Size limits OK; progress UX varies |
| Story uploads | 🟡 | Serial uploads |
| Likes | 🟡 | Feed optimistic ✅; comments not |
| Following | ✅ | Shared cache |
| Search | 🟡 | Discover-only; no global search |
| Calendar | 🔴 | Double fetch at login; heavy aggregate API |

---

## 9. Phase 8 — Prioritized report

### Critical (fix before next major feature)

| Rank | Issue | Impact | IDs |
|------|-------|--------|-----|
| C1 | **Feed web unbounded ScrollView** — all posts mounted, memory + scroll degrade | Feed unusable on long sessions (Safari) | P2-020 |
| C2 | **Calendar prefetch cache miss + eager tab mount** — duplicate heavy API at every login | Slow startup; wasted bandwidth | P2-005, P2-006 |
| C3 | **Story viewer 6 queries per slide** — network + render storm | Story UX laggy; battery drain | P2-008 |
| C4 | **Comments load-all + ScrollView** — breaks on popular posts | Post detail unusable at scale | P2-010 |
| C5 | **Missing DB index `conversation_members(user_id)`** | Inbox + badge slow at scale | D5-001 |

### High priority

| Rank | Issue | Impact | IDs |
|------|-------|--------|-----|
| H1 | Feed duplicate `getSuggestedAthletes` + membership re-fetch per page | Extra latency every feed open/scroll | P2-001, P2-003 |
| H2 | Messages badge poll duplicates inbox fetch | 2× API work on Messages tab | P2-004 |
| H3 | `getGroups` N+1 member counts | Discover groups tab slow | P2-011, D5-009 |
| H4 | `getCalendarView` over-fetch (activity dates, joined events) | Calendar month switch slow | D5-010, P2-007 |
| H5 | Story viewer re-renders + JS-thread animation | Jank during viewing | P2-009, P2-008 |
| H6 | No offline cache outside Messages | Poor perceived reliability | N6-003, N6-004 |
| H7 | Missing indexes on `follows`, `group_members` | Feed query slow as graph grows | D5-002, D5-003 |

### Medium priority

| Rank | Issue | Impact | IDs |
|------|-------|--------|-----|
| M1 | Discover FlatList default perf props | Jank on large result sets | P2-018 |
| M2 | Profile PostGrid non-virtualized | Profile slow for active athletes | P2-013 |
| M3 | Chat redundant invalidations | Minor lag on send/react | P2-014 |
| M4 | Event detail triple mount fetch | Slow event open | P2-019 |
| M5 | Create-story serial uploads | Slow multi-slide publish | P2-015 |
| M6 | UI empty/error state gaps | Feels unfinished | U3-003, U3-004 |
| M7 | Image thumbnail / resolution strategy | Bandwidth + CLS | I4-003, I4-004 |
| M8 | Feed new-posts banner duplicate fetch | Background battery/bandwidth | P2-002 |

### Low priority

| Rank | Issue | Impact | IDs |
|------|-------|--------|-----|
| L1 | Haptics consistency | Premium feel | U3-006 |
| L2 | Typography/spacing micro-audit | Visual consistency | U3-001, U3-010 |
| L3 | Notification push double-count fetch | Minor redundancy | — |
| L4 | Perf baseline cells in PERFORMANCE.md still TBD | Measurement gap | §1 |
| L5 | Posts RLS long-term research | Future scale | D5-012 |

---

## 10. Feature backlog (post-sprint)

Execute **only after** Critical + High sprint items are closed and iPhone Safari QA signed off.

### 1. Messaging 2.0
- [ ] Emoji reactions
- [ ] Reply to message (UI polish — schema exists)
- [ ] Read receipts
- [ ] Typing indicator (broadcast exists — UI)
- [ ] Voice messages
- [ ] Share workouts / events / athlete profiles in chat

### 2. Stories 2.0
- [ ] Story reactions (partial backend)
- [ ] Story replies
- [ ] Story viewers list (modal exists)
- [ ] Story highlights
- [ ] Story archive

### 3. Notifications 2.0
- [ ] Push notification completeness audit
- [ ] Notification preferences UI
- [ ] Quiet hours
- [ ] Deep linking to all notification types

### 4. Discover 2.0
- [ ] Smarter matching / compatibility scoring (client rescoring exists)
- [ ] Mutual connections
- [ ] Better search (global)
- [ ] Distance optimization

### 5. Events 2.0
- [ ] Event chat
- [ ] Invite friends flow polish
- [ ] RSVP improvements
- [ ] QR check-in
- [ ] Waitlists

**Release discipline (every feature above):** automated tests → manual QA → iPhone Safari → Android → native builds → production smoke test.

---

## 11. Bug backlog

Track active bugs in [`features/releases/BUG-TRACKER.md`](releases/BUG-TRACKER.md).

| ID | Summary | Severity | Sprint relation |
|----|---------|----------|-----------------|
| BUG-002 | Interaction sheet safe area (Safari) | P1 | Stabilize tier — may overlap polish |
| BUG-003 | Calendar scroll (Safari) | P1 | Calendar perf |
| BUG-004 | Feed scroll lock with sheet open | P1 | Feed polish |

Add new bugs to BUG-TRACKER first, then link here.

---

## 12. Changelog

| Date | Change |
|------|--------|
| 2026-07-05 | Phase 1 audit complete; living doc created |
| 2026-07-05 | Messaging management release QA passed; inbox perf shipped (`72ff0a9`) |
| 2026-07-06 | **Sprint 1 kickoff** — calendar cache, lazy tabs, groups batch, badge sync, indexes, Founder QA + roadmap docs |

| 2026-07-06 | **Sprint 1 execution** — social quick wins, story bundle query, notifications bulk delete, double-tap like |

### Sprint 1 deliverable (Phase 2 — awaiting Founder QA)

**Status:** Code complete locally · **Not deployed** · Migration `20260706000001` not applied to Supabase yet

#### Bugs fixed

| Item | Fix |
|------|-----|
| Calendar double-fetch at login | `lazy: true` on tabs; removed stub `getPartnersTrainingToday` query |
| Calendar prefetch cache miss | Shared `calendar-query-range.ts` keys aligned with tab + prefetch |
| Discover groups N+1 | Batch member counts in `getGroups` |
| Messages badge duplicate fetch | Badge syncs from fresh inbox cache on Messages route |
| Feed duplicate suggestions fetch | Unified `discover-suggestions` cache key (Feed + Discover) |
| FeedRebuildProbe stale key | Updated to `discover-suggestions` |

#### UI / UX improvements

| Item | Change |
|------|--------|
| Double-tap to like | Feed post media double-tap likes (Instagram-style) |
| Notifications bulk delete | Edit mode → multi-select → Delete with confirmation |
| Notifications cache-first | `placeholderData` + longer `staleTime`; skeleton only on true cold load |
| Founder QA checklist | [`FOUNDER-QA.md`](FOUNDER-QA.md) — full production sign-off |
| Operations roadmap | [`FOUNDER-ROADMAP.md`](FOUNDER-ROADMAP.md) — permanent backlog + release workflow |

#### Performance improvements

| Area | Change | Expected impact |
|------|--------|-----------------|
| Tab boot | Lazy tab mounting | Eliminates Calendar API at login |
| Calendar | `initialData` / `placeholderData` from prefetch | Near-instant revisit |
| Discover | FlatList `windowSize` / `maxToRenderPerBatch` on all tabs | Smoother scroll |
| Story viewer | Single `getStoryInteractiveBundle` query (was 6 `useQuery`) | 1 cache key; 60s stale; skip challenge joins when no hint |
| DB indexes | `20260706000001_app_performance_indexes.sql` | Faster inbox, follows, likes, comments, notifications |

#### Benchmarks

| Metric | Before (audit / prod baseline) | After (Sprint 1 — local) |
|--------|-------------------------------|---------------------------|
| Messages inbox (cached) | ~150ms target (shipped `72ff0a9`) | Unchanged — no regression |
| Calendar at login | Extra `getCalendarView` fetch | **Eliminated** (lazy tabs) |
| Story viewer open | 6 parallel React Query hooks | **1** bundled query |
| Discover groups load | N+1 member count queries | **2** queries total |
| Web build | `index-9ac4dc94…` (messaging perf) | `index-c4f04892…` (sprint 1) — builds clean |

*Run `measure-feed-perf.ts` and `measure-messaging-perf.ts` with Founder test account before prod sign-off for numeric API timings.*

#### Remaining known issues (not in this deploy)

| ID | Issue | Priority |
|----|-------|----------|
| C-01 | Feed web ScrollView — no virtualization | Critical |
| C-03 | Comments load-all in ScrollView | Critical |
| H-03 | `getCalendarView` heavy aggregate | High |
| H-04 | Notifications disk cache (memory only today) | High |
| H-07 | Double-tap heart animation (like works; no animation yet) | Medium |
| M-06 | Pull-to-refresh consistency audit | Medium |

#### Regression testing

| Area | Automated | Manual |
|------|-----------|--------|
| Web build | ✅ `npm run build:web` | — |
| Messaging verify | Run `verify-message-notification-delete.ts` | Founder QA checklist |
| Full feature matrix | — | [`FOUNDER-QA.md`](FOUNDER-QA.md) on iPhone Safari |

#### Recommendations for next sprint (after Founder approval)

1. Apply `20260706000001` migration to staging → prod
2. Close **C-01** (Feed web virtualization) and **C-03** (comments pagination)
3. Notifications disk cache + prefetch on tab boot
4. UI polish pass: spacing audit, empty states, skeleton gating on Profile/Discover
5. Capture numeric benchmarks with Founder account; add to `PERFORMANCE.md`
6. **Then** begin Messaging 2.0 (blocked until this sprint signed off)

#### Release process (every deploy)

1. Development → 2. Automated verification → 3. Performance testing → 4. Manual QA → 5. **Founder QA** → 6. Production deploy (explicit approval) → 7. Smoke test → 8. Release summary + roadmap update

---

**Next step:** Founder runs [`FOUNDER-QA.md`](FOUNDER-QA.md) on staging build → approve or log failures → then we commit, apply migration, and deploy.
