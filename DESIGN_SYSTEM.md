# Frennix Design System

**Status:** Permanent — required before any new UI ships  
**Last updated:** July 5, 2026  
**Owner:** Engineering + Design + Founder  
**Code tokens:** `packages/ui/src/theme.ts`  
**Feed layout:** [`FEED_DESIGN_SYSTEM.md`](./FEED_DESIGN_SYSTEM.md) — canonical feed spacing, media, and post structure  
**Performance baseline:** [`PERFORMANCE.md`](./PERFORMANCE.md) — feed metrics after FeedLayout redesign  
**Overlay deep-dive:** `features/releases/FRENNIX-DESIGN-SYSTEM.md`  
**Feed interactions:** `features/releases/FEED-POST-INTERACTION-PATTERN.md`  
**Bottom sheets:** `features/releases/BOTTOM-ACTION-SHEET-STANDARD.md`  
**Safe areas:** `features/releases/OVERLAY-SAFE-AREA.md`

> Every surface in Frennix must feel like it belongs in the same app as Instagram, Apple Fitness, or Threads — with Frennix’s fitness identity. We are **not** building another generic social media app.

---

## Table of contents

1. [Design principles](#1-design-principles)
2. [Design bar (ship gates)](#2-design-bar-ship-gates)
3. [Color & surfaces](#3-color--surfaces)
4. [Typography](#4-typography)
5. [Spacing](#5-spacing)
6. [Corner radius](#6-corner-radius)
7. [Icons & touch targets](#7-icons--touch-targets)
8. [Motion & animation](#8-motion--animation)
9. [Shadows & elevation](#9-shadows--elevation)
10. [BottomActionSheet system](#10-bottomactionsheet-system)
11. [Safe-area & Safari viewport](#11-safe-area--safari-viewport)
12. [Component map](#12-component-map)
13. [Interaction patterns](#13-interaction-patterns)
14. [Web-specific rules](#14-web-specific-rules)
15. [Accessibility](#15-accessibility)
16. [Verification gates](#16-verification-gates)
17. [Migration backlog](#17-migration-backlog)

---

## 1. Design principles

### Product alignment

Every UI decision must pass the Product Vision litmus test:

> **"Does this make it easier or more motivating for someone to stay consistent with their fitness journey?"**

Frennix reinforces **motivation**, **accountability**, **connection**, and **consistency** — not passive scrolling.

### UX principles (agreed)

| Principle | Rule |
|-----------|------|
| **Native iPhone feel** | Bottom sheets use spring physics, swipe dismiss, content-sized height — not web modals with arbitrary min-heights |
| **No scroll when unnecessary** | Action sheets with ≤6 tiles must not scroll; sheet hugs content |
| **No clipping** | 28px comfortable margin above Safari toolbar / home indicator on all overlays |
| **Feed stays alive** | After dismissing any sheet: scroll works, taps work, no black dead band, no pointer freeze |
| **Fitness-first affordances** | **＋** on reaction bar is reserved for **Quick Log Workout** (Phase C) — not generic social actions |
| **Single trigger for post actions** | Header **⋯** opens `PostInteractionSheet` on feed (Phase A) |
| **Reuse, don’t fork** | All bottom sheets use `BottomActionSheet`; all overflow menus use `MenuIconButton` |
| **Extend before create** | Use `@frennix/ui` tokens and existing shells before inventing one-off styles |

### Do not change without Founder approval

- Global `document.body.overflow = hidden` for interaction sheets (causes BUG-004 freeze)
- Reintroducing `OverlaySafeAreaProvider` app-wide (caused black screen regression)
- `touchAction: none` on feed for post interaction sheets (hard lock is for story viewer only)
- Triple-applying fixed viewport height on feed wrapper + scroll + inner content (causes black band)
- One-off overlay implementations that bypass safe-area tokens

---

## 2. Design bar (ship gates)

Before merging or deploying any new UI:

1. **Physical iPhone Safari test** — scrolling, safe areas, animations, responsiveness, usability (`RELEASE_PROCESS.md` Rule 13). Simulator and automated checks alone are insufficient.
2. **Design system compliance** — spacing, radius, typography, colors from theme; no magic numbers unless documented here (`RELEASE_PROCESS.md` Rule 14).
3. **Overlay safe area** — 28px above home indicator / Safari toolbar (`OVERLAY_BOTTOM_SAFETY_MARGIN_PX`).
4. **Reusable shell** — `BottomActionSheet`, `BottomOverlayShell`, or `CenterOverlayShell`; never hand-roll `Modal` + `flex-end` without safe area.
5. **Automated verification** — run relevant scripts from [§16](#16-verification-gates).

---

## 3. Color & surfaces

**Source:** `packages/ui/src/theme.ts` → `colors`, `overlays`

### Core palette

| Token | Hex | Use |
|-------|-----|-----|
| `colors.background` | `#0A0A0B` | App background, feed |
| `colors.surface` | `#141416` | Cards, sheet surface |
| `colors.surfaceElevated` | `#1C1C1F` | Action tiles, elevated rows |
| `colors.border` | `#2A2A2E` | Dividers, card borders |
| `colors.text` | `#FAFAFA` | Primary text |
| `colors.textSecondary` | `#A1A1AA` | Secondary labels |
| `colors.textMuted` | `#71717A` | Captions, metadata |
| `colors.accent` | `#22C55E` | Primary CTA, active states (fitness green) |
| `colors.accentMuted` | `#166534` | Accent backgrounds |
| `colors.danger` | `#EF4444` | Destructive actions |
| `colors.warning` | `#F59E0B` | Warnings |

### Overlay & glass surfaces

| Token | Use |
|-------|-----|
| `overlays.glass` | Story viewer, modal backdrops |
| `overlays.accentTint` | Selected/highlighted tiles |
| `overlays.whiteGhost` | Primary action tile fill (`rgba(255,255,255,0.06)`) |
| Backdrop (sheets) | `rgba(10,10,11,0.4)` + 12px blur on web |

### Semantic usage

| Role | Token |
|------|-------|
| Sheet surface | `colors.surface` |
| Action tile (primary) | `rgba(255,255,255,0.06)` border emphasis |
| Action tile (secondary) | `colors.surfaceElevated` |
| Active / selected | `colors.accent` border + `rgba(34,197,94,0.12)` fill |
| Liked / reacted | `colors.accent` text tint |

**UI style:** Dark mode only (`app.config.ts` → `userInterfaceStyle: "dark"`).

---

## 4. Typography

**Source:** `packages/ui/src/theme.ts` → `typography`

| Token | Size / weight | Use |
|-------|---------------|-----|
| `typography.title` | 28 / 700 | Hero titles |
| `typography.screenTitle` | 24 / 700 | Screen headers |
| `typography.heading` | 20 / 600 | Section headers |
| `typography.section` | 18 / 600 | Subsections |
| `typography.body` | 16 / 400 | Sheet headers, primary labels, post captions |
| `typography.bodySmall` | 14 / 400 | Secondary labels |
| `typography.caption` | 12 / 500 | Metadata, timestamps |
| `typography.button` | 16 / 600 | Button labels |
| `typography.badge` | 11 / 700 | Count badges |
| `typography.menuIcon` | 22 / 700 | Overflow **⋯** trigger |
| `typography.menuIconCompact` | 18 / 700 | Compact overflow menus |
| `typography.overlayHeadline` | 16 / 700 | Sheet section titles |
| `typography.overlayBody` | 14 / 500 | Sheet descriptions |

**Action sheet font scale cap:** `ACTION_SHEET_FONT_SCALE_MAX` = **1.35** — accessibility without layout break.

**Feed post meta:** Use `formatFeedCompactHeaderMeta()` for feed headers (workout types inline with timestamp). Use `formatFeedPostHeaderMeta()` for shared-post and non-workout fallbacks. Do not use deprecated `formatFeedPostMeta`.

**Feed layout:** All feed posts must compose `FeedLayout` from `packages/ui/src/feed-layout/`. Spacing, typography, and section order are defined in `feedLayout` tokens — never hard-code feed post margins in individual components.

---

## 5. Spacing

**Source:** `packages/ui/src/theme.ts` → `spacing`

| Token | px | Use |
|-------|-----|-----|
| `spacing.xxs` | 2 | Hairline gaps |
| `spacing.xs` | 4 | Tile inner gaps, tight stacks |
| `spacing.sm` | 8 | Grid gaps, handle padding |
| `spacing.md` | 16 | Sheet horizontal padding, section gaps, card padding |
| `spacing.lg` | 24 | Section separation |
| `spacing.xl` | 32 | Outer breathing room |
| `spacing.xxl` | 48 | Rare large gaps |

**Overlay bottom safety margin:** `OVERLAY_BOTTOM_SAFETY_MARGIN_PX` = **28** — never flush against screen edge or Safari toolbar.

**Sheet horizontal padding:** `spacing.md` (16px).

**Grid gap (action tiles):** `spacing.sm` (8px).

### FeedLayout (feed posts only)

**Canonical doc:** [`FEED_DESIGN_SYSTEM.md`](./FEED_DESIGN_SYSTEM.md)

**Source:** `packages/ui/src/feed-layout/tokens.ts` → `feedLayout`, `feedLayoutTypography`, `feedLayoutStyles`

All feed posts compose `FeedLayout` section slots. **Do not** add feed-specific padding in child components.

| Token / slot | Value | Use |
|--------------|-------|-----|
| `maxContentWidth` | 640px (web) | Max post width on large viewports |
| `contentPaddingX` | 8px (`spacing.sm`) | Header, actions, caption, engagement, comments |
| `mediaMarginX` | 0 | Edge-to-edge media |
| `header.avatarSize` | 36px | Profile photo |
| `header` typography | `feedLayoutTypography.displayName`, `.username`, `.meta` | Name, @username, workout · time |
| `actions.rowHeight` | 44px | Inline action bar |
| `actions.gap` | 24px (`spacing.lg`) | Space between action buttons |
| `caption` | `typography.body`, 22px line height | Post caption |
| `engagement` | `typography.bodySmall` | Likes + reaction summary |
| `comments` | `typography.bodySmall` | Preview rows + “Add a comment…” |

**Section order:** Header → Media → Actions → Caption → Engagement → Comments

**Verification:** `npm run verify:feed-layout`

---

## 6. Corner radius

**Source:** `packages/ui/src/theme.ts` → `radius`

| Token | px | Use |
|-------|-----|-----|
| `radius.sm` | 8 | Chips, small controls |
| `radius.md` | 12 | List rows, secondary cards |
| `radius.lg` | 16 | Action tiles, standard cards, feed media (inline) |
| `radius.lg + 8` (~24) | 24 | Bottom sheet top corners |
| `radius.full` | pill | Drag handle, icon buttons, avatars |

**Feed media:** Edge-to-edge (no radius) on feed; rounded on detail/inline contexts.

---

## 7. Icons & touch targets

| Constant | Value | Use |
|----------|-------|-----|
| `touchTarget` | 44px | Minimum tap area (Apple HIG) |
| `iconSize.xs` | 16 | Inline icons |
| `iconSize.sm` | 20 | Compact buttons |
| `iconSize.md` | 24 | Standard toolbar |
| `iconSize.lg` | 28 | Prominent actions |
| `iconSize.xl` | 32 | Hero actions |

**Icon library:** **Lucide React Native** (migrated off Ionicons for iOS Safari reliability — June 2026).

**Overflow menu component:** `MenuIconButton` from `@frennix/ui`
- Default `accessibilityLabel`: `"More options"`
- Feed posts: **`"Open post actions"`**
- Min touch: `touchTarget` (44px)

---

## 8. Motion & animation

**Source:** `packages/ui/src/theme.ts` → `animation`; sheet constants in `components/BottomActionSheet.tsx`

### Global navigation

| Constant | Value | Use |
|----------|-------|-----|
| `animation.stackFadeMs` | 200ms | Stack screen transitions |
| `animation.feedEnter` | 260ms, damping 22 | Feed post enter animation |
| `animation.pressScale` | 0.97 | `ScalePressable` feedback |
| `animation.skeletonPulseMs` | 700ms | Loading skeleton pulse |

### Bottom action sheets (required)

| Constant | Values | When |
|----------|--------|------|
| `BOTTOM_SHEET_SPRING_OPEN` | damping 24, stiffness 310, mass 0.92 | Sheet enter |
| `BOTTOM_SHEET_SPRING_DISMISS` | damping 28, stiffness 340, mass 0.9 | Sheet exit |
| `BOTTOM_SHEET_SPRING_REBOUND` | damping 22, stiffness 280, mass 0.85 | Cancelled drag |
| Backdrop fade | ~260ms timing | Parallel with spring |

**Interactions:**
- Swipe-down dismiss (full sheet when content not scrolling)
- Backdrop tap dismiss
- Centered drag handle (36×4px)
- **Never** use `animationType="slide"` without spring on action sheets

### List overlays (legacy)

`BottomOverlayShell` uses `animationType="fade"` — migrate to `BottomActionSheet` spring when polishing.

### Haptics

Use `lib/haptics.ts` for meaningful feedback (like, match, destructive confirm). Not yet wired on sheet open (polish backlog).

---

## 9. Shadows & elevation

**Source:** `packages/ui/src/theme.ts` → `shadows`

| Token | Use |
|-------|-----|
| `shadows.sm` | Subtle lift (chips) |
| `shadows.md` | Cards, floating buttons |
| `shadows.lg` | Modals, sheets (web) |

Dark theme uses low-opacity black shadows; prefer surface elevation over heavy shadows.

---

## 10. BottomActionSheet system

**Canonical stack** (do not fork):

```
PostInteractionSheet
  └── BottomActionSheet (shell: spring, swipe, safe-area, fitToContent)
        └── ActionSheetPriorityGrid / ActionSheetGrid
              └── ActionSheetTile (primary / secondary / standard)
```

### Layout rules

| Scenario | Behavior |
|----------|----------|
| ≤6 actions | `fitToContent={true}` — no scroll, no dead space |
| >6 actions | `ActionSheetGrid` with `scrollEnabled` on shell |
| 4 core actions | Primary row (92px): Like · Reply — Secondary row (76px): Strong Work · More |

### Visual tokens (action sheets)

| Element | Value |
|---------|-------|
| Sheet top radius | `radius.lg + 8` (~24px) |
| Drag handle | 36×4px, centered |
| Primary tile height | 92px |
| Secondary tile height | 76px |
| Primary tile surface | `rgba(255,255,255,0.06)` border |
| Secondary tile surface | `colors.surfaceElevated` |

### Safari layout hook

`useBottomActionSheetLayout` — active **only while sheet `visible`**. Never app-wide. Addresses BUG-002 toolbar lift.

### Dismiss cleanup

Always call `restoreWebDocumentScrollLock()` from `lib/web-document-scroll-lock.ts` on unmount.

---

## 11. Safe-area & Safari viewport

### Overlay safe area (all platforms)

- **28px** comfortable margin above home indicator / Safari bottom toolbar
- Implemented via `OVERLAY_BOTTOM_SAFETY_MARGIN_PX` in overlay shells
- Doc: `features/releases/OVERLAY-SAFE-AREA.md`

### Tab scene layout (BUG-003 / BUG-004 pattern)

**Correct pattern:**
```
Wrapper: webTabSceneContainerStyle()  → flex-fill, no fixed height
Scroll child only: webTabSceneHeightStyle() → bounded height from visualViewport
```

**Files:** `lib/web-tab-scene-layout.ts`, `lib/screen-shell.ts`

### Sheet-scoped viewport (BUG-002)

`useBottomActionSheetLayout` listens to `visualViewport` resize — lifts sheet above Safari toolbar when expanded.

### Feed scroll lock

| Context | Lock type |
|---------|-----------|
| Post interaction sheet | **Soft** — `scrollEnabled={false}` on feed scroll only |
| Story viewer | **Hard** — `touchLock={true}` on `WebFeedScrollList` |

**Never** set `touchAction: none` on feed for interaction sheets.

### Intentional `body { overflow: hidden }`

`lib/web-document-styles.js` sets this for feed scroll shell — **do not remove**; it is not a sheet regression. Verification scripts account for this.

---

## 12. Component map

### Design system (`@frennix/ui`)

| Component | Purpose |
|-----------|---------|
| `FeedLayout` | **Canonical feed post shell** — tokens + section slots (header, media, actions, caption, engagement, comments) |
| `FeedMedia` | **Required** feed media mount — aspect-preserving, deferred load, edge-to-edge |
| `FeedPostCard` | Feed post composer using `FeedLayout` + `FeedMedia` + `FeedPostActionBar` |
| `FeedPostActionBar` | Inline Like · Strong Work · Comment · Share · More row |
| `ReactionBar` | Emoji reaction counts below caption (tap to react) |
| `MenuIconButton` | Standard **⋯** overflow trigger |
| `Avatar`, `CachedImage`, `ProgressiveImage` | Media with caching |
| `ScalePressable` | Press feedback (0.97 scale) |
| `WorkoutTypeChips` | Workout type labels on posts |
| `FeedCommentPreview` | Comment preview row |
| `MessageBubble`, `UserRow`, `EmptyState`, `Button` | Shared primitives |

### App-specific shells (`components/`)

| Component | Purpose |
|-----------|---------|
| `BottomActionSheet` | Reusable native spring bottom sheet |
| `PostInteractionSheet` | Feed post action sheet (canonical reference) |
| `ActionSheetGrid`, `ActionSheetTile` | Grid layout for sheet actions |
| `EntityActionSheet` | List-style ownership/moderation menu (migrate to BottomActionSheet — Phase B) |
| `BottomOverlayShell` | Legacy list overlay (fade animation) |
| `CenterOverlayShell` | Centered modals |
| `WebFeedScrollList` | Safari-safe feed scroll (avoids RN Web FlatList bugs) |
| `FeedHeader`, `NewPostsBanner` | Feed chrome |

### Ownership framework (`lib/`)

| Module | Purpose |
|--------|---------|
| `entity-actions.ts` | Action registry types |
| `usePostActions.tsx`, `useEventActions.tsx`, `useChallengeActions.tsx` | Per-entity ⋯ menus |
| `post-interaction-actions.ts` | PostInteractionSheet action definitions |
| `usePostInteraction.tsx` | Sheet state + wiring |

---

## 13. Interaction patterns

### Feed post (FeedLayout — live)

| User action | Result |
|-------------|--------|
| Tap **Like / Strong Work / Comment / Share** (action bar) | Inline action (like, react, post detail, share sheet) |
| Tap **⋯** (action bar **More**) | Opens `PostInteractionSheet` |
| Tap media | Full-screen lightbox / video viewer |
| Tap author / @username | Profile |
| Tap caption | Post detail |
| Tap comment preview | Post detail / comments |
| Tap reaction chip | Apply reaction |

**Section order (every post):** Header → Media → Actions → Caption → Engagement → Comments

**Sheet content (More panel):**
- Primary: Like · Reply
- Secondary: Strong Work · More
- More panel: extended actions (scroll when tall)

**Media:** Edge-to-edge within post; original aspect ratio preserved; never auto-crop.

**Post-dismiss:** Feed scroll + tap restored; no modals lingering; `restoreWebDocumentScrollLock()`.

### Entity ownership (EntityActionSheet — pre-Phase B)

| Role | Actions |
|------|---------|
| Owner | Edit, Delete, Share, Copy Link (+ entity-specific) |
| Viewer | Share, Copy Link, Report, Block |

Used on: post detail, profile grid, challenge/event detail. **Target:** merge into PostInteractionSheet More panel (Phase B).

### Story viewer

Full-screen overlay; hard scroll lock on feed (`touchLock={storyVisible}`).

### Tab navigation

Feed tab re-tap: at top → refresh; scrolled → scroll to top.

### Press feedback

`ScalePressable` on tappable cards (author header, etc.) — `animation.pressScale` (0.97).

---

## 14. Web-specific rules

| Rule | Rationale |
|------|-----------|
| Use `WebFeedScrollList` on feed | RN Web FlatList causes Safari scroll bugs |
| Patch `dist/index.html` after build | `scripts/patch-web-html.js` — viewport, theme-color, flex-scroll CSS |
| Lucide SVG icons only | Font icons break on iOS Safari |
| `visualViewport` for tab height | Safari toolbar show/hide changes layout viewport |
| No `document.body.overflow = hidden` from sheets | Causes post-dismiss freeze (BUG-004) |
| Deploy from committed `dist/` | Vercel serves prebuilt static export |
| Test on physical iPhone Safari | Desktop Chrome passes do not guarantee mobile behavior |

---

## 15. Accessibility

| Requirement | Implementation |
|-------------|----------------|
| Min touch target | 44px (`touchTarget`) |
| Accessibility labels | All icon-only buttons (e.g. `"Open post actions"`) |
| Dynamic Type cap on sheets | `ACTION_SHEET_FONT_SCALE_MAX` = 1.35 |
| `accessibilityRole="button"` | On custom pressable regions (caption tap) |
| Color contrast | Light text on dark surfaces; accent green for active states |

---

## 16. Verification gates

```bash
# Bottom sheets + feed post-dismiss
node scripts/verify-post-interaction.mjs --url https://frennix.vercel.app

# Safari feed layout + scroll
node scripts/verify-safari-feed-fix.mjs --url https://frennix.vercel.app

# Training Calendar viewport (BUG-003)
node scripts/verify-calendar-viewport.mjs --url https://frennix.vercel.app

# Overlay safe-area compliance (static)
npm run verify:sheet-safe-area
```

**Plus:** Physical iPhone Safari sign-off per `features/releases/checklists/OVERLAY-MODAL-QA.md`.

---

## 17. Migration backlog

| From | To | Phase | Status |
|------|-----|-------|--------|
| `EntityActionSheet` + `BottomOverlayShell` | `BottomActionSheet` + grid/list rows | B | Planned |
| Reaction bar **＋** → post sheet | **＋** → Quick Log Workout | C | Planned (Founder decision) |
| Caption/media tap → sheet | Tap → post detail/lightbox; **⋯** only for sheet | Polish | Planned |
| `BottomOverlayShell` fade | `BottomActionSheet` spring | Ongoing | Per-overlay |
| Haptics on sheet open | `lib/haptics.ts` | Polish | Planned |
| Staggered tile animation | Reanimated stagger | Polish | Planned |
| Inline double-tap like | Feed gesture | Polish | Planned |
| Icon+label tiles | ActionSheetTile polish | Polish | Planned |

---

## Related documents

- `features/releases/FRENNIX-DESIGN-SYSTEM.md` — overlay-focused subset (introduced v1.0.3)
- `features/releases/FEED-POST-INTERACTION-PATTERN.md` — feed post behavior spec
- `features/releases/BOTTOM-ACTION-SHEET-STANDARD.md` — action sheet implementation spec
- `features/releases/OVERLAY-SAFE-AREA.md` — 28px margin system
- `features/releases/RELEASE_PROCESS.md` — Rules 13 (device QA) and 14 (design system)
- `features/PRODUCT_VISION.md` — product alignment source of truth
