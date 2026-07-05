# Frennix Bug Tracker

**Status:** Permanent living document — update on every bug open, fix, verify, or close  
**Owner:** Engineering + Founder  
**Release-scoped lists:** [`v1.0.3-BUG-LIST.md`](./v1.0.3-BUG-LIST.md) · [`RELEASE.md`](./RELEASE.md)

> Log bugs in the active release bug list **first**, then mirror here. Root causes and verification notes help future agents avoid regressions.

---

## Status legend

| Status | Meaning |
|--------|---------|
| **Open** | Reproduced; not yet fixed |
| **In Progress** | Fix in development or deployed pending verification |
| **Fixed** | Code merged/deployed; awaiting physical device QA |
| **Verified** | Founder physical iPhone Safari (or applicable platform) confirmed |

---

## Open bugs

### BUG-002 — Post interaction sheet clipped on iPhone Safari

| Field | Value |
|-------|-------|
| **Title** | Bottom action sheet cut off — buttons hidden behind Safari toolbar |
| **Status** | Fixed — awaiting Founder physical iPhone verification |
| **Severity** | P1 |
| **Root cause** | Fragmented Safari viewport math across hooks; hard-coded toolbar floors (`72px`, `32px` extra lift) instead of measured `visualViewport` + `env(safe-area-inset-bottom)` + 28px design margin. Overlay height and sheet inset computed inconsistently. |
| **Files changed** | `lib/safari-visual-viewport.ts` (new), `lib/use-bottom-action-sheet-layout.ts`, `lib/use-sheet-safe-area.ts`, `components/BottomActionSheet.tsx` |
| **Test steps** | Feed → tap **⋯** on any post → verify Like, Reply, Strong Work, More fully visible and tappable with Safari toolbar expanded and collapsed |
| **Date tested** | — |
| **Physical iPhone verification** | ⬜ Pending Founder sign-off |
| **Production deployment** | ⬜ Local build verified; deploy pending Founder approval |
| **Notes for future agents** | Do not add hard-coded Safari toolbar floors. Use `lib/safari-visual-viewport.ts`. All bottom sheets must use `BottomActionSheet` + shared inset. |

---

### BUG-003 — Training Calendar half blocked on iPhone Safari

| Field | Value |
|-------|-------|
| **Title** | Calendar tab viewport height / dead scroll band |
| **Status** | Open |
| **Severity** | P2 |
| **Root cause** | Safari tab scene height desync (same family as BUG-004). Calendar uses `screen-shell` wrappers; may improve automatically from shared viewport module — verify on device after BUG-002/004 fix. |
| **Files changed** | TBD if still failing after shared viewport rollout |
| **Test steps** | Calendar tab → scroll full page → no dead band; Today's Focus and month grid fully usable |
| **Date tested** | — |
| **Physical iPhone verification** | ⬜ |
| **Production deployment** | — |
| **Notes for future agents** | Apply same `webTabSceneContainerStyle` + bounded scroll child pattern as feed. Do not triple-apply fixed heights. |

---

### BUG-004 — Feed freeze / black band after post interaction sheet dismiss

| Field | Value |
|-------|-------|
| **Title** | Feed black dead band and/or frozen after closing interaction sheet |
| **Status** | Fixed — awaiting Founder physical iPhone verification |
| **Severity** | P1 |
| **Root cause** | Feed scroll coupled to `interactionVisible` via `overflow: hidden` soft lock while Modal already blocks touches; stale `useWebTabSceneHeight` after overlay close without remeasure. Duplicate `webContainerStyle` on feed wrappers amplified Safari flex bugs. |
| **Files changed** | `app/(tabs)/index.tsx`, `components/WebFeedScrollList.tsx`, `lib/web-tab-scene-layout.ts`, `lib/safari-visual-viewport.ts`, `components/BottomActionSheet.tsx` |
| **Test steps** | Open sheet → dismiss (✕, backdrop, swipe) → feed scrolls and taps work; repeat 5×; no black band below posts |
| **Date tested** | — |
| **Physical iPhone verification** | ⬜ Pending Founder sign-off |
| **Production deployment** | ⬜ Local build verified; deploy pending Founder approval |
| **Notes for future agents** | Never set `touchLock={interactionVisible}` on feed. Never `overflow: hidden` on feed for interaction sheets — Modal only. Story viewer alone uses hard `touchLock`. Call `requestSafariVisualViewportRemeasure()` on sheet dismiss. |

---

## Verified / closed bugs

### BUG-001 — Workout/photo/video sharing fails (P0)

| Field | Value |
|-------|-------|
| **Status** | Verified |
| **Fixed in** | v1.0.2 |
| **Root cause** | Missing `event_type` column; legacy post activity trigger |
| **Postmortem** | [`postmortems/BUG-001-POSTMORTEM.md`](./postmortems/BUG-001-POSTMORTEM.md) |

---

## Known issues (no BUG-ID)

| Title | Severity | Status | Notes |
|-------|----------|--------|-------|
| Events RSVP confirmation lag | P2 | temporary_issue | RSVP saves; UI may lag — investigate if CAL-05 fails |
| Training Together Today | P3 | coming_soon | UI shell; data v1.1 |
| Story Replies | P3 | coming_soon | Planned |

---

## How to add a bug

1. Assign ID in active `vX.Y.Z-BUG-LIST.md` and `RELEASE.md`
2. Add row to **Open bugs** above with all fields
3. Classify P0–P3 per [`BUG-SEVERITY.md`](./BUG-SEVERITY.md) before coding
4. On fix → update **Files changed**, set **Fixed**
5. On Founder device QA → set **Verified**, fill **Date tested**
6. On close → move to **Verified / closed**; postmortem if production user bug
