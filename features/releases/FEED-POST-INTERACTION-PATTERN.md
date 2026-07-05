# Feed Post Interaction Pattern

**Status:** Permanent standard (Phase A deployed)  
**Reference:** `FeedPostCard` → `PostInteractionSheet` → `BottomActionSheet`  
**Design system:** [`FRENNIX-DESIGN-SYSTEM.md`](./FRENNIX-DESIGN-SYSTEM.md)

---

## Goal

Every feed post behaves consistently: social actions via a native bottom sheet; fitness-specific quick actions via a dedicated affordance; no feed freeze or layout regression after overlays close.

---

## Current pattern (Phase A — live)

### Triggers

| User action | Result |
|-------------|--------|
| Tap **⋯** (header, all posts) | Opens `PostInteractionSheet` |
| Tap caption / media | Opens sheet (secondary — remove in polish pass) |
| Tap post author | Profile |
| Tap comment preview | Post detail / comments |

### Not used on feed

| Removed | Future |
|---------|--------|
| **＋** on reaction bar | **Quick Log Workout** (Phase C) — reinforces fitness identity |

### Sheet content (primary panel)

**Primary row:** Like · Reply  
**Secondary row:** Strong Work · More  

- Content-sized (`fitToContent`) — no scroll for 4 actions
- More panel → extended fitness / save / share actions (scroll when needed)

### Feed behavior while sheet open

- `scrollEnabled={false}` on feed scroll (soft lock — no `touchAction: none`)
- Modal blocks background interaction
- On dismiss: `restoreWebDocumentScrollLock()`, no lingering modals, feed scroll + tap restored

### Layout

- Feed wrapper: `webTabSceneContainerStyle()` (flex-fill)
- Scroll list only: `webTabSceneHeightStyle()` (bounded height)
- Prevents black dead band (BUG-004)

---

## Target pattern (phases B–C)

```
┌─────────────────────────────────────┐
│  Avatar  Name · @user · meta    ⋯  │  ← ⋯ → PostInteractionSheet (only)
├─────────────────────────────────────┤
│  Caption (tap → post detail)        │
│  Media (tap → lightbox)             │
├─────────────────────────────────────┤
│  Reaction chips (tap → react)       │
│  [＋ Quick Log]  ← Phase C only     │
├─────────────────────────────────────┤
│  Comments preview                   │
└─────────────────────────────────────┘
```

### Phase B — merge moderation/owner actions

- Move Report, Delete, Copy Link, Block from `EntityActionSheet` into sheet **More** panel
- Retire separate `EntityActionSheet` on feed
- Single **⋯** trigger for all post actions

### Phase C — Quick Log Workout (**＋**)

**Founder decision:** **＋** = **Quick Log Workout** (not generic social actions).

| Behavior | Detail |
|----------|--------|
| Placement | Reaction bar, right of reaction chips |
| Action | Opens lightweight log flow (duration, type, optional link to post) |
| Rationale | Frennix = fitness platform; **＋** = do something athletic, not “more menu” |

Implementation deferred until Quick Log UX is designed.

---

## Consistency across screens

| Screen | Card | ⋯ behavior | Status |
|--------|------|------------|--------|
| Feed (`index.tsx`) | `FeedPostCard` | → `PostInteractionSheet` | **Phase A ✓** |
| Post detail | `PostCard` | → `EntityActionSheet` | Migrate Phase B |
| Profile grid | `PostGrid` | → `EntityActionSheet` (own posts) | Migrate Phase B |
| Saved posts | `FeedPostCard` | Same as feed when wired | Align |
| Group / event / challenge feeds | `FeedPostCard` | Same as feed when wired | Align |

**Rule:** Any screen showing `FeedPostCard` with `onInteractPress` follows this document.

---

## Acceptance (every release touching feed or sheet)

- [ ] **⋯** opens interaction sheet on feed
- [ ] No **＋** on reaction bar (until Phase C Quick Log)
- [ ] Four primary actions visible without scroll
- [ ] No Safari toolbar / home indicator clipping
- [ ] Feed scrollable + tappable after dismiss
- [ ] No black dead space below posts
- [ ] Physical iPhone Safari verified (Founder)

---

## Verification

```bash
node scripts/verify-post-interaction.mjs --url https://frennix.vercel.app
node scripts/verify-safari-feed-fix.mjs --url https://frennix.vercel.app
```
