# Frennix Permanent Development Standards

**Status:** Permanent — applies to all engineers and AI agents  
**Last updated:** July 5, 2026  
**Owner:** Founder + Engineering  
**Enforcement:** `features/releases/RELEASE_PROCESS.md` Rules 12–14

---

## Product alignment

Read [`features/PRODUCT_VISION.md`](features/PRODUCT_VISION.md) before any feature work.

**Litmus test:** *"Does this make it easier or more motivating for someone to stay consistent with their fitness journey?"*

Frennix is a **fitness platform**, not a generic social media app.

---

## Development priority order (Founder-approved)

Work in this order. **Do not start major new features until prior tiers are stable on a physical iPhone.**

| Priority | Focus |
|----------|-------|
| **1 — Stabilize** | Eliminate freezes, lag, viewport issues, scrolling bugs, rendering problems, Safari regressions |
| **2 — Performance** | Fast, responsive app-wide; measure baselines; fix N+1 queries and jank |
| **3 — Polish** | Premium native iPhone UX — animations, haptics, consistent design language |
| **4 — Features** | New capabilities only after stability and polish are verified on device |

---

## Documentation standards

| Rule | Detail |
|------|--------|
| **Major features** | Update `HANDOFF.md`, `ROADMAP.md`, and feature-specific docs before marking complete |
| **Releases** | Update `features/releases/RELEASE.md`, bug list, CHANGELOG, `whats-new.ts` on ship |
| **New UI** | Update `DESIGN_SYSTEM.md` or `features/releases/FRENNIX-DESIGN-SYSTEM.md` when adding patterns |
| **Bugs** | Log in active `vX.Y.Z-BUG-LIST.md` **before** fixing; classify P0–P3 first |
| **Postmortems** | Required for every production user-reported bug before Close |

---

## Physical device QA (mandatory)

**Rule 13** (`RELEASE_PROCESS.md`): No new UI component, overlay, or interaction is **complete** until tested on a **physical iPhone in Safari** (and native app when applicable).

Simulator and automated checks alone are **insufficient** for closing bugs or shipping UI.

**Bugs cannot be closed** until Founder confirms on physical iPhone Safari (current: BUG-002, BUG-003, BUG-004).

---

## Design system compliance (mandatory)

**Rule 14** (`RELEASE_PROCESS.md`): All bottom sheets, modals, menus, and interactions must follow:

- [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) — root design reference
- [`features/releases/FRENNIX-DESIGN-SYSTEM.md`](features/releases/FRENNIX-DESIGN-SYSTEM.md) — overlay tokens
- [`features/releases/BOTTOM-ACTION-SHEET-STANDARD.md`](features/releases/BOTTOM-ACTION-SHEET-STANDARD.md) — action sheets
- [`features/releases/OVERLAY-SAFE-AREA.md`](features/releases/OVERLAY-SAFE-AREA.md) — 28px safe margin

### Required consistency

| Property | Standard |
|----------|----------|
| Spacing | `spacing.*` tokens from `packages/ui/src/theme.ts` |
| Typography | `typography.*` tokens — no one-off font sizes |
| Corner radius | `radius.*` tokens; sheet top ~24px |
| Colors | `colors.*` and `overlays.*` — dark theme only |
| Animation | Spring physics for sheets; 200ms navigation fade |
| Safe area | 28px above Safari toolbar / home indicator |
| Components | `BottomActionSheet`, `MenuIconButton`, `ActionSheetTile` — no one-off overlays |

**Avoid one-off UI implementations** whenever a shared component exists.

---

## Release & deploy standards

| Rule | Detail |
|------|--------|
| Classify bugs before work | P0–P3 per `BUG-SEVERITY.md` |
| Migrations before client | `supabase db push` before app deploy needing schema |
| Build web locally | `pnpm build:web`; commit `dist/` for Vercel |
| Deploy to `frennix` project | `npx vercel deploy --prod --yes --project frennix` |
| Critical User Flows | All 43 flows before production deploy |
| Founder approval | Commits, tags, pushes, deploys require explicit approval |
| No features in bug releases | Use `FUTURE-IDEAS.md` for out-of-scope work |

---

## Code standards (summary)

| Area | Convention |
|------|------------|
| State | TanStack Query 5 (server); React Context (auth, badges) |
| Entity menus | `*-actions.ts` + `use*Actions.tsx` + shared sheet |
| Caches | `*-cache.ts` helpers for query invalidation |
| Errors | Friendly messages only — no raw Supabase codes |
| Icons | Lucide SVG only (not font icons) |
| Web feed scroll | `WebFeedScrollList` — not RN Web FlatList |
| Safari layout | `webTabSceneContainerStyle` + bounded scroll child |

Full detail: `HANDOFF.md` §9.

---

## Never change without Founder approval

| Item | Reason |
|------|--------|
| Production deploy / git push / release tag | Release workflow |
| Closing BUG-002, BUG-003, BUG-004 | Awaiting device QA |
| `OverlaySafeAreaProvider` app-wide | Black screen regression |
| `document.body.overflow = hidden` from sheets | BUG-004 freeze |
| `touchAction: none` on feed for interaction sheets | Pointer freeze |
| `body { overflow: hidden }` in web-document-styles | Intentional feed shell |
| Feature scope outside active release | Scope creep |
| New architecture / parallel systems | Product building mode — extend existing |

---

## Verification before merge/deploy

```bash
pnpm typecheck
pnpm build:web                                    # if web changes
npm run verify:sheet-safe-area
node scripts/verify-post-interaction.mjs --url https://frennix.vercel.app
node scripts/verify-safari-feed-fix.mjs --url https://frennix.vercel.app
node scripts/verify-calendar-viewport.mjs --url https://frennix.vercel.app
npx tsx scripts/verify-release-gates.ts --release features/releases/RELEASE-vX.Y.Z.md --phase production
```

Plus physical iPhone Safari sign-off for all UI changes.

---

## Related documents

| Document | Purpose |
|----------|---------|
| `HANDOFF.md` | Complete agent handoff |
| `DESIGN_SYSTEM.md` | UI/UX standards |
| `ROADMAP.md` | Product roadmap |
| `features/releases/RELEASE_PROCESS.md` | Seven-phase release SOP |
| `features/PRODUCT_VISION.md` | Mission and alignment |
