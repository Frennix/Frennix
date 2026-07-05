# Frennix Performance Baseline

**Status:** Living document — update after every major release  
**Established:** July 5, 2026 (FeedLayout redesign, v1.0.3+)  
**Owner:** Engineering + Founder  
**Related:** [`features/validation/PERFORMANCE.md`](./features/validation/PERFORMANCE.md) · [`FEED_DESIGN_SYSTEM.md`](./FEED_DESIGN_SYSTEM.md)

> Every future release must be compared against this baseline. Frennix should get **faster**, not slower, as we add features.

---

## Table of contents

1. [Purpose](#1-purpose)
2. [Baseline snapshot (FeedLayout redesign)](#2-baseline-snapshot-feedlayout-redesign)
3. [How to measure](#3-how-to-measure)
4. [Regression gates](#4-regression-gates)
5. [Release comparison template](#5-release-comparison-template)
6. [FeedLayout performance notes](#6-feedlayout-performance-notes)

---

## 1. Purpose

This document records **post–FeedLayout redesign** performance baselines for:

| Metric | Why it matters |
|--------|----------------|
| Feed load time | First content visible |
| Initial render time | Time to interactive feed |
| Image loading | Perceived quality of fitness media |
| Scroll FPS | Core feed UX |
| Memory usage | Long scroll sessions |
| Re-render count | React efficiency |
| Bundle impact | Download + parse cost |
| Largest Contentful Paint (web) | SEO + perceived speed |

---

## 2. Baseline snapshot (FeedLayout redesign)

**Release context:** FeedLayout system + `FeedMedia` + inline action bar  
**Date recorded:** July 5, 2026  
**Environment:** Pending Founder device QA — fill cells after measurement

### Network & data

| Metric | Baseline | Target | How measured |
|--------|----------|--------|--------------|
| Feed API (`getFeed`) avg | _TBD_ | < 1200ms p95 | `npx tsx scripts/measure-feed-perf.ts <userId>` |
| Feed API min / max | _TBD_ | — | Same script (3 runs) |
| Posts per first page | _TBD_ | — | API response |

### Client render (feed tab)

| Metric | Baseline | Target | How measured |
|--------|----------|--------|--------------|
| Feed load time (first paint) | _TBD_ | < 1500ms p95 | `perf_feed_load` event / DevTools Performance |
| Initial render time (10 posts) | _TBD_ | < 800ms | React DevTools Profiler |
| Time to first media decode | _TBD_ | < 2000ms | Network + Performance panel |
| Re-renders per scroll (1 screen) | _TBD_ | ≤ 1× visible rows | React DevTools “Record why each component rendered” |

### Scroll & runtime

| Metric | Baseline | Target | How measured |
|--------|----------|--------|--------------|
| Scroll FPS (iPhone Safari) | _TBD_ | ≥ 55 fps sustained | Safari Web Inspector → Timelines |
| Scroll FPS (Android) | _TBD_ | ≥ 55 fps sustained | Chrome remote debugging |
| Scroll FPS (desktop web) | _TBD_ | ≥ 58 fps sustained | Chrome Performance → FPS meter |
| Memory after 5 min scroll | _TBD_ | No unbounded growth | Safari / Chrome Memory tab |
| JS heap (web, feed tab) | _TBD_ | < 150MB | Chrome Memory snapshot |

### Web vitals

| Metric | Baseline | Target | How measured |
|--------|----------|--------|--------------|
| Largest Contentful Paint (LCP) | _TBD_ | < 2.5s (good) | Lighthouse / `web-vitals` |
| First Contentful Paint (FCP) | _TBD_ | < 1.8s | Lighthouse |
| Cumulative Layout Shift (CLS) | _TBD_ | < 0.1 | Lighthouse (feed should be stable post–aspect fix) |
| Interaction to Next Paint (INP) | _TBD_ | < 200ms | Lighthouse / field data |

### Bundle impact (FeedLayout module)

| Metric | Baseline | Notes |
|--------|----------|-------|
| `feed-layout/` source (pre-minify) | ~20 KB | 9 modules — tokens, slots, FeedMedia, extensions, action bar |
| Web bundle delta vs pre-redesign | _TBD_ | Run `npm run build:web` → compare `dist/_expo/static/js/web/index-*.js` size |
| Tree-shakeable exports | Yes | Extension types are type-only at compile time |

### Automated verification (static)

| Check | Result (July 5, 2026) |
|-------|-------------------------|
| `npm run verify:feed-layout` | 11/11 PASS |
| `npm run verify:feed-media` | 10/10 PASS |
| `npm run verify:post-login` | 13/13 PASS |

---

## 3. How to measure

### Feed API

```bash
cd apps/mobile
npx tsx scripts/measure-feed-perf.ts <userId>
```

Requires `.env` with Supabase keys.

### Client perf events

Signed-in users emit `perf_feed_load`, `perf_screen_load` via `ProductAnalyticsBootstrap`. Summary: **Settings → Product analytics** (admin).

### iPhone Safari scroll FPS

1. Connect iPhone → Mac → Safari → Develop → [device] → Timelines  
2. Open feed, scroll 30s through 20+ posts  
3. Record average FPS and any jank spikes

### LCP (web)

```bash
cd apps/mobile
npm run build:web
npx lighthouse http://127.0.0.1:<port> --only-categories=performance --form-factor=mobile
```

Or use Chrome DevTools → Lighthouse on production URL (authenticated session).

### Re-render audit

1. React DevTools → Profiler → “Record why each component rendered”  
2. Scroll feed one viewport  
3. Count `FeedPostCard` / `FeedMedia` re-renders — should match changed rows only

### Memory

1. Open feed, scroll 50 posts, return to top  
2. Take heap snapshot  
3. Repeat after 5 minutes — compare detached DOM / image cache growth

---

## 4. Regression gates

**Do not ship** a feed release if:

| Gate | Threshold |
|------|-----------|
| Feed API p95 | > 1200ms (without API change justification) |
| LCP (mobile web) | > 2.5s on Founder test device |
| Scroll FPS | < 50 fps sustained on iPhone Safari |
| Memory | Monotonic growth over 5 min scroll (leak) |
| `verify:feed-layout` / `verify:feed-media` | Any failure |
| Bundle size | > +5% vs baseline without feature justification |

---

## 5. Release comparison template

Copy this table into each release notes / readiness report:

| Metric | Baseline (Jul 2026) | This release | Δ | Pass? |
|--------|---------------------|--------------|---|-------|
| Feed API avg (ms) | | | | |
| LCP (ms) | | | | |
| Scroll FPS (iPhone) | | | | |
| JS heap after scroll (MB) | | | | |
| Web bundle (KB gzip) | | | | |
| FeedPostCard re-renders / scroll | | | | |

---

## 6. FeedLayout performance notes

Architectural choices that protect performance at scale:

| Design choice | Performance benefit |
|---------------|---------------------|
| `memo(FeedPostCard)`, `memo(FeedMedia)` | Rows skip re-render when props unchanged |
| `FeedMediaSlot` + IntersectionObserver | Off-screen media not mounted on web |
| `mediaActive` viewability gate | Native deferral of carousel/video |
| Exact aspect frames (no min-height inflation) | Fewer layout recalculations / CLS |
| Optional extension slots render `null` when empty | Zero cost for standard posts today |
| Extension components lazy-loaded (future) | Sponsored/affiliate UI loads on demand |
| Single `FeedMedia` pipeline | No duplicate sizing logic / probe requests |
| Soft scroll lock on sheets only | Avoids full feed pointer freeze |

**When adding monetization slots:** use `React.lazy` + `Suspense` for heavy commerce UI; keep slot wrappers in `@frennix/ui` thin.

---

## Founder action items

- [ ] Run device QA checklist (iPhone → Android → desktop)  
- [ ] Fill _TBD_ cells in [§2 Baseline snapshot](#2-baseline-snapshot-feedlayout-redesign)  
- [ ] Capture Lighthouse LCP on authenticated feed  
- [ ] Approve baseline as official reference for v1.0.3+
