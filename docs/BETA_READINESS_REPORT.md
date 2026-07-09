# Frennix Beta Readiness Report

**Phase:** Polish & Beta Readiness  
**Date:** July 2026  
**Estimated beta readiness:** **82%**

---

## Executive summary

Frennix has mature core features and a strong design system foundation (`packages/ui`, `lib/screen-shell`, skeleton loaders on main tabs). This polish pass focused on **navigation dead-ends**, **loading/empty consistency**, and **performance hot paths** rather than new features.

The app is suitable for a **closed beta** with founder/staff monitoring via Command Center. App Store submission should follow the top 5 priorities below.

---

## Issues found & fixed (this pass)

### UI consistency
| Issue | Fix |
|-------|-----|
| Messages tab missing Safari web shell | Added `tabScreenContainer`, `useTabScreenWebContainerStyle`, full refresh props |
| Notifications sign-in gate was plain text | Replaced with `EmptyState` + Sign in CTA |
| Challenge Hub used spinner for cold load | Added `ChallengeHubSkeleton` |
| Challenge section empties were muted text | `ChallengeHubSection` uses `EmptyState` |
| Founder dashboard had no exit | Back button in `FounderShell` (→ settings if no history) |
| List bottom padding inconsistent | Documented `LIST_BOTTOM_PADDING` in `screen-shell.ts` |

### Navigation
| Issue | Fix |
|-------|-----|
| `/saved-posts`, `/edit-group/[id]` unregistered | Added to root `_layout.tsx` with proper headers |
| Training session notifications → Calendar tab only | `buildDeepLink` + `notification-navigation` prefer `/training-calendar/{id}` |
| Story notifications opened profile only | Navigation appends `?storyId=` to profile deep link |
| Staff invite signed-out dead end | Added Sign in button → `/(auth)/login` |
| Legacy admin moderation orphan | Redirects to `/founder/moderation` |

### Performance
| Issue | Fix |
|-------|-----|
| Chat invalidated full inbox on every message | `patchConversationOnNewMessage` cache patch |
| Tab prefetch collided with feed defer (3s) | Staggered prefetch to 5.5s |
| Feed `windowSize=21` kept too many rows mounted | Reduced to 11 |
| Notification bell prefetch only on press | Eager prefetch at 4.5s, aligned 60s staleTime |
| Discover cards re-rendered broadly | `DiscoverProfileCard` wrapped in `React.memo` |

---

## Remaining recommendations

### P0 — Before public beta
1. **Web feed virtualization** — `WebFeedScrollList` renders all posts; cap or virtualize for PWA.
2. **Story deep link viewer** — Profile reads `storyId` param and opens `WorkoutStoryViewer` (navigation passes param; viewer wiring pending).
3. **Banned/suspended login gate** — Reject session at auth layer, not only RLS.
4. **Feed new-post polling** — Replace full `getFeed()` head peek with lightweight diff (`useFeedNewPostsBanner.ts`).
5. **Double notifications chrome** — Stack header + in-screen bar on `/notifications`.

### P1 — Polish
6. Events calendar day load → `EventListSkeleton` instead of spinner.
7. Founder dashboard double horizontal padding (shell + scroll).
8. Migrate hardcoded `borderRadius: 8` to `radius.sm` across tab screens.
9. `FounderWidget` retry → use `Button variant="secondary"`.
10. Enable `removeClippedSubviews` on native feed where safe.

### P2 — Accessibility & QA
11. VoiceOver pass on tab bar, story viewer, moderation actions.
12. Dynamic Type audit on `typography.title` / fixed heights.
13. Offline UX banners on Feed and Discover (Messages already has one).
14. E2E Playwright suite expansion for poor-network throttling.

---

## Performance improvements (this pass)

| Area | Before | After |
|------|--------|-------|
| Chat realtime | Full inbox refetch per message | Cache patch |
| Feed list memory | ~21 viewport window | ~11 viewport window |
| Tab prefetch timing | 3s (overlaps feed) | 5.5s staggered |
| Notifications open | Cold fetch on tap | Prefetch + cache hydrate |
| Discover scroll | Card re-renders | Memoized cards |

---

## QA coverage status

| Flow | Status |
|------|--------|
| Signup / login / onboarding | Stable; staff join sign-in fixed |
| Feed / posting / likes / comments | Skeleton + optimistic patterns |
| Stories / messaging | Realtime; chat cache improved |
| Notifications | Prefetch + empty states |
| Frennix Match / Discover search | Memo + skeletons |
| Events / calendar / challenges | Events spinner; challenges polished |
| Profile / settings / logout | OK |
| Moderation / founder tools | Command Center + moderation dashboard |
| Offline / poor network | Partial (messages banner only) |
| Reinstall / push deep links | Training/story links improved; story viewer pending |

---

## Top 5 Priorities before App Store submission

1. **Web feed performance** — Virtualize or paginate web feed list.
2. **Complete notification deep links** — Story viewer from `storyId`; verify all push types end-to-end.
3. **Auth enforcement for banned users** — Block at login with clear messaging.
4. **Full E2E + device QA matrix** — iOS Safari, Android Chrome, cold start, airplane mode.
5. **App Store assets & privacy** — Screenshots, nutrition labels, crash-free rate >99.5% for 7 days.

---

## Verification

```bash
node scripts/verify-polish-beta-readiness.mjs
```

Related scripts: `verify-notifications-center.mjs`, `verify-challenges-accountability.mjs`, `verify-trust-safety-founder.mjs`, `verify-beta-startup.mjs`.
