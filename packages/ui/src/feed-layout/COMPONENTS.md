# Feed Layout Components

**Purpose:** Developer reference for `@frennix/ui` feed-layout modules.  
**When in doubt:** use these instead of building feed-specific layout or media in app screens.

**Related:** [`FEED_DESIGN_SYSTEM.md`](../../../FEED_DESIGN_SYSTEM.md) · [`PERFORMANCE.md`](../../../PERFORMANCE.md)

---

## Quick decision guide

| I need to… | Use this | Do not use |
|------------|----------|------------|
| Render a feed post | `FeedPostCard` | Custom card layout in `app/` |
| Show post photos/videos | `FeedMedia` | `PostMediaCarousel` directly on feed |
| Standard post spacing/sections | `FeedLayout.*` slots | Hard-coded `paddingHorizontal` |
| Inline Like / Strong Work / etc. | `FeedPostActionBar` | Custom icon row |
| Sponsored / premium / affiliate UI (future) | `FeedPostCard` `slots` prop | Fork `FeedPostCard` layout |
| Change feed spacing globally | `feedLayout` tokens | Edit individual components |
| Change media crop/fit policy | `feedMediaRules` | Per-screen `contentFit` |

---

## Components

### `FeedLayout`

**Purpose:** Section shell for every feed post — applies shared padding, width, and vertical rhythm.

**Slots:** `Root`, `Header`, `HeaderText`, `Media`, `Actions`, `Caption`, `Engagement`, `Comments`, plus extension slots (`Label`, `HeaderTrailing`, `BelowMedia`, `Commerce`, `Footer`, `MediaOverlay`).

**When to use:** Any feed post composer. Wrap all post content in `FeedLayout.Root` and place content in ordered slots.

**When not to use:** Post detail (`PostCard`), profile grid, messaging — different layout contexts.

**Accessibility:** Slots are layout containers; interactive children must expose their own labels.

---

### `FeedMedia`

**Purpose:** **Canonical feed media mount** — edge-to-edge shell + deferred loading + aspect-preserving carousel/video.

**When to use:** Every feed post with photos or videos (workout, transformation, race result, sponsored, etc.).

**When not to use:** Inline/detail contexts — use `PostMedia` with `layout="inline"`. Messaging attachments — use `MessageBubble`.

**Props of note:**
- `visible` — defer heavy decode until row is near viewport
- `embedded` — inset shared-post preview
- `overlay` — premium gate, ad marker (extension point)

**Performance:** Delegates to `FeedMediaSlot` (IntersectionObserver on web). Required for 60 FPS scroll with hundreds of posts.

**Accessibility:** Media tap targets inherit from `PostMedia` / `FeedVideoPlayer` (“Post photo”, “Open video full screen”).

---

### `FeedMediaSlot`

**Purpose:** Low-level deferral layer — skeleton until row is near viewport, then mounts `PostMediaCarousel`.

**When to use:** Only inside `FeedMedia`. App code should not import this directly.

**Performance:** Prevents mounting off-screen carousels/videos — critical for long feeds.

---

### `FeedPostActionBar`

**Purpose:** Inline post actions — Like, Strong Work, Comment, Share, More.

**When to use:** Every standard feed post below media.

**When not to use:** Post detail screen (uses `PostCard` actions). Sheets — use `PostInteractionSheet`.

**Accessibility:**
- 44×44pt minimum touch targets (`touchTarget`)
- VoiceOver labels + hints per action
- `accessibilityState.selected` for Like / Strong Work
- Toolbar role on container
- Dynamic Type capped at `FEED_FONT_SCALE_MAX` (1.35)

---

### `FeedPostCard`

**Purpose:** Reference feed post composer — maps `Post` API data to `FeedLayout` + handlers.

**When to use:** Main feed, group/challenge/event feeds when wired through `FeedListItem`.

**Extension:** Optional `slots?: FeedPostLayoutSlots` for monetization without layout fork.

**Performance:** Wrapped in `memo`. Pass stable callbacks from `FeedListItem`.

---

### `FeedPostCardSkeleton`

**Purpose:** Loading placeholder matching `FeedLayout` structure.

**When to use:** Feed initial load, pagination skeleton rows.

---

### `FeedLayoutSlots` (`Label`, `HeaderTrailing`, …)

**Purpose:** Optional extension wrappers for future sponsored, premium, affiliate, and event UI.

**When to use:** Via `FeedPostCard` `slots` prop when feature ships.

**Behavior:** Renders nothing when children are absent — zero cost for standard posts.

---

## Token modules

### `feedLayout` / `feedLayoutTypography` / `feedLayoutStyles`

**Purpose:** Single source of spacing, typography, and StyleSheet for all feed sections.

**Light mode (future):** Colors come from `theme.ts` `colors` — swap palette there; feed tokens inherit automatically.

---

### `feedMediaRules`

**Purpose:** Media policy constants — no auto-crop, preserve aspect ratio, defer rules.

**When to change:** Founder-approved media behavior changes only.

---

### `feedLayoutExtensions`

**Purpose:** TypeScript taxonomy for content kinds, monetization kinds, slot hints, and `FeedPostLayoutSlots`.

**When to use:** Planning new post types; mapping API → slot components.

---

### `feedAccessibility`

**Purpose:** Shared a11y constants — `maxFontSizeMultiplier`, `minTouchTarget`.

**When to use:** All feed `Text` and interactive components.

---

## Safe areas

Feed posts do **not** add horizontal safe-area padding (media is edge-to-edge). Safe areas are handled by:

- Tab shell / `webTabSceneContainerStyle`
- `BottomActionSheet` / overlay insets
- Feed list `paddingBottom` for tab bar

Extension slot components that stick to screen edges must use `useSafeAreaInsets()` themselves.

---

## Adding a new feed feature (checklist)

1. Can it fit an existing **slot**? → Add a small component, pass via `slots`.
2. Needs new media behavior? → Extend `FeedMedia` props, not a new carousel.
3. Needs new spacing? → Add token under `feedLayout.extensions`, not inline styles.
4. Add VoiceOver label + 44pt target to any new interactive control.
5. Run `npm run verify:feed-layout`.
