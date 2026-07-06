# Frennix Operations Roadmap

**Status:** Living document — update after every sprint  
**Owner:** Engineering + Founder  
**Product vision:** [`ROADMAP.md`](../ROADMAP.md) · **Sprint detail:** [`PERFORMANCE-POLISH-SPRINT.md`](PERFORMANCE-POLISH-SPRINT.md) · **QA:** [`FOUNDER-QA.md`](FOUNDER-QA.md)

> Every idea, bug, performance item, and polish task is tracked here so nothing is lost in chat.

---

## Current Sprint

**Name:** UX Polish Sprint — App Store Readiness  
**Goal:** Premium, production-quality feel on every screen before feature sprints  
**Started:** July 6, 2026  
**Gate:** Founder approval required before Feed 2.0  
**Detail:** [`UX-POLISH-SPRINT.md`](UX-POLISH-SPRINT.md)

### Release workflow (every release)

1. Development → 2. Automated verification → 3. Performance testing → 4. Manual QA → 5. **Founder QA** → 6. Production deploy → 7. Smoke test → 8. Release summary

**Never skip a step. Never deploy without Founder QA sign-off.**

### Previous sprint (complete — merged to main)

**Name:** Performance, Stability & Polish Sprint  
**Shipped:** Calendar cache, lazy tabs, story bundle query, double-tap like, notifications bulk delete, DB indexes migration, Founder QA + roadmap docs

### Feature sprint queue (after UX Polish)

1. Feed 2.0  
2. Comments 2.0  
3. Story Viewer improvements  
4. Notification Center improvements  
5. Discover 2.0  
6. Events 2.0  
7. Messaging 2.0  

---

## Next Sprint

**Tentative:** Feed 2.0 (blocked until UX Polish Sprint approved)

---

## Critical Bugs

| ID | Issue | Screen | Status |
|----|-------|--------|--------|
| C-01 | Feed web ScrollView — no virtualization, memory growth | Feed (web) | 🔴 |
| C-02 | Story viewer 6 API queries per slide | Stories | ✅ mitigated (bundle) |
| C-03 | Comments load-all in ScrollView | Post detail | 🔴 |

*Active P1 bugs also tracked in [`releases/BUG-TRACKER.md`](releases/BUG-TRACKER.md)*

---

## High Priority

| ID | Item | Area |
|----|------|------|
| H-01 | Feed membership cache per session (avoid re-fetch each page) | Feed API |
| H-02 | Feed new-posts banner duplicate `getFeed` | Feed |
| H-03 | `getCalendarView` SQL over-fetch optimization | Calendar API |
| H-04 | Notifications disk cache + prefetch | Notifications |
| H-05 | Story viewer memo + JS-thread animation fix | Stories |
| H-06 | Bulk delete notifications (edit mode) | Notifications | ✅ |
| H-07 | Double-tap to like posts | Feed | ✅ |
| H-08 | Offline cache for Feed head + Calendar | Network |

---

## Medium Priority

| ID | Item | Area |
|----|------|------|
| M-01 | Profile PostGrid virtualization | Profile |
| M-02 | Chat reaction cache patch (no full invalidation) | Chat |
| M-03 | Parallel create-story uploads | Posting |
| M-04 | Event detail lazy-load attendees/posts | Events |
| M-05 | UI empty/error state audit all screens | Polish |
| M-06 | Pull-to-refresh consistency audit | Polish |
| M-07 | Image thumbnail / resolution strategy | Images |
| M-08 | Notification grouping improvements | Notifications |

---

## Low Priority

| ID | Item | Area |
|----|------|------|
| L-01 | Haptics consistency pass | Polish |
| L-02 | Typography micro-audit | Polish |
| L-03 | Feed debug probe key rename | Dev |
| L-04 | PERFORMANCE.md baseline cells (TBD → measured) | Metrics |

---

## Performance Backlog

See full audit: [`PERFORMANCE-POLISH-SPRINT.md`](PERFORMANCE-POLISH-SPRINT.md) §3

| Screen | Cached target | Fresh target | Biggest gap |
|--------|---------------|--------------|-------------|
| Feed | < 150ms | < 500ms | Web virtualization |
| Messages | ✅ < 150ms | < 500ms | Badge overlap (mitigated) |
| Discover | < 200ms | < 500ms | Done tuning lists |
| Calendar | < 150ms | < 800ms | Heavy aggregate API |
| Notifications | < 200ms | < 500ms | No disk cache |
| Profile | < 200ms | < 600ms | Grid not virtualized |
| Stories | — | — | Query storm |

---

## UI Polish Backlog

| ID | Item |
|----|------|
| U-01 | Spacing/padding audit vs `DESIGN_SYSTEM.md` |
| U-02 | Skeleton only on true cold load (all tabs) |
| U-03 | Success snackbars pattern (extend UndoSnackbar) |
| U-04 | Consistent icon sizes in headers/toolbars |
| U-05 | Animation timing tokens |
| U-06 | Better empty states (Calendar, Discover, Events) |
| U-07 | Confirm dialogs for destructive actions audit |

---

## Technical Debt

| ID | Item |
|----|------|
| T-01 | `getPartnersTrainingToday` stub — implement or remove UI slot |
| T-02 | Posts RLS complexity — research materialized visibility |
| T-03 | `FeedRebuildProbe` legacy query keys |
| T-04 | `training-calendar` invalidation key unused |
| T-05 | RPC `get_post_interaction_stats` required in prod (no fallback) |

---

## Future Features

### Stories 2.0
Story reactions polish, replies, highlights, archive

### Notifications 2.0
Push completeness, quiet hours, deep linking

### Discover 2.0
Smarter matching, mutual connections, distance optimization

### Events 2.0
Event chat, invites, RSVP, QR check-in, waitlists

---

## Ideas

- Feed double-tap like with heart animation
- Notification bulk edit mode
- Calendar week view sticky header polish
- Profile cover photo parallax
- In-app performance overlay (dev only)
- Shared offline mutation queue

---

## Completed Releases

| Release | Date | Highlights |
|---------|------|------------|
| Messaging management + perf | Jul 2026 | Delete, bulk edit, pin, archive, mute, undo, inbox perf (`72ff0a9`) |
| Messaging management v1 | Jul 2026 | Phase 1 inbox QA (`43fa407`) |
| FeedLayout redesign | Jul 2026 | FeedMedia, action bar, Safari fixes |
| v1.0.2 | Jul 2026 | Workout/photo/video sharing fix |

---

## Changelog (this doc)

| Date | Change |
|------|--------|
| 2026-07-05 | Sprint 1 kickoff; operational roadmap created |
| 2026-07-05 | Phase 1 audit merged from PERFORMANCE-POLISH-SPRINT |
