# Feed Post Interaction Pattern

**Status:** Permanent standard (FeedLayout + inline actions)  
**Reference:** `FeedPostCard` → `FeedLayout` → `FeedPostActionBar` → `PostInteractionSheet` → `BottomActionSheet`  
**Design system:** [`FEED_DESIGN_SYSTEM.md`](../../FEED_DESIGN_SYSTEM.md) · [`DESIGN_SYSTEM.md`](../../DESIGN_SYSTEM.md)

---

## Goal

Every feed post behaves consistently: fitness media is shown in full at maximum size; primary social actions are inline under media; extended actions via a native bottom sheet; no feed freeze or layout regression after overlays close.

---

## Current pattern (FeedLayout — live)

### Triggers

| User action | Result |
|-------------|--------|
| Tap **Like / Strong Work / Comment / Share** | Inline handler on `FeedPostCard` |
| Tap **More (⋯)** in action bar | Opens `PostInteractionSheet` |
| Tap **media** | Full-screen lightbox / video viewer |
| Tap **caption** | Post detail |
| Tap post author / @username | Profile |
| Tap comment preview | Post detail / comments |

### Not used on feed

| Removed | Future |
|---------|--------|
| Header **⋯** menu | Actions consolidated in action bar **More** |
| **＋** on reaction bar | **Quick Log Workout** (Phase C) — reinforces fitness identity |
| Caption / media → interaction sheet | Media opens lightbox; caption opens detail |

### Sheet content (More panel)

**Primary row:** Like · Reply  
**Secondary row:** Strong Work · More  

- Content-sized (`fitToContent`) — no scroll for 4 actions
- More panel → extended fitness / save / share / moderation actions (scroll when needed)

### Feed behavior while sheet open

- `scrollEnabled={false}` on feed scroll (soft lock — no `touchAction: none`)
- Modal blocks background interaction
- On dismiss: `restoreWebDocumentScrollLock()`, no lingering modals, feed scroll + tap restored

### Layout (FeedLayout)

```
┌─────────────────────────────────────┐
│  Avatar  Name                       │  ← FeedLayout.Header (compact)
│          @username                  │
│          🏃 Running · 2h            │
├─────────────────────────────────────┤
│         MEDIA (edge-to-edge)        │  ← FeedLayout.Media
├─────────────────────────────────────┤
│  ♡  💪  💬  ↗  ⋯                    │  ← FeedPostActionBar
├─────────────────────────────────────┤
│  Caption                            │  ← FeedLayout.Caption
│  12 likes · reaction summary        │  ← FeedLayout.Engagement
│  Comments preview                   │  ← FeedLayout.Comments
│  Add a comment…                     │
└─────────────────────────────────────┘
```

- Feed wrapper: `webTabSceneContainerStyle()` (flex-fill)
- Scroll list only: `webTabSceneHeightStyle()` (bounded height)
- Prevents black dead band (BUG-004)
- **Media:** full width, original aspect ratio, never auto-cropped

---

## Target pattern (phases B–C)

### Phase B — merge moderation/owner actions

- Move Report, Delete, Copy Link, Block from `EntityActionSheet` into sheet **More** panel
- Retire separate `EntityActionSheet` on feed
- Single **More** trigger for all extended post actions

### Phase C — Quick Log Workout (**＋**)

**Founder decision:** **＋** = **Quick Log Workout** (not generic social actions).

| Behavior | Detail |
|----------|--------|
| Placement | Action bar or reaction row (TBD) |
| Action | Opens lightweight log flow (duration, type, optional link to post) |
| Rationale | Frennix = fitness platform; **＋** = do something athletic, not “more menu” |

Implementation deferred until Quick Log UX is designed.

---

## Consistency across screens

| Screen | Card | Actions | Status |
|--------|------|---------|--------|
| Feed (`index.tsx`) | `FeedPostCard` + `FeedLayout` | Inline + **More** → sheet | **Live ✓** |
| Post detail | `PostCard` | → `EntityActionSheet` | Migrate Phase B |
| Profile grid | `PostGrid` | → `EntityActionSheet` (own posts) | Migrate Phase B |
| Saved posts | `PostCard` | Detail layout | Unchanged |
| Group / event / challenge feeds | `FeedPostCard` | Same as feed when wired | Align |

**Rule:** Any screen showing `FeedPostCard` follows this document and composes `FeedLayout`.

---

## Acceptance (every release touching feed or sheet)

- [ ] Inline action bar visible on every feed post
- [ ] **More** opens interaction sheet on feed
- [ ] Media tap opens lightbox (not sheet)
- [ ] No **＋** on reaction bar (until Phase C Quick Log)
- [ ] Four primary sheet actions visible without scroll
- [ ] No Safari toolbar / home indicator clipping
- [ ] Feed scrollable + tappable after dismiss
- [ ] No black dead space below posts
- [ ] Media preserves original aspect ratio (no auto-crop)
- [ ] Physical iPhone Safari verified (Founder)

---

## Verification

```bash
npm run verify:feed-layout
npm run verify:feed-media
node scripts/verify-post-interaction.mjs --url https://frennix.vercel.app
node scripts/verify-safari-feed-fix.mjs --url https://frennix.vercel.app
```
