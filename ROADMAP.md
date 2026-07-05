# Frennix Product Roadmap

**Status:** Official product roadmap  
**Last updated:** July 5, 2026  
**Owner:** Founder  
**Source of truth:** [`features/PRODUCT_VISION.md`](features/PRODUCT_VISION.md)  
**Progress dashboard:** [`features/PROJECT-PROGRESS.md`](features/PROJECT-PROGRESS.md)  
**Release log:** [`features/releases/RELEASE.md`](features/releases/RELEASE.md)  
**Milestone detail:** [`features/PRODUCT-ROADMAP.md`](features/PRODUCT-ROADMAP.md) (P1–P10 phases)

> Frennix is in **product building mode** (approved 2026-07-04). Architecture is mature enough; competitive advantage comes from execution, polish, and a best-in-class fitness experience.

---

## Table of contents

1. [Vision & litmus test](#1-vision--litmus-test)
2. [Version history](#2-version-history)
3. [Current release — v1.0.3](#3-current-release--v103)
4. [Next release — v1.0.4 / v1.1.0](#4-next-release--v104--v110)
5. [Short-term (v1.1–v1.3)](#5-short-term-v11v13)
6. [Medium-term (v1.4–v1.7)](#6-medium-term-v14v17)
7. [Long-term (v2.0+)](#7-long-term-v20)
8. [Feature status matrix](#8-feature-status-matrix)
9. [Feed interaction phases](#9-feed-interaction-phases)
10. [Release gates & approval](#10-release-gates--approval)
11. [Deferred / out of scope](#11-deferred--out-of-scope)

---

## 1. Vision & litmus test

**Mission:** Help people build lasting fitness habits through real human connection.

**Litmus test for every feature:**

> *"Does this make it easier or more motivating for someone to stay consistent with their fitness journey?"*

**We are not:** a dating app, a generic social network, or a content-only feed.  
**We are:** the daily home for people pursuing healthier lives — find training partners, stay connected, log workouts, train together.

**Current product priorities (Founder-approved 2026-07-04):**

1. Polish the **Training Calendar**
2. Make **Stories** the most engaging fitness-first story experience
3. Refine **Workout Invites** and **Favorite Training Partners**
4. Continue improving **Challenges** and **Events**
5. Performance, stability, accessibility, and interaction polish app-wide
6. Daily-use features that reinforce motivation, accountability, and connection

### Development priority order (Founder-approved — July 5, 2026)

**Stabilize → Performance → Polish → Features.** Major new features wait until stability and polish are verified on a physical iPhone.

| Tier | Focus |
|------|-------|
| **1 — Stabilize** | Freezes, lag, viewport, scroll, rendering, Safari regressions (BUG-002/003/004) |
| **2 — Performance** | Feed load, messaging N+1, deferred media, recorded baselines |
| **3 — Polish** | Phase B/C feed interaction, design system migration, haptics, animations |
| **4 — Features** | Training Together Today, Matchmaking GA, Story Replies, Run Clubs |

See [`DEVELOPMENT_STANDARDS.md`](DEVELOPMENT_STANDARDS.md) for permanent enforcement.

---

## 2. Version history

| Version | Date | Status | Highlights |
|---------|------|--------|------------|
| **v0.8.0** | 2026-06-28 | ✅ Released | Messaging Realtime stability; production baseline after v1.0.0 rollback |
| **v1.0.0** | 2026-06-28 | ❌ Rolled back | Matchmaking GA attempt — Safari layout regression |
| **v1.0.1** | 2026-07-04 | ✅ Released | Training Calendar tab, Today's Focus, session CRUD, workout invites, achievements engine |
| **v1.0.2** | 2026-07-04 | ✅ Closed | P0 workout/photo/video sharing fix (BUG-001); friendly error messages |
| **v1.0.3** | TBD | 🔄 **Active** | iPhone Safari overlay fixes (BUG-002/003/004); Phase A feed interaction; design system |
| **v1.0.4** | TBD | Planned | Close v1.0.3 bugs + Phase B feed interaction + physical device QA sign-off |
| **v1.1.0** | TBD | Planned | P2 Messaging polish + Training Together Today data layer + P1 matchmaking GA |

**Production URL:** https://frennix.vercel.app  
**Latest known deploy (Phase A):** `dpl_3aKaPXDnxoccvELGGRwbfDxaptgZ`  
**Bundle:** `index-b58c16d64459ae4d864a05f61b1c4444.js`

---

## 3. Current release — v1.0.3

**Type:** Patch — post–v1.0.2 stabilization  
**Status:** In Progress  
**Target:** Close all open Safari bugs; establish design system; ship Phase A feed interaction

### Shipped in v1.0.3 workstream (deployed, pending Founder device QA)

| Item | Status |
|------|--------|
| `BottomActionSheet` reusable shell | ✅ Deployed |
| `PostInteractionSheet` with priority grid | ✅ Deployed |
| Phase A: **⋯** → interaction sheet; **＋** removed from reaction bar | ✅ Deployed |
| Content-sized sheet (`fitToContent`) — no scroll for 4 actions | ✅ Deployed |
| BUG-004 feed freeze/black band fix (soft scroll lock, layout pattern) | ✅ Deployed (automated PASS) |
| BUG-002 clipping improvement (Safari toolbar lift) | 🔄 Improved — not closed |
| Design system docs (`DESIGN_SYSTEM.md`, `FRENNIX-DESIGN-SYSTEM.md`) | ✅ Written |
| Feed interaction pattern doc | ✅ Written |
| Release process Rule 13 (physical device QA) + Rule 14 (design system) | ✅ Added |

### Open bugs (block v1.0.3 close)

| ID | Severity | Summary | Status |
|----|----------|---------|--------|
| BUG-002 | P1 | Post interaction sheet clipped on iPhone Safari | In Progress — improved, awaiting Founder confirmation |
| BUG-003 | P2 | Training Calendar half blocked on iPhone Safari | In Progress |
| BUG-004 | P1 | Feed black band/freeze after sheet dismiss | In Progress — fix deployed, awaiting Founder confirmation |

### QA gates (all ⬜)

- [ ] 43 Critical User Flows (`checklists/CRITICAL-USER-FLOWS.md`)
- [ ] Overlay modal QA — 4 browsers + iPhone Safari extended scenarios
- [ ] Founder physical iPhone Safari sign-off on feed + calendar + sheets

---

## 4. Next release — v1.0.4 / v1.1.0

### v1.0.4 (immediate — stabilization close-out)

**Goal:** Close v1.0.3 with Founder device QA; no new features until bugs closed.

| Priority | Item |
|----------|------|
| P0 | Founder confirms BUG-002, BUG-003, BUG-004 on physical iPhone Safari |
| P0 | Postmortems for closed bugs per `POSTMORTEM-PROCESS.md` |
| P1 | Complete Critical User Flows checklist |
| P1 | Update `whats-new.ts` to v1.0.3/v1.0.4 |
| P1 | Add BUG-004 to `RELEASE.md` bug table (doc gap) |
| P2 | Events RSVP lag investigation |

### v1.1.0 (short-term — product polish)

**Theme:** Daily fitness loop + messaging polish + matchmaking GA

| Priority | Feature | Milestone |
|----------|---------|-----------|
| 1 | **Phase B** — merge `EntityActionSheet` into PostInteractionSheet More panel | Feed interaction |
| 2 | **Phase C** — **＋ Quick Log Workout** on reaction bar | Fitness identity |
| 3 | **Training Together Today** — wire `getPartnersTrainingToday` data layer | Calendar v1.1 |
| 4 | **Need a Training Partner Today** discovery rail | Training partners |
| 5 | **P1 Matchmaking GA** — human QA, privacy review, load test, deploy | P1 |
| 6 | **P2 Messaging** — read receipts, media polish, conversation perf | P2 |
| 7 | **Story Replies** | Stories |
| 8 | Feed interaction polish — caption tap → detail only; haptics; staggered tiles | UX |

---

## 5. Short-term (v1.1–v1.3)

### v1.1.0 — Messaging + Partners + Calendar data

| Feature | Scope | Status |
|---------|-------|--------|
| Messaging P2 | Read receipts, media polish, N+1 conversation list fix | 78% — Planned |
| Favorite Training Partners | Refine quick actions (Message, Invite to Workout) | Stable — polish |
| Training Together Today | Backend for partners-training-today rail | Shell only |
| Matchmaking GA | P1 human QA + production deploy | 95% — In Progress |
| Feed Phase B+C | Unified post actions + Quick Log Workout | Phase A done |

### v1.2.0 — Groups & Communities (P3)

| Feature | Scope | Status |
|---------|-------|--------|
| Group discovery polish | Discover tab groups | 35% |
| **Frennix Run Clubs** | Creation wizard, run-club-specific UX | **Planned** — schema stubs only |
| Group analytics | View analytics placeholder → real | Planned |
| Community moderation | Extend ownership framework | Planned |

### v1.3.0 — Challenges (P4)

| Feature | Scope | Status |
|---------|-------|--------|
| Challenge invites MVP | Static checks pass | 62% |
| Challenge analytics | `view_analytics` placeholder → real | Planned |
| Duplicate challenge | Coming soon placeholder → real | Planned |
| Challenge leaderboards | Engagement polish | Planned |

---

## 6. Medium-term (v1.4–v1.7)

### v1.4.0 — Nutrition (P5) — 5% complete

Meal logging, macro tracking, recipe sharing. Schema stubs (`recipe` in ownership registry = `deferred`).

### v1.5.0 — Events (P6) — 68% complete

| Feature | Status |
|---------|--------|
| Event CRUD + RSVP | Stable |
| Event check-in | Planned |
| Event chat | Planned |
| Event recommendations | Planned |
| RSVP confirmation lag fix | Known issue (P2) |

### v1.6.0 — Referral & Ambassador (P7) — 38% complete

Referral codes exist in onboarding. Ambassador program, referral dashboard, growth loops.

### v1.7.0+ — Founder Dashboard expansion (P8) — 55% complete, **paused**

M7.1–M7.3 shipped (community health, platform health, staff onboarding). Expansion paused until P1–P7 progress. Maintenance only.

---

## 7. Long-term (v2.0+)

| Version | Phase | Theme | Completion |
|---------|-------|-------|------------|
| **v2.0.0** | P9 | Marketplace — trainers, programs, payments | 8% |
| **v2.1.0** | P10 | AI Coach — augments human connection | 0% |

### Horizon vision (5+ years)

| Horizon | Goal |
|---------|------|
| Year 1 | Production-ready core loop: match → message → train together |
| Years 2–3 | Thriving communities, referral growth, marketplace + premium |
| Years 4–5 | Multi-market, trainer economy, AI-assisted coaching |
| Year 5+ | Millions of users; synonymous with fitness networking |

### Explicitly deferred

- Premium subscriptions (schema stubs exist)
- Live streaming
- Dating-style swipe UX (gesture deck deferred post-P1)
- Server-side feed ranking at 1M scale
- Staging environment (P8)
- Generic social media patterns that don't reinforce fitness identity

---

## 8. Feature status matrix

| Feature | Status | Version | Notes |
|---------|--------|---------|-------|
| Authentication | **Stable** | v0.8+ | Email + Apple; auth resume fix |
| Profiles | **Stable** | v0.8+ | Lifestyle fields, cover image, online status privacy |
| Feed | **Needs Refactoring** | v1.0.3 | Phase A live; BUG-002/004 open |
| Posts | **Stable** | v1.0.2 | Sharing fix shipped; full edit/delete |
| Stories | **Stable** | v1.0.1 | Dedicated 24h system; replies planned |
| Workout logging | **Stable** | v1.0.1 | Via create-post + calendar CTA; Quick Log planned |
| Messaging | **Stable** | v0.8.0 | Realtime fixed; P2 polish planned |
| Notifications | **Stable** | v0.8+ | Push + in-app + preferences |
| Calendar | **In Progress** | v1.0.1 | Shipped; BUG-003 Safari; v1.1 data rails |
| Discover | **Stable** | v1.0+ | People/Groups/Challenges + Frennix Match score |
| Frennix Match (scoring) | **Stable** | v1.0+ | Discover compatibility |
| Frennix Match (swipe/P1) | **In Progress** | v1.0.0 | Code complete; GA pending |
| Events | **Stable** | v1.0.1 | RSVP lag known |
| Training partners | **In Progress** | v1.0+ | Deck + favorites live |
| Run Club | **Planned** | v1.2 | Schema stubs only |
| Settings | **Stable** | v1.0+ | Full account/safety/prefs |
| Admin / Founder | **Stable** (paused) | v1.0+ | M7.3 live |
| Storage | **Complete** | v0.8+ | 6 Supabase buckets |
| Database | **Complete** | v1.0.2 | 78 migrations |
| API integrations | **Complete** | v0.8+ | Supabase-centric |

---

## 9. Feed interaction phases

**Reference:** `features/releases/FEED-POST-INTERACTION-PATTERN.md`

```
Phase A ✅  ⋯ → PostInteractionSheet; ＋ removed from reaction bar
Phase B     Merge EntityActionSheet (Report, Delete, Copy Link, Block) into More panel
Phase C     ＋ → Quick Log Workout (Founder decision — fitness identity)
Polish      Caption tap → post detail; haptics; staggered tiles; inline double-tap like
```

**Target end state:**

```
┌─────────────────────────────────────┐
│  Avatar  Name · @user · meta    ⋯  │  ← only sheet trigger
├─────────────────────────────────────┤
│  Caption (tap → post detail)        │
│  Media (tap → lightbox)             │
├─────────────────────────────────────┤
│  Reaction chips                     │
│  [＋ Quick Log Workout]             │  ← Phase C
├─────────────────────────────────────┤
│  Comments preview                   │
└─────────────────────────────────────┘
```

---

## 10. Release gates & approval

**No milestone begins without explicit Founder approval** (e.g. *"Approved — begin P1"*).

**No commits, tags, pushes, or production deploys** without separate explicit approval per `RELEASE-WORKFLOW.md`.

### Seven-phase release process

1. Development branch
2. Internal testing (automated scripts + typecheck)
3. Readiness report
4. Human QA (physical device mandatory for new UI — Rule 13)
5. Staging
6. Production
7. Monitoring (24–48h)

### Deploy command (web)

```bash
cd apps/mobile
pnpm build:web
npx vercel deploy --prod --yes --project frennix
```

**Always deploy to `frennix` project** — not `mobile`.

### Migrations before client

```bash
supabase link --project-ref wkrwncovmpsveatlrqel
supabase db push
```

---

## 11. Deferred / out of scope

Tracked in `features/releases/FUTURE-IDEAS.md`:

- Fitness Assistant (AI)
- Fitness Circles, Fitness Seasons, Frennix Journey
- Release Management UI in-app
- Marketplace listings
- Premium tiers
- Live streaming
- Gesture swipe deck (post-P1)
- Server-side ranking at 1M users

**Rule:** Misaligned proposals are questioned before building. Product Vision wins over convenience or competitor mimicry.

---

## Related documents

| Document | Purpose |
|----------|---------|
| `HANDOFF.md` | Full agent handoff — architecture, bugs, standards |
| `DESIGN_SYSTEM.md` | UI/UX standards |
| `features/PRODUCT_VISION.md` | Mission and principles |
| `features/PRODUCT-ROADMAP.md` | P1–P10 milestone detail |
| `features/PROJECT-PROGRESS.md` | Live completion percentages |
| `features/releases/RELEASE.md` | Active release log |
| `features/releases/RELEASE_PROCESS.md` | Official SOP |
| `features/training-calendar/ROADMAP.md` | Calendar v1.1+ detail |
| `features/matching/P1-MILESTONE.md` | Matchmaking GA checklist |
