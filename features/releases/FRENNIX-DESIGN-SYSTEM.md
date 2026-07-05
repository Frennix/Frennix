# Frennix Design System — Overlays & Interactions

**Status:** Permanent — required before any new UI ships  
**Owner:** Engineering + Design + Founder  
**Code tokens:** `packages/ui/src/theme.ts`  
**Introduced:** v1.0.3 (post-interaction sheet template)

> Every bottom sheet, modal, menu, and overlay must feel like it belongs in the same app as Instagram, Apple Fitness, or Threads — with Frennix’s fitness identity.

---

## Design bar

Before merging or deploying any new UI component:

1. **Physical iPhone Safari test** — scrolling, safe areas, animations, responsiveness, usability ([`RELEASE_PROCESS.md`](./RELEASE_PROCESS.md) Rule 13).
2. **Token compliance** — spacing, radius, typography, colors from `@frennix/ui` theme; no one-off magic numbers unless documented here.
3. **Overlay safe area** — 28px above home indicator / Safari toolbar ([`OVERLAY-SAFE-AREA.md`](./OVERLAY-SAFE-AREA.md)).
4. **Reusable shell** — use shared components; do not hand-roll `Modal` + `flex-end` without safe area.

---

## Spacing

| Token | px | Use |
|-------|-----|-----|
| `spacing.xs` | 4 | Tile inner gaps, tight stacks |
| `spacing.sm` | 8 | Grid gaps, handle padding |
| `spacing.md` | 16 | Sheet horizontal padding, section gaps |
| `spacing.lg` | 24 | Section separation |
| `spacing.xl` | 32 | Rare outer breathing room |

**Overlay bottom safety margin:** `OVERLAY_BOTTOM_SAFETY_MARGIN_PX` = **28** (never flush to screen edge).

---

## Corner radius

| Token | px | Use |
|-------|-----|-----|
| `radius.sm` | 8 | Chips, small controls |
| `radius.md` | 12 | List rows, secondary cards |
| `radius.lg` | 16 | Action tiles, standard cards |
| `radius.lg + 8` (~24) | 24 | Bottom sheet top corners |
| `radius.full` | pill | Drag handle, icon buttons |

---

## Typography

| Token | Use |
|-------|-----|
| `typography.body` | Sheet headers, primary labels |
| `typography.bodySmall` | Secondary labels, captions |
| `typography.caption` | Section titles, metadata |
| `typography.menuIcon` | Overflow **⋯** trigger |

**Font scale cap on action sheets:** `ACTION_SHEET_FONT_SCALE_MAX` = 1.35 (accessibility without layout break).

---

## Color & surfaces

| Role | Token |
|------|-------|
| App background | `colors.background` (#0A0A0B) |
| Sheet surface | `colors.surface` |
| Action tile | `colors.surfaceElevated` |
| Primary tile emphasis | `rgba(255,255,255,0.06)` |
| Active / selected | `colors.accent` border + `rgba(34,197,94,0.12)` fill |
| Backdrop | `rgba(10,10,11,0.4)` + 12px blur (web) |

---

## Motion

### Bottom action sheets

| Constant | Values | When |
|----------|--------|------|
| `BOTTOM_SHEET_SPRING_OPEN` | d24 / s310 / m0.92 | Sheet enter |
| `BOTTOM_SHEET_SPRING_DISMISS` | d28 / s340 / m0.9 | Sheet exit |
| `BOTTOM_SHEET_SPRING_REBOUND` | d22 / s280 / m0.85 | Cancelled drag |
| Backdrop fade | 260ms timing | Parallel with spring |

**Interactions:** swipe-down dismiss (full sheet when not scrolling), backdrop tap, centered drag handle.

**Never:** `document.body.overflow = hidden` — use Modal overlay + `restoreWebDocumentScrollLock()` on unmount.

### Standard overlays (list menus)

`BottomOverlayShell` uses `animationType="fade"` — migrate to `BottomActionSheet` spring when polishing.

---

## Component map

| Pattern | Component | Doc |
|---------|-----------|-----|
| Native action sheet (grid) | `BottomActionSheet` | [`BOTTOM-ACTION-SHEET-STANDARD.md`](./BOTTOM-ACTION-SHEET-STANDARD.md) |
| Simple list menu | `BottomOverlayShell` | [`OVERLAY-SAFE-AREA.md`](./OVERLAY-SAFE-AREA.md) |
| Centered modal | `CenterOverlayShell` | [`OVERLAY-SAFE-AREA.md`](./OVERLAY-SAFE-AREA.md) |
| Action tiles | `ActionSheetTile` + `ActionSheetPriorityGrid` | [`BOTTOM-ACTION-SHEET-STANDARD.md`](./BOTTOM-ACTION-SHEET-STANDARD.md) |
| Safari sheet layout | `useBottomActionSheetLayout` | Sheet-scoped only (BUG-002) |
| Feed scroll shell | `webTabSceneContainerStyle` + bounded scroll | [`FEED-POST-INTERACTION-PATTERN.md`](./FEED-POST-INTERACTION-PATTERN.md) |

---

## Overflow menu (⋯)

- Component: `MenuIconButton`
- Default label: `"More options"` → feed posts: **`"Open post actions"`**
- Min touch target: `touchTarget` (44px)

---

## Verification gates

```bash
node scripts/verify-post-interaction.mjs --url https://frennix.vercel.app
node scripts/verify-safari-feed-fix.mjs --url https://frennix.vercel.app
node scripts/verify-calendar-viewport.mjs --url https://frennix.vercel.app
npm run verify:sheet-safe-area
```

Plus **physical iPhone Safari** sign-off per release.

---

## Migration backlog

| From | To | Status |
|------|-----|--------|
| `EntityActionSheet` + `BottomOverlayShell` | `BottomActionSheet` | Phase B |
| Reaction bar **＋** → post sheet | **＋** → Quick Log Workout | Phase C (planned) |
| Caption tap → sheet | Tap → post detail; **⋯** only for sheet | Polish pass |

---

## Related

- [`FEED-POST-INTERACTION-PATTERN.md`](./FEED-POST-INTERACTION-PATTERN.md) — feed post behavior
- [`BOTTOM-ACTION-SHEET-STANDARD.md`](./BOTTOM-ACTION-SHEET-STANDARD.md) — action sheet spec
- [`OVERLAY-SAFE-AREA.md`](./OVERLAY-SAFE-AREA.md) — Safari toolbar / home indicator
- [`RELEASE_PROCESS.md`](./RELEASE_PROCESS.md) — Rule 13 physical device QA
