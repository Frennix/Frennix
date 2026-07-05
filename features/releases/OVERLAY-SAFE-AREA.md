# Overlay Safe Area — Permanent Design Rule

**Status:** Permanent — applies to **every** bottom sheet, modal, drawer, and action menu  
**Owner:** Engineering + Design  
**Introduced:** v1.0.3 (BUG-002 class)

> **Never position overlay content flush against the bottom edge.**  
> Always leave comfortable spacing between the last interactive element and the screen bottom — above `env(safe-area-inset-bottom)` and above the iOS Safari toolbar.

---

## The rule

| Requirement | Detail |
|-------------|--------|
| **Safety margin** | **28px** (`OVERLAY_BOTTOM_SAFETY_MARGIN_PX`) above safe area — always |
| **Safe area** | Respect `env(safe-area-inset-bottom)` on iOS Safari and native home indicator |
| **Safari toolbar** | Sheet must sit **above** dynamic bottom toolbar (expanded and collapsed) |
| **Last action row** | Reply, More, Cancel, and all primary buttons fully visible and tappable |
| **Keyboard** | Overlay repositions when keyboard opens — no clipped actions |
| **Breathing room** | Design for comfort, not edge-to-edge flush positioning |

---

## Implementation (required)

### Bottom sheets & action menus

Use **`BottomOverlayShell`** — do not hand-roll `Modal` + `justifyContent: "flex-end"` without safe area:

```tsx
import { BottomOverlayShell } from "@/components/BottomOverlayShell";

<BottomOverlayShell visible={visible} onClose={onClose}>
  {/* sheet content */}
</BottomOverlayShell>
```

`BottomOverlayShell` wires:
- `useSheetSafeArea()` — visual viewport tracking, Safari toolbar lift, 28px margin
- `webOverlayStyle` — pins overlay to visible viewport on web
- `sheetMarginBottom` — lifts sheet above browser chrome
- `contentBottomPadding` — internal cushion below scroll content

### Native-style action sheets (spring animation, swipe-to-dismiss)

Use **`BottomActionSheet`** for polished iOS-style action menus (post actions, future Save/Report grids):

```tsx
import { BottomActionSheet } from "@/components/BottomActionSheet";
import { ActionSheetGrid, ActionSheetPriorityGrid, ActionSheetTile } from "@/components/ActionSheetGrid";

<BottomActionSheet visible={visible} onClose={onClose} fitToContent scrollEnabled={needsScroll}>
  <ActionSheetPriorityGrid
    primaryRow={[like, reply]}
    secondaryRow={[reaction, more]}
    renderItem={(action, tier) => (
      <ActionSheetTile variant={tier} emoji={action.emoji} label={action.label} onPress={...} />
    )}
  />
</BottomActionSheet>
```

`BottomActionSheet` wires `useBottomActionSheetLayout()` — visual viewport pinning, Safari toolbar lift (BUG-002), **content-sized height** (`fitToContent`), spring animation, centered drag handle, swipe-down dismiss.

#### Founder design standard (action sheets)

Full spec: [`BOTTOM-ACTION-SHEET-STANDARD.md`](./BOTTOM-ACTION-SHEET-STANDARD.md)

Every Frennix bottom action sheet must feel at home in Instagram, Threads, or Apple Fitness:

| Principle | Implementation |
|-----------|----------------|
| **No scroll for core actions** | `ActionSheetPriorityGrid` — emphasized Like/Reply row, secondary row below |
| **Content-sized sheet** | `fitToContent={true}` — no empty space below buttons |
| **Equal spacing & sizing** | `ActionSheetTile` variants (`primary` / `secondary` / `standard`) |
| **Scroll only when needed** | Enable when actions exceed `ACTION_SHEET_GRID_SCROLL_THRESHOLD` (6) |
| **Safari-safe** | Never regress BUG-002 toolbar lift or home-indicator spacing |

Before shipping any overlay, ask: *Would this feel at home in a top-tier social app?* If not, refine until it does.

### Custom overlays (other animations, gestures)

If neither shell fits, **must** call `useSheetSafeArea(expanded, visible)` or `useBottomActionSheetLayout(visible)` directly and apply:

| Property | Where |
|----------|-------|
| `webOverlayStyle` | Overlay root (`position: fixed` to visual viewport) |
| `sheetMarginBottom` | Sheet container `marginBottom` |
| `contentBottomPadding` | Inside sheet below last interactive row |

### Centered modals

Use **`CenterOverlayShell`**:

```tsx
import { CenterOverlayShell } from "@/components/BottomOverlayShell";

<CenterOverlayShell visible={visible} onClose={onClose} contentStyle={styles.sheet}>
  {children}
</CenterOverlayShell>
```

### App-wide provider (`@frennix/ui` overlays)

`OverlaySafeAreaProvider` in `app/_layout.tsx` supplies live safe-area values to **`useOverlaySafeArea()`** in `@frennix/ui` (e.g. `ReactionPicker` in feed/messages).

### Shared UI (`@frennix/ui`)

- Constant: `OVERLAY_BOTTOM_SAFETY_MARGIN_PX` in `packages/ui/src/theme.ts`
- Context: `OverlaySafeAreaContext` + `useOverlaySafeArea()` — used by `ReactionPicker`

---

## Constants

| Symbol | Value | Location |
|--------|-------|----------|
| `OVERLAY_BOTTOM_SAFETY_MARGIN_PX` | **28** | `lib/use-sheet-safe-area.ts`, `packages/ui/src/theme.ts` |
| `SHEET_BREATHING_ROOM_PX` | 28 (alias) | `lib/use-sheet-safe-area.ts` |

---

## Components using this rule

| Component | Pattern |
|-----------|---------|
| `PostInteractionSheet` | `BottomActionSheet` + `useBottomActionSheetLayout` (Safari toolbar lift) |
| `EntityActionSheet` | `BottomOverlayShell` |
| `ReportReasonSheet` | `BottomOverlayShell` |
| `EntityListSheet` | `BottomOverlayShell` |
| `ContentModerationSheet` | `BottomOverlayShell` |
| `SharePostSheet` | `BottomOverlayShell` |
| `ShareChallengeSheet` | `BottomOverlayShell` |
| `WorkoutSavedSheet` | `BottomOverlayShell` |
| `TrainerFilterSheet` | `BottomOverlayShell` |
| `StoryViewersModal` | `BottomOverlayShell` |
| `StoryReactionsModal` | `BottomOverlayShell` |
| `StoryQuestionAnswersModal` | `BottomOverlayShell` |
| `StoryAnalyticsModal` | `CenterOverlayShell` |
| `TrainingMatchModal` | `CenterOverlayShell` |
| `FrennixMatchExplainerModal` | `CenterOverlayShell` |
| `CommentEditSheet` | `CenterOverlayShell` |
| `WhatsNewLaunchPrompt` | `CenterOverlayShell` |
| `ImageLightbox` | `useOverlaySafeArea` (fullscreen) |
| `WorkoutStoryViewer` | `useSheetSafeArea` (fullscreen story footer) |
| `FounderSidebar` (mobile drawer) | `useOverlaySafeArea` |
| `ReactionPicker` | `useOverlaySafeArea` via provider |

**New overlays:** Add to this table when created. Do not ship without safe area wiring.

---

## QA & release gates

| Gate | Command / doc |
|------|----------------|
| Automated static checks | `npm run verify:sheet-safe-area` (10 checks — all overlays audited) |
| Manual overlay QA | [`checklists/OVERLAY-MODAL-QA.md`](./checklists/OVERLAY-MODAL-QA.md) |
| BUG-002 (reference) | [`v1.0.3-BUG-LIST.md`](./v1.0.3-BUG-LIST.md) — not closed until Founder confirms |

### Mandatory manual checks (iPhone Safari)

- Toolbar **expanded** and **collapsed**
- Portrait and **landscape**
- **Keyboard open** (when overlay has text input)
- Smallest supported iPhone screen

---

## Related

- [`BUG-SEVERITY.md`](./BUG-SEVERITY.md) — classify overlay bugs before fixing
- [`RELEASE_PROCESS.md`](./RELEASE_PROCESS.md) — overlay QA blocks deploy
- [`checklists/OVERLAY-MODAL-QA.md`](./checklists/OVERLAY-MODAL-QA.md)
