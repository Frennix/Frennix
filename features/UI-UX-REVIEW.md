# UI/UX Review — App Store Readiness Sprint

**Status:** In progress (batch 2)  
**Started:** July 6, 2026  
**Sprint doc:** [`UX-POLISH-SPRINT.md`](UX-POLISH-SPRINT.md)  
**Product roadmap:** [`ROADMAP.md`](../ROADMAP.md)

---

## Executive summary

Screen-by-screen polish sprint focused on perceived performance, consistency, loading/empty/error states, accessibility, and premium feel — **no major new features**.

---

## 1. Performance improvements

| Area | Change | Impact |
|------|--------|--------|
| **Feed** | Skeleton only on true cold load (`showFeedSkeleton`) | No flash when cached feed exists |
| **Feed images** | Thumbnail blur-up in `ProgressiveImage` | Faster perceived image load |
| **Messages inbox** | Cache-first (unchanged, verified) | Instant inbox revisit |
| **Chat** | `placeholderData` + `initialData` for messages; profiles seeded from inbox cache | Faster conversation open; header shows immediately |
| **Notifications** | `placeholderData` + skeleton gating | Faster revisit |
| **Discover** | Skeleton only when empty; filter refresh spinner when data exists | No layout flash on filter change |
| **Profile** | `placeholderData` on stats/posts (existing) + PTR | Smoother refresh |
| **Calendar** | `placeholderData` + animated period change | Smoother month/week switch |

---

## 2. UI improvements

| Screen | Improvement |
|--------|-------------|
| **Feed** | Double-tap heart spring animation; 🏋️ empty state with CTA |
| **Feed media** | Thumbnail → full-res crossfade; video buffering a11y labels |
| **Discover** | Inline spinner when filters refetch with existing results |
| **Profile** | Pull-to-refresh; improved identity/stats spacing; avatar defer skeleton |
| **Calendar** | 📅 empty day state + create CTA; loading spinner for day panel; animated month switch |
| **Notifications** | Grouped sections (Today / Yesterday / This week / Earlier); 🔔 empty state; consistent row spacing |
| **Post creation** | `UploadProgressBar`; media picker loading state; accessible upload labels |
| **Global** | `EmptyState` icon + Dynamic Type scaling; `minHeight` reduces layout shift |

---

## 3. Screens reviewed

| Screen | Reviewed | Polished this sprint |
|--------|----------|----------------------|
| Feed | ✅ | ✅ |
| Messages (inbox) | ✅ | ✅ (indicators) |
| Chat (conversation) | ✅ | ✅ |
| Discover | ✅ | ✅ |
| Profile (own) | ✅ | ✅ |
| Calendar | ✅ | ✅ |
| Notifications | ✅ | ✅ |
| Post creation | ✅ | ✅ |
| Events browse | ⬜ | — |
| Story viewer | ⬜ | — |
| Settings / Auth | ⬜ | — |
| Post detail | ⬜ | — |

---

## 4. Remaining recommendations

| ID | Area | Recommendation | Priority |
|----|------|----------------|----------|
| R-01 | Feed (web) | Virtualize `WebFeedScrollList` | High |
| R-02 | Post detail | Paginate comments; FlatList | High |
| R-03 | Success UX | Bottom toast instead of `showSuccess` alert | Medium |
| R-04 | Notifications | Group by type (likes, follows, messages) within date sections | Medium |
| R-05 | Calendar (Safari) | BUG-003 viewport — device QA | High |
| R-06 | Feed sheets | BUG-002 safe area — device QA | High |
| R-07 | Settings / Auth | Spacing + typography audit | Low |
| R-08 | Global | `touchTarget` audit on all icon buttons | Medium |

---

## 5. Accessibility improvements (this sprint)

| Item | Change |
|------|--------|
| Video buffering | `accessibilityLabel` + `progressbar` role |
| Upload / loading | Labels on ActivityIndicators (chat, create-post, discover) |
| Empty states | `allowFontScaling` + `maxFontSizeMultiplier` |
| Upload progress | `progressbar` role on `UploadProgressBar` |

---

## 6. Before / after notes

### Feed (cached revisit)
- **Before:** Skeleton appeared even when posts were in cache  
- **After:** Cached posts render immediately  

### Chat open
- **Before:** Full-screen spinner until messages + profiles loaded  
- **After:** Partner name from inbox cache; messages use cache when available  

### Notifications
- **Before:** Flat chronological list  
- **After:** Date-grouped sections (Instagram-style)  

### Post upload
- **Before:** Static banner with small spinner  
- **After:** Animated progress bar + explicit media-picker loading  

### Calendar month switch
- **Before:** Instant swap (felt abrupt)  
- **After:** `LayoutAnimation` ease on period change  

*Capture iPhone Safari screenshots during Founder QA for visual before/after archive.*

---

## Changelog

| Date | Change |
|------|--------|
| 2026-07-06 | Sprint kickoff; batch 1 (heart animation, profile PTR, calendar empty) |
| 2026-07-06 | Batch 2 — notifications grouping, chat cache, media blur-up, upload progress, discover filter UX |
