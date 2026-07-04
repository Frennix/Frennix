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

### Custom overlays (animations, gestures)

If `BottomOverlayShell` is too rigid (e.g. `PostInteractionSheet` with pan-to-dismiss), **must** call `useSheetSafeArea(expanded, visible)` directly and apply:

| Property | Where |
|----------|-------|
| `webOverlayStyle` | Overlay root (`position: fixed` to visual viewport) |
| `sheetMarginBottom` | Sheet container `marginBottom` |
| `contentBottomPadding` | Inside sheet below last interactive row |

### Centered modals

Use **`useCenterOverlaySafeArea(visible)`** on the backdrop — prevents flush bottom on small viewports:

```tsx
const { backdropStyle } = useCenterOverlaySafeArea(visible);
<Pressable style={[styles.backdrop, ...backdropStyle]}>
```

### Shared UI (`@frennix/ui`)

- Constant: `OVERLAY_BOTTOM_SAFETY_MARGIN_PX` in `packages/ui/src/theme.ts`
- `ReactionPicker` accepts optional `bottomInset` — pass `useSheetSafeArea().sheetMarginBottom` from app on web

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
| `PostInteractionSheet` | `useSheetSafeArea` (custom animation) |
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
| `TrainingMatchModal` | `useCenterOverlaySafeArea` |
| `FrennixMatchExplainerModal` | `useCenterOverlaySafeArea` |
| `CommentEditSheet` | `useCenterOverlaySafeArea` |
| `WhatsNewLaunchPrompt` | `useCenterOverlaySafeArea` |
| `ReactionPicker` | `OVERLAY_BOTTOM_SAFETY_MARGIN_PX` + optional `bottomInset` |

**New overlays:** Add to this table when created. Do not ship without safe area wiring.

---

## QA & release gates

| Gate | Command / doc |
|------|----------------|
| Automated static checks | `npm run verify:sheet-safe-area` |
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
