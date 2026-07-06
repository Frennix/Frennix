# UI/UX Review — App Store Readiness Sprint

**Status:** In progress  
**Started:** July 6, 2026  
**Sprint doc:** [`UX-POLISH-SPRINT.md`](UX-POLISH-SPRINT.md)  
**Product roadmap:** [`ROADMAP.md`](../ROADMAP.md)

---

## Executive summary

This sprint reviews every screen as if preparing for App Store submission. Focus: responsiveness, consistency, loading/empty/error states, and premium feel — **no major new features**.

---

## Improvements made

### Performance & perceived speed

| Screen | Change | Impact |
|--------|--------|--------|
| Feed | Skeleton only when `isLoading && posts.length === 0` (cached feed no longer flashes skeleton) | Eliminates layout shift on tab return |
| Discover (People) | Skeleton only when loading with zero rows | Same |
| Notifications | *(Performance Sprint)* Cache-first + skeleton gating | Near-instant revisit |

### Feed experience

| Item | Change |
|------|--------|
| Double-tap like | Heart spring animation on media double-tap (Instagram-style) |
| Cached feed | `placeholderData` prevents skeleton flash when data exists |

### Calendar

| Item | Change |
|------|--------|
| Empty day | `EmptyState` with “Create session” action instead of plain text |
| Loading day | Spinner + label instead of static “Loading sessions…” text |

### Profile

| Item | Change |
|------|--------|
| Pull-to-refresh | Native pull-to-refresh with accent tint (matches Feed/Discover) |

### Global components

| Item | Change |
|------|--------|
| `EmptyState` | `minHeight: 220` reduces layout jump when content loads |

---

## Remaining recommendations

| ID | Area | Recommendation | Priority |
|----|------|----------------|----------|
| R-01 | Feed (web) | Virtualize `WebFeedScrollList` for long sessions | High |
| R-02 | Post detail | Paginate comments; FlatList instead of ScrollView | High |
| R-03 | Success UX | Replace `showSuccess` alert dialogs with bottom toast pattern | Medium |
| R-04 | Profile | Skeleton only when `!authReady` (already good); extend PTR to other profile routes | Medium |
| R-05 | Discover | Groups/challenges skeleton gating (mirror people tab) | Medium |
| R-06 | Events browse | PTR + empty state audit on `/events/browse` | Medium |
| R-07 | Settings | Spacing/typography pass vs `DESIGN_SYSTEM.md` | Low |
| R-08 | Auth | Transition polish on login/signup success | Low |

---

## Areas still needing refinement

| Screen | Notes |
|--------|-------|
| Feed (web) | Long-scroll memory; sheet safe area (BUG-002) |
| Calendar (Safari) | Half-blocked viewport (BUG-003) — device QA |
| Post detail | Comments load-all |
| Story viewer | Transitions polish; viewer list UX (Feature sprint #3) |
| Messaging | Already polished; minor spacing audit optional |

---

## Pull-to-refresh audit

| Screen | PTR | Notes |
|--------|-----|-------|
| Feed | ✅ | `useGuardedRefresh` |
| Discover | ✅ | All three tabs |
| Calendar | ✅ | |
| Messages | ✅ | |
| Notifications | ✅ | |
| Profile | ✅ | **Added this sprint** |
| Profile (other user) | ⬜ | Tab retap refresh only |
| Events browse | ⬜ | Audit needed |

---

## Before / after notes

### Feed tab return (cached)

- **Before:** Skeleton flash even when feed data was in React Query cache  
- **After:** Cached posts render immediately; skeleton only on true cold load  

### Double-tap like

- **Before:** Like toggled with no visual feedback  
- **After:** Spring heart animation centered on media  

### Calendar empty day

- **Before:** Gray “No sessions scheduled” line  
- **After:** Branded empty state + CTA to create session  

### Profile

- **Before:** Refresh only via tab double-tap  
- **After:** Pull-to-refresh with consistent accent spinner  

*Screenshots: capture on Founder iPhone Safari during QA pass.*

---

## Changelog

| Date | Change |
|------|--------|
| 2026-07-06 | Sprint kickoff; initial improvements documented |
