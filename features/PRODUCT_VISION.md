# Frennix Product Vision

**Status:** Permanent source of truth — read before writing code  
**Last updated:** 2026-06-28  
**Owner:** Founder  
**Applies to:** Every engineer, designer, founder, contractor, and AI agent working on Frennix

> **Alignment rule:** If a proposed feature does not clearly support this document, **challenge it before building it**. When documents conflict, **Product Vision wins** over convenience, scope creep, or competitor mimicry.

**For developers & AI agents:** Read this document fully before implementing any feature. Validate every request against the [Vision alignment checklist](#vision-alignment-checklist). If alignment is unclear, stop and ask the founder.

**Companion docs:** [`PRODUCT-ROADMAP.md`](./PRODUCT-ROADMAP.md) · [`releases/RELEASE_PROCESS.md`](./releases/RELEASE_PROCESS.md) · [`MILESTONE-FRAMEWORK.md`](./MILESTONE-FRAMEWORK.md) · [`PROJECT-PROGRESS.md`](./PROJECT-PROGRESS.md)

---

## Mission

**Help people build lasting fitness habits through real human connection.**

Frennix exists because most fitness apps optimize for content consumption or solo tracking. Lasting change happens when people train together — with accountability, shared goals, and partners who show up. Frennix is the social layer for fitness: find training partners, stay connected, and grow stronger as a community.

---

## Long-term vision (5+ years)

Frennix becomes the **default fitness social platform** — where athletes, trainers, and communities meet, train, and grow together at global scale.

| Horizon | Vision |
|---------|--------|
| **Year 1** | Production-ready core loop: match → message → train together. Trusted beta → public launch. |
| **Years 2–3** | Thriving communities (groups, challenges, events), referral-driven growth, marketplace and premium tiers. |
| **Years 4–5** | Multi-market presence; trainer economy; AI-assisted coaching that augments — never replaces — human connection. |
| **Year 5+** | Millions of users; Frennix is synonymous with *fitness networking* — built for the gym, the trail, and the starting line. |

**We are not:** a dating app, a generic social network, or a content-only feed.  
**We are:** the place people go to find someone to train with.

---

## Core principles

1. **Connection over content** — Social bonds drive retention more than infinite scroll.
2. **Fitness-native, not dating** — Language, UX, and safety reflect training partnerships, not romance.
3. **Real-world outcomes** — Features lead to workouts, events, and in-person training — not just app engagement.
4. **Premium by default** — Every surface feels intentional, fast, and trustworthy.
5. **Safety is non-negotiable** — Block, report, and moderation paths are first-class.
6. **Scale from day one** — Design for 100, 10,000, and 1,000,000 users without architectural rewrites.
7. **Founder visibility** — Operators see health, growth, and community signals without manual SQL.
8. **Ship with flags** — Major features deploy behind feature flags; rollback without panic.
9. **Human-first AI** — AI assists planning and insight; humans remain at the center of training relationships.
10. **No silent launches** — Every release follows [`RELEASE_PROCESS.md`](./releases/RELEASE_PROCESS.md) with staging, QA, and separate Founder approvals.
11. **Staging before production** — No production deploy without verified staging (lesson: v1.0.0 regression).
12. **Question misaligned features** — Use this document as the filter before any build.

---

## Target audience

### Primary

| Segment | Description | Core need |
|---------|-------------|-----------|
| **Committed athletes** | Gym-goers, runners, cyclists, CrossFit athletes training 3–6×/week | Training partner for consistency |
| **Accountability seekers** | People restarting or building a habit | Someone to show up with |
| **Local fitness explorers** | New to a city or gym | Discover compatible athletes nearby |

### Secondary

| Segment | Description | Core need |
|---------|-------------|-----------|
| **Independent trainers** | Coaches building a client base | Visibility, requests, professional profile |
| **Community organizers** | Run club leaders, gym ambassadors | Grow and engage a local group |
| **Event-driven athletes** | Race prep, challenge participants | Events, groups, shared goals |

### Out of scope (unless vision-aligned exception approved)

- Casual content browsers with no intent to train with others
- Dating or romance use cases
- Passive fitness tracking without social intent

---

## User personas

### Alex — The Consistent Lifter

| | |
|---|---|
| **Age** | 28 |
| **Context** | Goes to the gym 5×/week; friends' schedules don't align |
| **Goal** | Reliable training partner for push/pull/legs |
| **Pain** | Gym apps track workouts but don't help find compatible lifters |
| **Frennix value** | Training partner matching by goals, schedule, and gym |
| **Success** | Mutual match → regular gym sessions → 90-day retention |

### Jordan — The Endurance Athlete

| | |
|---|---|
| **Age** | 34 |
| **Context** | Marathon training; early-morning runner |
| **Goal** | Long-run partner and race-day crew |
| **Pain** | Strava is solo; Facebook groups are noisy |
| **Frennix value** | Activity-based matching, events, group runs |
| **Success** | Joins local run group; refers 3 friends (P7) |

### Sam — The Habit Builder

| | |
|---|---|
| **Age** | 22 |
| **Context** | New to fitness; intimidated by the gym |
| **Goal** | Accountability and encouragement |
| **Pain** | Fitness apps feel overwhelming; no human connection |
| **Frennix value** | Approachable onboarding, compatible partner, supportive messaging |
| **Success** | First mutual match within 7 days; first in-person workout within 14 days |

### Taylor — The Independent Trainer

| | |
|---|---|
| **Age** | 38 |
| **Context** | Certified coach; building online + in-person clientele |
| **Goal** | Qualified leads without marketplace fees (early stage) |
| **Pain** | Instagram DMs are unstructured |
| **Frennix value** | Trainer profile, matching requests, professional credibility |
| **Success** | Steady inbound requests; premium visibility (P9) |

### Riley — The Community Builder

| | |
|---|---|
| **Age** | 31 |
| **Context** | Leads a local CrossFit box community group |
| **Goal** | Grow active membership and event attendance |
| **Pain** | Fragmented tools (WhatsApp, Instagram, spreadsheets) |
| **Frennix value** | Groups, challenges, events, ambassador tools (P7) |
| **Success** | 50+ active group members; recurring weekly events |

---

## Brand identity

### Personality

| Trait | Expression | Avoid |
|-------|------------|-------|
| **Energetic** | Confident, forward-moving copy | Hype without substance |
| **Grounded** | Fitness-native language | Dating tropes, swipe clichés |
| **Inclusive** | All levels, all styles welcome | Body shaming, elitism |
| **Direct** | Clear CTAs: Connect, Train, Message | Vague or passive voice |
| **Premium** | Dark, focused UI; green accent energy | Cluttered, ad-heavy, cheap feel |

### Voice

- ✅ "You and Alex are ready to train together."
- ✅ "Find training partners who match your goals and schedule."
- ❌ "It's a match!" (dating connotation)
- ❌ "Swipe right on your gym crush."

### Visual identity

| Element | Specification |
|---------|---------------|
| **Background** | `#0A0A0B` (dark foundation) |
| **Surfaces** | `#141416` elevated layers |
| **Accent** | Frennix green `#22C55E` |
| **Typography** | System via `@frennix/ui` tokens |
| **Touch targets** | Minimum 44pt |
| **Layout** | Mobile-first; safe areas on all platforms |
| **Logo** | `FrennixLogo` component — full, icon variants |

### Brand promise

*Real people. Real training. Real progress.*

---

## Design philosophy

| Principle | Implementation |
|-----------|----------------|
| **Mobile-first** | iOS, Android, Web parity; safe areas; thumb-friendly actions |
| **Fitness context** | Cards show goals, activities, streaks — not vanity metrics |
| **Speed as feature** | Prefetch, pagination, optimistic UI where safe |
| **Accessible by default** | Labels, roles, contrast, 44pt targets |
| **Consistent system** | `@frennix/ui` tokens — colors, spacing, typography |
| **States matter** | Loading, empty, error, offline — **never blank or black screens** |
| **Delight with restraint** | Match celebration yes; gimmicky animations no |
| **Conservative web layout** | Safari flex chains use proven fixed chrome offsets on web (see v1.0.0 lesson) |
| **Explainable UX** | Users understand *why* (compatibility, permissions, AI labels) |

---

## Feature roadmap

Official priority order: [`PRODUCT-ROADMAP.md`](./PRODUCT-ROADMAP.md)

| Priority | Feature | Target version | Status |
|----------|---------|----------------|--------|
| **P1** | Matchmaking | v1.0.0 / v1.0.1 hotfix | Code complete; hotfix pending |
| **P2** | Messaging excellence | v1.1.0 | Planned |
| **P3** | Groups & Communities | v1.2.0 | Planned |
| **P4** | Challenges | v1.3.0 | Planned |
| **P5** | Nutrition | v1.4.0 | Planned |
| **P6** | Events | v1.5.0 | Planned |
| **P7** | Referrals & Ambassadors | v1.6.0 | Planned |
| **P8** | Founder Dashboard (expand) | v1.7.0+ | Paused (M7.3 shipped) |
| **P9** | Marketplace | v2.0.0 | Planned |
| **P10** | AI Coach | v2.1.0 | Planned |

**Rule:** No phase begins without explicit Founder approval. P8 paused until P1–P7 progress.

---

## MVP features (shipped / GA scope)

Minimum viable product = **core connection loop** on a stable, safe foundation.

### Shipped (production v0.8.0+)

| Domain | MVP capability |
|--------|----------------|
| **Auth & profiles** | Sign up, login, onboarding, edit profile |
| **Feed** | Posts, stories, reactions, comments, share |
| **Messaging** | DMs, Realtime, typing, read state, push (v0.8.0 stability) |
| **Discover** | Athletes, groups, challenges suggestions |
| **Events** | Create, RSVP, discover |
| **Challenges** | Create, join, participate |
| **Groups** | Create, join, group posts |
| **Notifications** | In-app + push preferences |
| **Safety** | Block, report, moderation basics |
| **Referrals** | Invite codes (foundation) |

### P1 GA additions (v1.0.1 target after hotfix)

| Domain | MVP capability |
|--------|----------------|
| **Training partner matching** | Discovery deck, connect/skip, mutual match, match list |
| **Compatibility** | Score display, Phase A profile fields, explain why |
| **Match safety** | In-deck report/block; flag `training_matchmaking` |
| **Match analytics** | Product events + Founder matchmaking dashboard |
| **Beta feedback** | Tester submission + Founder command center |

### Explicitly not MVP

- Marketplace / payments (P9)
- AI Coach (P10)
- Full ambassador program (P7)
- Group chat at scale (P3)
- Macro nutrition tracking (P5)
- Gesture swipe deck (post-P1 polish)

---

## Planned future features

High-level backlog aligned to roadmap — detail in [`PRODUCT-ROADMAP.md`](./PRODUCT-ROADMAP.md).

| Phase | Future capabilities |
|-------|---------------------|
| **P2** | Message reactions parity, read receipts polish, media improvements, typing reliability |
| **P3** | Group chats, run clubs, gym communities, group announcements, group moderation |
| **P4** | Team challenges, leaderboards, achievement badges, group challenges |
| **P5** | Recipe sharing, meal posts, nutrition logs, macro tracking (later) |
| **P6** | Event check-in, event chat, event recommendations |
| **P7** | Referral rewards, ambassador dashboard, growth tracking, anti-fraud |
| **P9** | Trainer listings, merchandise, subscriptions, Stripe checkout |
| **P10** | AI workout plans, nutrition suggestions, goal tracking, weekly insights |

**Post-MVP polish (non-blocking):** Trainer matching (Phase 14), video intros, verified athletes, ML ranking, E2E encryption evaluation, voice notes.

---

## Founder Dashboard roadmap

**Status:** M7.1–M7.3 shipped; **P8 paused** until P1–P7 user-facing progress.

### Shipped (operations foundation)

| Module | Capability |
|--------|------------|
| Executive Dashboard | KPIs, activity summary |
| Community Health | Engagement, retention signals |
| Platform Health | Subsystem status, latency |
| Live Activity Feed | Real-time product events |
| Staff management | Roles, capabilities, audit trail |
| Matchmaking analytics | Connect/skip/deck metrics |
| Beta Feedback command center | Single source of truth for tester reports |

### Planned slices (P8 — when resumed)

| Slice | Version | Scope |
|-------|---------|-------|
| P8a | v1.7.0 | Founder Inbox, daily/weekly summaries |
| P8b | v1.7.1 | Release Management UI, CHANGELOG sync |
| P8c | v1.7.2 | Feature flags UI, staged rollouts |
| P8d | v1.7.3 | User analytics charts, moderation merge |
| P8e | v1.7.4 | Ambassador admin (pairs with P7) |

**Principle:** User-facing product (P1–P7) before expanding Founder Dashboard.

Detail: [`founder-dashboard/ARCHITECTURE.md`](./founder-dashboard/ARCHITECTURE.md)

---

## AI roadmap

**Principle:** AI augments human training relationships; it does **not** replace them.

| Phase | AI scope |
|-------|----------|
| **Now (P1–P7)** | No user-facing AI; internal analytics only |
| **P8 (optional)** | Founder summary helpers (ops, not user-facing coach) |
| **P10 — AI Coach** | Workout suggestions, plan drafts, progress insights, motivation nudges |
| **Premium tie-in** | AI Coach bundled with Premium (P9+P10) |
| **Guardrails** | No medical diagnoses; "AI-generated" labeling; human coach escalation; opt-in data use |
| **Infrastructure** | Edge Functions, usage metering, rate limits per tier |

### Anti-patterns (never build)

- AI chatbots that simulate training partners
- Unsolicited AI messages in DMs
- Medical or injury advice presented as certainty
- Dark-pattern AI upsells

---

## Monetization roadmap

**North star:** Free users receive full value from the connection loop. Premium sells *more* — not *access* to safety or core social features.

| Phase | Model |
|-------|-------|
| **Launch (P1–P6)** | Free core social features; growth and retention first |
| **Growth (P7)** | Referral rewards; ambassador tiers (non-monetary → monetary) |
| **Monetization (P9+)** | Premium subscriptions, marketplace transactions, trainer services |
| **Long-term** | Freemium social core + premium enhancements + marketplace take rate |

| Stream | Timing | Description |
|--------|--------|-------------|
| **Frennix Premium** | P9 | Advanced filters, boosted visibility, athlete analytics |
| **Trainer subscriptions** | P9 | Pro profiles, lead tools, booking (future) |
| **Marketplace** | P9 | Merchandise, digital products, services |
| **AI Coach add-on** | P10 | Bundled with Premium |
| **Events (paid)** | P6+ | Ticketed workshops (low priority) |

**Not planned:** Display advertising, selling user data, pay-to-message core DMs.

---

## Community strategy

### Growth model

| Lever | Mechanism | Milestone |
|-------|-----------|-----------|
| **Product-led** | Match → chat → invite friend | P1–P2 |
| **Community-led** | Groups, challenges, events create local density | P3–P6 |
| **Referral program** | Invite codes, rewards, ambassador tiers | P7 |
| **Trainer-led** | Coaches bring clients | P9 |
| **Founder-led beta** | Invited cohorts, Beta Feedback loop | Ongoing |

**Geographic strategy:** City-by-city density (match pool quality) before broad marketing spend.

### Community guidelines (product-enforced)

**Encouraged:** Respectful training partnerships; honest profiles; supportive feedback; event participation; prompt reporting.

**Prohibited:** Harassment; hate speech; unsolicited romantic advances; fake profiles; spam; off-platform payment solicitation (until marketplace); sexualized content; ban evasion.

**Enforcement:** Block (immediate) → Report (moderation queue) → Ban (RPC exclusion) → Trainer verification (progressive trust).

### Beta Feedback loop

All tester feedback flows to **Founder Beta Feedback Dashboard** (`/founder/support`) — single source of truth. Community sentiment informs prioritization; not every request becomes a feature (vision filter applies).

---

## Release philosophy

Frennix ships like a production-grade software company. Every release follows the **seven-phase process** in [`releases/RELEASE_PROCESS.md`](./releases/RELEASE_PROCESS.md).

| Belief | Practice |
|--------|----------|
| **Quality over speed** | Staging deploy + human QA on iPhone, Android, Web before production |
| **Separate approval gates** | Commit → tag → push → deploy are distinct Founder approvals |
| **Rollback ready** | Feature flags + prior Vercel deployment documented before every ship |
| **Migrations first** | Database changes applied and verified before matching client deploy |
| **No silent launches** | CHANGELOG, release file, GitHub Release, monitoring plan |
| **Learn from incidents** | v1.0.0 black screen → mandatory iPhone Safari post-login QA + staging gate |

**Current production:** v0.8.0 (stable). **Next ship:** v1.0.1 hotfix via full release process.

---

## Success metrics (KPIs)

### North star

**Weekly Active Training Connections (WATC)** — Users who sent or received a message with a training partner or group member in the last 7 days.

### Tier 1 — Executive

| Metric | Description |
|--------|-------------|
| **DAU / MAU** | Daily and monthly active users |
| **D7 / D30 retention** | Cohort retention by signup week |
| **Mutual match rate** | Connect → mutual match conversion |
| **Messages per match** | Engagement depth post-match |
| **Referral conversion** | Invites → activated users |

### Tier 2 — Feature

| Domain | Examples |
|--------|----------|
| Matchmaking | Deck load time, empty deck rate, block/report rate |
| Messaging | Delivery latency, Realtime stability, push tap-through |
| Groups / Events | Members per group, RSVP → check-in rate |
| Revenue (P9+) | MRR, ARPU, Premium conversion |

### Tier 3 — Platform

| Metric | Target |
|--------|--------|
| P0 bugs in production | **Zero tolerance** |
| RPC p95 latency | Within milestone targets |
| Crash-free sessions | ≥ 99.5% |
| Post-deploy monitoring | 24–48h clear before release complete |

Detail per milestone: [`MILESTONE-PERSPECTIVES.md`](./MILESTONE-PERSPECTIVES.md)

---

## Product decisions and why

Permanent record of major decisions. Add new rows when Founder approves significant direction changes.

| Date | Decision | Why | Alternatives rejected |
|------|----------|-----|----------------------|
| 2025-06 | **Matchmaking before Founder Dashboard expansion** | Core user value first; ops tools don't grow DAU | Finish P8 before P1 |
| 2025-06 | **Fitness-native language, not dating** | Brand differentiation; safety; retention quality | Tinder-style UX |
| 2025-06 | **Feature flags for major features** | Emergency rollback without redeploy | Hard-coded enable |
| 2025-06 | **RPC mutations, RLS everywhere** | Security at scale; no client bypass | Direct client INSERT on hot tables |
| 2025-06 | **Four-perspective milestones** | Balance UX, growth, ops, scale | Engineering-only definition of done |
| 2025-06 | **Beta Feedback as single source of truth** | One queue for all tester input | Scattered admin routes |
| 2026-06 | **Official release process (7 phases)** | v1.0.0 regression; staging + separate approvals | Deploy straight to production |
| 2026-06 | **Rollback v1.0.0 → v0.8.0** | iPhone Safari black screen blocked all testers | Hotfix in production without staging |
| 2026-06 | **Fixed WEB_TAB_CHROME_PX on web** | Dynamic safe-area tab height collapsed Safari flex chain | Per-device dynamic chrome (v1.0.0) |
| 2026-06 | **Defer monetization to P9** | Prove connection loop before paywalls | Early Premium gates |
| 2026-06 | **AI Coach deferred to P10** | Human connection is the product | AI-first MVP |
| 2026-06 | **P8 Founder Dashboard paused** | P1–P7 drive user growth | Continuous ops feature work |

---

## Vision alignment checklist

**Use before starting any feature, PR, or milestone.** Every question must be "yes" or have documented Founder-approved exception.

| # | Question |
|---|----------|
| 1 | Does this strengthen **human fitness connection**? |
| 2 | Is the language and UX **fitness-native** (not dating)? |
| 3 | Does it support **retention, referrals, or DAU**? |
| 4 | Is there a path to **revenue** (even if deferred)? |
| 5 | Are **safety and moderation** considered? |
| 6 | Does it **scale** to 10k+ users without redesign? |
| 7 | Does it have **analytics + rollback plan**? |
| 8 | Does it fit the **official roadmap priority**? |
| 9 | Has it been validated against **this Product Vision** document? |
| 10 | Will it pass **staging + iPhone Safari QA** before production? |

**If any answer is "no":** Document the exception and obtain **Founder approval before build**.

---

## Document hierarchy

```
PRODUCT_VISION.md          ← Source of truth (this document)
    ├── PRODUCT-ROADMAP.md   ← What we build, in what order
    ├── releases/RELEASE_PROCESS.md ← How we ship
    ├── MILESTONE-FRAMEWORK.md ← How we evaluate milestones
    ├── PROJECT-PROGRESS.md  ← Where we are now
    └── features/*/          ← Milestone-specific detail
```

When documents conflict: **Product Vision → Roadmap → Release Process → Milestone docs**.

---

## Approval log

| Date | Decision | Approver |
|------|----------|----------|
| 2025-06 | Product Vision established as source of truth | Founder |
| 2026-06-28 | PRODUCT_VISION.md expanded as permanent SOP for all contributors and AI agents | Founder |
| 2026-06-28 | Release Management process (7 phases) adopted | Founder |
