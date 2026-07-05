# Frennix Feed Design System

**Status:** Permanent — required for every feed post  
**Last updated:** July 5, 2026  
**Owner:** Engineering + Design + Founder  
**Code:** `packages/ui/src/feed-layout/`  
**Component reference:** [`packages/ui/src/feed-layout/COMPONENTS.md`](./packages/ui/src/feed-layout/COMPONENTS.md)  
**Global tokens:** `packages/ui/src/theme.ts`  
**Interaction pattern:** `features/releases/FEED-POST-INTERACTION-PATTERN.md`  
**Parent doc:** [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md)

> The feed is Frennix’s primary surface. Fitness media must be shown **in full**, at **maximum size**, with **one consistent layout** across every post type. This document is the single source of truth for feed layout, spacing, typography, and media behavior.

---

## Table of contents

1. [Principles](#1-principles)
2. [Architecture](#2-architecture)
3. [Layout hierarchy](#3-layout-hierarchy)
4. [Spacing tokens](#4-spacing-tokens)
5. [Typography hierarchy](#5-typography-hierarchy)
6. [Header](#6-header)
7. [Media sizing rules](#7-media-sizing-rules)
8. [Action bar](#8-action-bar)
9. [Caption, engagement, comments](#9-caption-engagement-comments)
10. [Maximum content width & responsive behavior](#10-maximum-content-width--responsive-behavior)
11. [Portrait, landscape, square, and video](#11-portrait-landscape-square-and-video)
12. [Future post types](#12-future-post-types)
13. [Performance requirements](#13-performance-requirements)
14. [Verification](#14-verification)
15. [Redesign playbook](#15-redesign-playbook)
16. [Extension points (monetization & future content)](#16-extension-points-monetization--future-content)

---

## 1. Principles

| Principle | Rule |
|-----------|------|
| **Media first** | Header is compact; media is the visual anchor of every post |
| **Preserve fitness content** | Never auto-crop progress photos, transformations, race results, or workout screenshots |
| **Original aspect ratio** | Frame height = width × (imageHeight / imageWidth); no stretch, no distortion |
| **Edge-to-edge media** | Photos and videos use full post width; text sections use consistent inset |
| **One layout system** | All post types compose `FeedLayout` + `FeedMedia` — no screen-specific spacing |
| **Performance** | Deferred media mount, memoized cards, no extra layout thrash |

---

## 2. Architecture

```
FeedPostCard (composer — maps Post data to layout slots)
    └── FeedLayout (section shell + tokens)
            ├── FeedLayout.Root
            ├── FeedLayout.Header
            ├── FeedMedia ← canonical media mount (ALL post types)
            │       └── FeedMediaSlot (deferred load)
            │               └── PostMediaCarousel
            │                       └── PostMedia / FeedVideoPlayer
            │                               └── MediaAspectFrame
            ├── FeedPostActionBar
            ├── FeedLayout.Caption
            ├── FeedLayout.Engagement
            └── FeedLayout.Comments
```

| Module | Path | Role |
|--------|------|------|
| **Tokens** | `feed-layout/tokens.ts` | Spacing, typography, max width |
| **Media rules** | `feed-layout/feedMediaRules.ts` | Aspect ratio, crop policy, defer rules |
| **Layout shell** | `feed-layout/FeedLayout.tsx` | Section slots |
| **Feed media** | `feed-layout/FeedMedia.tsx` | **Required** media entry point |
| **Action bar** | `feed-layout/FeedPostActionBar.tsx` | Inline social actions |
| **Composer** | `FeedPostCard.tsx` | Reference implementation |

**Rule:** New feed post types add content to `FeedPostCard` (or a sibling composer) using `FeedLayout` slots. They **must not** implement custom media sizing or padding.

---

## 3. Layout hierarchy

Every feed post follows this order:

```
┌─────────────────────────────────────────┐
│ 1. HEADER (compact)                     │
│    Avatar · Display name · @username      │
│    Workout type · Timestamp             │
├─────────────────────────────────────────┤
│ 2. MEDIA (edge-to-edge, aspect-true)    │
│    FeedMedia → photos / videos / carousel │
├─────────────────────────────────────────┤
│ 3. ACTIONS                              │
│    Like · Strong Work · Comment · Share · More │
├─────────────────────────────────────────┤
│ 4. CAPTION                              │
├─────────────────────────────────────────┤
│ 5. ENGAGEMENT                           │
│    Like count · reaction summary · chips │
├─────────────────────────────────────────┤
│ 6. COMMENTS + INPUT                     │
│    Preview rows · “Add a comment…”      │
└─────────────────────────────────────────┘
```

Embedded shared posts use `FeedLayout.Media embedded` (small horizontal inset + rounded card).

---

## 4. Spacing tokens

**Source:** `feedLayout` in `packages/ui/src/feed-layout/tokens.ts`

| Token | Value | Applies to |
|-------|-------|------------|
| `contentPaddingX` | 8px (`spacing.sm`) | Header, actions, caption, engagement, comments |
| `mediaMarginX` | 0 | Primary media (edge-to-edge) |
| `mediaMarginTop` | 4px (`spacing.xs`) | Gap below header |
| `sectionGap` | 2px (`spacing.xxs`) | Internal section rhythm |
| `postPaddingBottom` | 8px (`spacing.sm`) | Post card bottom |
| `header.paddingTop` | 8px | Header top |
| `header.paddingBottom` | 4px | Header bottom |
| `header.gap` | 8px | Avatar ↔ text |
| `actions.paddingTop/Bottom` | 2px | Action bar vertical |
| `actions.gap` | 24px (`spacing.lg`) | Between action buttons |
| `caption.paddingTop` | 4px | Below action bar |
| `engagement.paddingTop` | 4px | Below caption |
| `engagement.gap` | 2px | Between engagement lines |
| `comments.paddingTop` | 4px | Below engagement |
| `comments.rowGap` | 2px | Between comment rows |
| `comments.commentInputMarginTop` | 4px | “Add a comment…” |

**Do not** add feed-specific margins in individual components. Import `feedLayout` or use `FeedLayout` slots.

---

## 5. Typography hierarchy

**Source:** `feedLayoutTypography` in `feed-layout/tokens.ts`

| Role | Token | Size / weight | Color |
|------|-------|---------------|-------|
| Display name | `displayName` | 14px / 700 | `colors.text` |
| Username | `username` | 12px / 500 | `colors.accent` |
| Workout + time meta | `meta` | 12px / 500 | `colors.textMuted` |
| Caption | `caption` | 16px / 400, LH 22 | `colors.text` |
| Like count | `engagement` | 14px / 600 | `colors.textSecondary` |
| Reaction summary | `reactionSummary` | 14px / 700 | `colors.text` |
| Comment body | `commentText` | 14px / 400, LH 18 | `colors.text` |
| Comment author | `commentAuthor` | 14px / 700 | `colors.text` |
| Muted labels | `commentMuted` | 14px / 400 | `colors.textMuted` |

**Header meta helper:** `formatFeedCompactHeaderMeta()` — `🏃 Running · 2h` inline (no chip row on feed).

---

## 6. Header

| Element | Spec |
|---------|------|
| **Avatar size** | 36px (`feedLayout.header.avatarSize`) |
| **Display name** | Line 1, bold |
| **Username** | Line 2, `@username`, accent color |
| **Workout + timestamp** | Line 3 (or line 2 if no username), muted meta |
| **Tap target** | Whole header row → author profile (`ScalePressable`) |

Workout types render inline via emoji + label (`formatWorkoutTypesInline`), not `WorkoutTypeChips` on feed.

---

## 7. Media sizing rules

**Source:** `feedMediaRules` in `feed-layout/feedMediaRules.ts`

| Rule | Value |
|------|-------|
| **Component** | `FeedMedia` — required for all feed media |
| **Layout mode** | `"feed"` → edge-to-edge, no border radius |
| **Preserve aspect ratio** | `true` |
| **Auto-crop** | `false` — **never** cap portrait at 4:5 or crop fitness content |
| **Content fit** | `contain` inside exact-aspect frame |
| **Frame height** | `width × (intrinsicHeight / intrinsicWidth)` after dimension probe |
| **Loading skeleton** | `FEED_MIN_MEDIA_HEIGHT` (280px) — **only** while dimensions unknown |
| **Photo fallback ratio** | 5:4 (`FEED_PHOTO_FALLBACK_RATIO`) before probe |
| **Video fallback ratio** | 9:16 (`FEED_VIDEO_FALLBACK_RATIO`) before poster probe |
| **Defer mount** | `FeedMediaSlot` + IntersectionObserver on web (`320px` root margin) |
| **Multi-photo** | `PostMediaCarousel` horizontal paging at measured container width |

**Implementation chain (do not bypass):**

`FeedMedia` → `FeedMediaSlot` → `PostMediaCarousel` → `PostMedia` / `FeedVideoPlayer` → `MediaAspectFrame`

---

## 8. Action bar

**Component:** `FeedPostActionBar`

| Spec | Value |
|------|-------|
| Row height | 44px (matches `touchTarget`) |
| Icon size | 22px |
| Horizontal gap | 24px |
| Horizontal padding | 8px (`contentPaddingX`) |
| Actions | Like · Strong Work · Comment · Share · More |

| Button | Handler | Notes |
|--------|---------|-------|
| Like | `onLike` | Filled ♥ when `liked_by_me` |
| Strong Work | `onReaction("💪")` | Fitness-native reaction |
| Comment | `onComment` | Post detail |
| Share | `onShare` | Share sheet |
| More | `onInteractPress` | `PostInteractionSheet` |

Media tap opens **lightbox**, not the sheet.

---

## 9. Caption, engagement, comments

### Caption (`FeedLayout.Caption`)

- Below action bar
- Tap → post detail
- Padding: `contentPaddingX` horizontal, `caption.paddingTop` vertical

### Engagement (`FeedLayout.Engagement`)

- Like count line (`formatEngagementSummary`)
- Reaction summary line (`formatReactionSummary`)
- `ReactionBar` chips (compact) — community reactions

### Comments (`FeedLayout.Comments` + `FeedCommentPreview`)

- “View all comments” when count > 2
- Up to 2 preview rows
- “Add a comment…” input affordance
- Spacing from `feedLayout.comments.*`

---

## 10. Maximum content width & responsive behavior

**Source:** `feedLayout.maxContentWidth` + `feedResponsiveRules`

| Surface | Max post width | Media | Text inset |
|---------|----------------|-------|------------|
| **iPhone** | 100% screen | Edge-to-edge | 8px |
| **Android** | 100% screen | Edge-to-edge | 8px |
| **Tablet (web)** | 640px centered | Edge-to-edge within post | 8px |
| **Desktop (web)** | 640px centered | Edge-to-edge within post | 8px |

Implementation: `FeedLayout.Root` applies `maxWidth: 640` and `alignSelf: center` on web only; native uses full device width.

Feed list container does **not** add horizontal padding — posts control their own inset via tokens.

---

## 11. Portrait, landscape, square, and video

| Media type | Frame behavior | User-visible result |
|------------|----------------|-------------------|
| **Portrait** | Full natural height (no cap) | Progress/transformation photos show entirely |
| **Landscape** | Natural short height (no min-height inflation) | Race results, gym wide shots at full width |
| **Square** | 1:1 frame | Lifting photos, screenshots |
| **Video** | Poster aspect → exact frame; autoplay muted when visible | Workout clips, race footage |
| **Multi-photo** | Each slide measured at container width | Carousel paging, dots, counter |
| **Shared embed** | `embedded` inset + rounded card | Original post preview |

**Never:**

- Auto-crop to 4:5 or any fixed ratio
- Stretch to fill a mismatched frame
- Apply `FEED_MIN_MEDIA_HEIGHT` after dimensions load (causes letterboxing on landscape)

---

## 12. Future post types

All types below **must** compose `FeedLayout` and mount media through `FeedMedia`. Only header meta and caption content differ.

| Post type | Header meta | Media |
|-----------|-------------|-------|
| Workout photo | Workout types · time | `FeedMedia` |
| Workout video | Workout types · time | `FeedMedia` |
| Progress update | Post kind · time | Optional `FeedMedia` |
| Transformation | Workout types · time | `FeedMedia` (full portrait) |
| Challenge | Achievement · time | `FeedMedia` |
| Event | Event · time | `FeedMedia` |
| Recipe | Post kind · time | `FeedMedia` |
| Coach post | Workout types · time | `FeedMedia` |
| Achievement | Achievement · time | `FeedMedia` or text-only |
| Race results | Workout types · time | `FeedMedia` (often landscape) |
| Workout screenshot | Workout types · time | `FeedMedia` (often square) |
| Shared post | Shared a post · time | `FeedLayout.Media embedded` |

**Adding a new type:**

1. Extend API/post model if needed
2. Map data in `FeedPostCard` (or typed composer)
3. Use existing `FeedLayout` slots — **no new spacing constants**
4. Run `npm run verify:feed-layout`

---

## 13. Performance requirements

The feed layout system is designed for scroll performance at scale.

| Technique | Where | Purpose |
|-----------|-------|---------|
| `memo(FeedPostCard)` | `FeedPostCard.tsx` | Prevent unnecessary row re-renders |
| `memo(FeedMedia)` | `FeedMedia.tsx` | Stable media subtree |
| `FeedMediaSlot` defer | Web IntersectionObserver | Avoid mounting off-screen carousels/videos |
| `mediaActive` gating | `FeedListItem` | Native viewability defers heavy mounts |
| No min-height inflation | `MediaAspectFrame` | Avoid layout jumps and extra paint |
| Skeleton while loading | `FeedMediaSlot` | Placeholder without decoding images |
| Carousel windowing | `PostMediaCarousel` | `initialNumToRender: 2`, `windowSize: 3` |
| Soft scroll lock only | Feed + sheets | No `touchAction: none` on interaction sheet |

**Avoid:**

- Inline style objects that change every render in hot paths
- Per-post layout measurement beyond media width probe
- Bypassing `FeedMedia` with custom `Image` components on feed

---

## 14. Verification

```bash
npm run verify:feed-layout
npm run verify:feed-media
npm run verify:post-login
node scripts/verify-post-interaction.mjs
node scripts/verify-safari-feed-fix.mjs
```

Ship gate: physical iPhone Safari feed scroll + sheet dismiss before release.

---

## 15. Redesign playbook

To redesign the feed in the future:

1. Update `feed-layout/tokens.ts` (spacing, typography, avatar, max width)
2. Update `feed-layout/feedMediaRules.ts` if media policy changes (requires Founder approval for crop/fit changes)
3. Adjust `FeedPostActionBar` if action affordances change
4. Run verification scripts + full device QA
5. Update this document

**Do not** edit spacing in `FeedCommentPreview`, `SharedPostPreview`, or screen files directly — extend tokens or slots instead.

---

## 16. Extension points (monetization & future content)

**Types:** `feed-layout/feedLayoutExtensions.ts`  
**Slots:** `FeedLayout.Label`, `HeaderTrailing`, `MediaOverlay`, `BelowMedia`, `Commerce`, `Footer`

Future features plug in via `FeedPostLayoutSlots` on `FeedPostCard` (or a typed composer). **No layout rewrite required.**

### Slot order

```
Label → Header (+ HeaderTrailing) → Media (+ MediaOverlay) → BelowMedia →
Actions → Caption → Commerce → Engagement → Comments → Footer
```

### Slot map (deferred implementations)

| Future feature | Slot(s) | Component to add later |
|----------------|---------|------------------------|
| Sponsored posts | `label`, `footer` | `FeedSponsoredLabel` |
| Promoted challenges | `label`, `belowMedia` | `FeedPromotedChallengeStrip` |
| Coach content | `headerTrailing`, `commerce` | `FeedCoachBadge`, `FeedCoachUpsell` |
| Featured creators | `label`, `headerTrailing` | `FeedFeaturedLabel` |
| Premium content | `headerTrailing`, `mediaOverlay` | `FeedPremiumBadge`, `FeedPremiumGate` |
| Verified badges | `headerTrailing` | `FeedVerifiedBadge` |
| Affiliate products | `commerce` | `FeedAffiliateCarousel` |
| Events | `belowMedia` | `FeedEventRsvpStrip` |
| Nutrition / recipes | `commerce` | `FeedNutritionCard` |
| Progress / transformations | standard slots | `FeedProgressMeta` (header meta only) |
| Race results | standard slots | `FeedRaceResultMeta` |
| Videos | `FeedMedia` + optional `mediaOverlay` | `FeedVideoBadge` |
| Stories | `belowMedia` | `FeedStoryAttachment` |
| Advertisements | `label`, `mediaOverlay`, `footer` | `FeedAdLabel`, `FeedAdOverlay` |

### Content & monetization types

`FeedContentKind` and `FeedMonetizationKind` unions define the taxonomy. `FEED_CONTENT_KIND_DEFAULTS` and `FEED_MONETIZATION_SLOT_HINTS` document recommended slots per kind.

**Adding a monetized post type:**

1. Extend API metadata (`post_kind`, `monetization`, etc.)
2. Create a small slot component (e.g. `FeedSponsoredLabel.tsx`)
3. Pass `slots={{ label: <FeedSponsoredLabel /> }}` from composer
4. Add tokens only if new spacing is required (`feedLayout.extensions`)

**Performance rule:** Extension slot components must be `memo`'d and lazy-loaded when heavy (e.g. affiliate carousel).

See also: [`PERFORMANCE.md`](./PERFORMANCE.md) for baseline metrics after feed redesign.

---

## 17. Accessibility & App Store quality

**Constants:** `feedAccessibility`, `FEED_FONT_SCALE_MAX` (1.35) in `feed-layout/tokens.ts`  
**Component guide:** [`packages/ui/src/feed-layout/COMPONENTS.md`](./packages/ui/src/feed-layout/COMPONENTS.md)

| Requirement | Implementation |
|-------------|----------------|
| **Dynamic Type** | Feed `Text` uses `allowFontScaling` + `maxFontSizeMultiplier: 1.35` (matches action sheets) |
| **VoiceOver** | All actions have `accessibilityLabel` + `accessibilityHint`; Like/Strong Work use `accessibilityState.selected` |
| **Touch targets** | Minimum 44×44pt via `touchTarget`; action bar uses `minWidth/minHeight: touchTarget` |
| **Safe areas** | Tab/sheet shells handle insets; media edge-to-edge; text uses `contentPaddingX` |
| **Dark mode** | Primary experience via `theme.ts` `colors`; light mode = swap theme palette later |
| **Long feeds** | `FeedMediaSlot` defer + `memo(FeedPostCard)` + carousel windowing — see `PERFORMANCE.md` |
| **60 FPS scroll** | No layout inflation; deferred media; soft sheet scroll lock only |

**Ship gate:** VoiceOver pass on one full feed scroll (header, actions, media, comments) on physical iPhone before release.
