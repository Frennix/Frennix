# Bottom Action Sheet — Frennix Design Standard

**Status:** Permanent — template for all post/social action sheets  
**Reference implementation:** `PostInteractionSheet` → `BottomActionSheet`  
**Safe area:** [`OVERLAY-SAFE-AREA.md`](./OVERLAY-SAFE-AREA.md) (BUG-002 toolbar lift)

> Before shipping any overlay, ask: *Would this feel at home in Instagram, Threads, or Apple Fitness?*

---

## Stack (required)

| Layer | Component | Responsibility |
|-------|-----------|----------------|
| Shell | `BottomActionSheet` | Spring open/dismiss, swipe-down, Safari safe-area, `fitToContent` |
| Layout | `ActionSheetPriorityGrid` or `ActionSheetGrid` | 2-column action layout |
| Tile | `ActionSheetTile` | `primary` / `secondary` / `standard` variants |
| Safari layout | `useBottomActionSheetLayout` | Visual viewport pin + toolbar reserve (sheet-scoped only) |

```tsx
import { BottomActionSheet } from "@/components/BottomActionSheet";
import { ActionSheetPriorityGrid, ActionSheetTile } from "@/components/ActionSheetGrid";

<BottomActionSheet visible={visible} onClose={onClose} fitToContent dismissRef={dismissRef}>
  <ActionSheetPriorityGrid
    primaryRow={[like, reply]}
    secondaryRow={[reaction, more]}
    renderItem={(action, tier) => (
      <ActionSheetTile variant={tier} emoji={action.emoji} label={action.label} onPress={...} />
    )}
  />
</BottomActionSheet>
```

---

## Motion

| Constant | Value | Use |
|----------|-------|-----|
| `BOTTOM_SHEET_SPRING_OPEN` | damping 24, stiffness 310, mass 0.92 | Sheet enter |
| `BOTTOM_SHEET_SPRING_DISMISS` | damping 28, stiffness 340, mass 0.9 | Sheet exit |
| `BOTTOM_SHEET_SPRING_REBOUND` | damping 22, stiffness 280, mass 0.85 | Cancelled drag |

- Fade backdrop in ~260ms parallel with spring slide-up.
- Dismiss via backdrop, close button, or swipe-down (full sheet when not scrolling).
- **Never** set `document.body.overflow = hidden` — use Modal overlay + `restoreWebDocumentScrollLock()` on unmount.

---

## Layout rules

### Four core actions (no scroll)

**Primary row (larger tiles):** Like · Reply  
**Secondary row (smaller tiles):** Strong Work · More

Use `partitionPrimaryActions()` + `ActionSheetPriorityGrid`.

### Expanded actions (scroll only when needed)

When primary tiles exceed **6** (`ACTION_SHEET_GRID_SCROLL_THRESHOLD`), switch to `ActionSheetGrid` with `scrollEnabled` on the shell.

Future actions (Save, Share, Report, Copy Link, Hide, Mute) append to the grid — scrolling activates automatically.

### Content sizing

- `fitToContent={true}` for standard action sets — sheet hugs content, no dead space.
- `expanded={true}` + max height cap only for long More panels.

---

## Visual tokens

| Token | Value |
|-------|-------|
| Sheet top radius | `radius.lg + 8` (~20px) |
| Drag handle | 36×4px, centered |
| Primary tile height | 92px |
| Secondary tile height | 76px |
| Grid gap | `spacing.sm` |
| Horizontal padding | `spacing.md` |
| Primary tile surface | `rgba(255,255,255,0.06)` border |
| Secondary tile surface | `colors.surfaceElevated` |

---

## Safari / feed integration

- Sheet layout hook active **only while `visible`** — never app-wide.
- Do **not** apply `touchAction: none` to the feed for interaction sheets — Modal blocks touches; hard lock is for story viewer only.
- Feed wrapper: flex-fill container + bounded scroll child (BUG-003 / BUG-004 pattern).

---

## Migration path

| Current | Target |
|---------|--------|
| `EntityActionSheet` + `BottomOverlayShell` | Migrate to `BottomActionSheet` + list or grid rows |
| `PostInteractionSheet` | Canonical reference — do not fork shell logic |
| Reaction bar `＋` | **Phase A:** removed. **Phase C:** Quick Log Workout (Founder decision) |
| Header `⋯` | **Phase A (feed):** opens `PostInteractionSheet` on all posts with `onInteractPress` |

**Design system:** [`FRENNIX-DESIGN-SYSTEM.md`](./FRENNIX-DESIGN-SYSTEM.md) · **Feed pattern:** [`FEED-POST-INTERACTION-PATTERN.md`](./FEED-POST-INTERACTION-PATTERN.md)

---

## Verification gates

```bash
node scripts/verify-post-interaction.mjs --url https://frennix.vercel.app
node scripts/verify-safari-feed-fix.mjs --url https://frennix.vercel.app
node scripts/verify-calendar-viewport.mjs --url https://frennix.vercel.app
```

Manual: iPhone Safari — toolbar expanded/collapsed, post-dismiss feed scroll + tap.
