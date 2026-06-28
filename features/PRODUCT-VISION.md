# Frennix Product Vision

**Status:** Source of truth — approved direction  
**Last updated:** June 2025  
**Owner:** Founder  
**Applies to:** Every feature, milestone, roadmap decision, and design review

> **Alignment rule:** If a proposed feature does not clearly support this document, it must be questioned and justified before development begins. When in conflict, Product Vision wins over convenience, scope creep, or competitor mimicry.

**Companion docs:** [`PRODUCT-ROADMAP.md`](./PRODUCT-ROADMAP.md) · [`MILESTONE-FRAMEWORK.md`](./MILESTONE-FRAMEWORK.md) · [`PROJECT-PROGRESS.md`](./PROJECT-PROGRESS.md)

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
| **Year 5+** | Millions of users; Frennix is synonymous with *fitness networking* the way LinkedIn is for professional networking — but built for the gym, the trail, and the starting line. |

We do not aspire to be a dating app, a generic social network, or a content-only feed. We aspire to be **the place people go to find someone to train with**.

---

## Core principles

1. **Connection over content** — Social bonds drive retention more than infinite scroll.
2. **Fitness-native, not dating** — Language, UX, and safety reflect training partnerships, not romance.
3. **Real-world outcomes** — Features should lead to workouts, events, and in-person training — not just app engagement.
4. **Premium by default** — Every surface should feel intentional, fast, and trustworthy.
5. **Safety is non-negotiable** — Block, report, and moderation paths are first-class, not afterthoughts.
6. **Scale from day one** — Design for 100, 10,000, and 1,000,000 users without architectural rewrites.
7. **Founder visibility** — Operators must see health, growth, and community signals without querying production manually.
8. **Ship with flags** — Major features deploy behind feature flags; rollback without panic.
9. **Human-first AI** — AI assists planning and insight; humans remain at the center of training relationships.
10. **No silent launches** — Every milestone completes the Release Checklist and four-perspective review before GA.

---

## Target audience

### Primary

| Segment | Description | Core need |
|---------|-------------|-----------|
| **Committed athletes** | Gym-goers, runners, cyclists, CrossFit athletes training 3–6×/week | Training partner for consistency and motivation |
| **Accountability seekers** | People restarting or building a habit | Someone to show up with; social proof |
| **Local fitness explorers** | New to a city or gym | Discover compatible athletes nearby |

### Secondary

| Segment | Description | Core need |
|---------|-------------|-----------|
| **Independent trainers** | Coaches building a client base | Visibility, requests, professional profile |
| **Community organizers** | Run club leaders, gym ambassadors | Grow and engage a local group |
| **Event-driven athletes** | Race prep, challenge participants | Events, groups, shared goals |

### Not primary (out of scope unless vision-aligned)

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
| **Goal** | Find a reliable training partner for push/pull/legs |
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
| **Success** | Joins local run group via Frennix; refers 3 friends (P7) |

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
| **Pain** | Instagram DMs are unstructured; no fitness-specific discovery |
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

## Brand personality

| Trait | Expression | Avoid |
|-------|------------|-------|
| **Energetic** | Confident, forward-moving copy | Hype without substance |
| **Grounded** | Fitness-native language; no fluff | Dating tropes, swipe clichés |
| **Inclusive** | All levels, all styles welcome | Body shaming, elitism |
| **Direct** | Clear CTAs: Connect, Train, Message | Vague or passive voice |
| **Premium** | Dark, focused UI; green accent energy | Cluttered, ad-heavy, cheap feel |

**Voice examples:**
- ✅ "You and Alex are ready to train together."
- ✅ "Find training partners who match your goals and schedule."
- ❌ "It's a match!" (dating connotation)
- ❌ "Swipe right on your gym crush."

**Visual identity:** Dark foundation (`#0A0A0B`), elevated surfaces, **Frennix green** accent (`#22C55E`), 44pt touch targets, mobile-first layouts.

---

## Product philosophy

1. **One core loop** — Discover compatible people → connect → message → train together → return.
2. **Depth before breadth** — Production-ready matchmaking (P1) before marketplace complexity (P9).
3. **Explainable compatibility** — Users understand *why* someone is a good training partner.
4. **Progressive disclosure** — Onboarding collects what matching needs; advanced prefs live in settings.
5. **Empty states teach** — Every dead end explains the next action.
6. **Notifications earn attention** — Push only for meaningful moments (match, message, event).
7. **Defer monetization until value is proven** — Free core social loop; premium enhances, never gates safety.

---

## Design philosophy

| Principle | Implementation |
|-----------|----------------|
| **Mobile-first** | iOS, Android, Web parity; safe areas; thumb-friendly actions |
| **Fitness context** | Cards show goals, activities, streaks — not vanity metrics |
| **Speed as feature** | Prefetch, pagination, optimistic UI where safe |
| **Accessible by default** | Labels, semantics, contrast, 44pt targets |
| **Consistent system** | `@frennix/ui` tokens — colors, spacing, typography |
| **States matter** | Loading, empty, error, offline — never blank screens |
| **Delight with restraint** | Match celebration yes; gimmicky animations no |

---

## Community guidelines

These principles govern product behavior, moderation tooling, and public-facing policy (`frennix.app`).

### Encouraged

- Respectful training partnerships and professional trainer–client relationships
- Honest profiles (real photos, accurate goals and location)
- Supportive feedback, event participation, group accountability
- Reporting concerns promptly

### Prohibited

- Harassment, hate speech, threats, or unsolicited romantic advances
- Fake profiles, impersonation, or misleading trainer credentials
- Spam, scams, or off-platform payment solicitation (until official marketplace)
- Content sexualizing athletes or exploiting minors
- Circumventing blocks or bans

### Product enforcement

- **Block** — Immediate; removes from discovery and unmatched
- **Report** — Queued for moderation review
- **Ban** — Account-level; excluded from candidate RPCs
- **Trainer verification** — Progressive trust (self-reported → verified, roadmap)

Community guidelines will be published publicly and linked from onboarding and settings.

---

## Feature priorities

Official order: [`PRODUCT-ROADMAP.md`](./PRODUCT-ROADMAP.md)

| Priority | Feature | Why (vision alignment) |
|----------|---------|------------------------|
| **P1** | Matchmaking | Core differentiator — find training partners |
| **P2** | Messaging | Connection loop requires reliable communication |
| **P3** | Groups & Communities | Scale from 1:1 to local fitness tribes |
| **P4** | Challenges | Shared goals deepen accountability |
| **P5** | Nutrition | Holistic fitness journey (secondary to social loop) |
| **P6** | Events | Real-world training — vision outcome |
| **P7** | Referrals & Ambassadors | Community-led growth |
| **P8** | Founder Dashboard | Operational excellence at scale |
| **P9** | Marketplace | Revenue + trainer economy |
| **P10** | AI Coach | Augmented guidance, premium tier hook |

**Paused / maintenance:** Founder Dashboard (P8) until P7 — does not block user-facing priorities.

---

## Business model

| Phase | Model |
|-------|-------|
| **Launch (P1–P6)** | Free core social features; growth and retention first |
| **Growth (P7)** | Referral rewards; ambassador tiers (non-monetary → monetary) |
| **Monetization (P9+)** | Premium subscriptions, marketplace transactions, trainer services |
| **Long-term** | Hybrid: freemium social core + premium enhancements + marketplace take rate |

**North star:** Free users must receive full value from the connection loop. Premium sells *more* — not *access*.

---

## Monetization strategy

| Stream | Timing | Description |
|--------|--------|-------------|
| **Frennix Premium** | P9 | Advanced filters, boosted visibility, analytics for athletes |
| **Trainer subscriptions** | P9 | Pro profiles, lead tools, booking (future) |
| **Marketplace** | P9 | Branded merchandise, digital products |
| **AI Coach add-on** | P10 | Personalized plans bundled with Premium |
| **Events (future)** | P6+ | Paid events / ticketed workshops (low priority) |

**Not planned:** Display advertising, selling user data, pay-to-message core DMs.

**Infrastructure:** RevenueCat or Stripe via Edge Functions; `subscriptions` and `subscription_plans` tables (deferred until P9).

---

## Growth strategy

| Lever | Mechanism | Milestone |
|-------|-----------|-----------|
| **Product-led** | Match → chat → invite friend to join | P1–P2 |
| **Community-led** | Groups, challenges, events create local density | P3–P6 |
| **Referral program** | Invite codes, rewards, ambassador tiers | P7 |
| **Trainer-led** | Coaches bring clients onto platform | Phase 14 / P9 |
| **Content moments** | Shareable workout stories, challenge results | Existing + P4 |
| **Founder-led beta** | Invited cohorts, real-user testing | Ongoing |

**Geographic strategy:** City-by-city density (match pool quality) before broad marketing spend.

**Metric focus early:** Mutual match rate, D7 retention, messages per match, referral conversion.

---

## Success metrics

### North star

**Weekly Active Training Connections (WATC)** — Users who sent or received a message with a training partner or group member in the last 7 days.

### Tier 1 (executive)

| Metric | Description |
|--------|-------------|
| **DAU / MAU** | Daily and monthly active users |
| **D7 / D30 retention** | Cohort retention by signup week |
| **Mutual match rate** | Connect → mutual match conversion |
| **Messages per match** | Engagement depth post-match |
| **Referral conversion** | Invites → activated users |

### Tier 2 (feature)

| Domain | Examples |
|--------|----------|
| Matchmaking | Deck load time, empty deck rate, block/report rate |
| Messaging | Delivery latency, read rate, Realtime stability |
| Groups | Members per group, posts per week |
| Events | RSVPs, attendance rate |
| Revenue | MRR, ARPU, conversion to Premium (P9+) |

### Tier 3 (platform)

| Metric | Description |
|--------|-------------|
| P0 bug count | Zero tolerance in production |
| RPC p95 latency | Hot-path performance |
| Push delivery rate | Notification pipeline health |
| Crash-free sessions | Sentry |

Detailed targets per milestone live in [`MILESTONE-PERSPECTIVES.md`](./MILESTONE-PERSPECTIVES.md) and milestone docs (e.g. [`matching/P1-MILESTONE.md`](./matching/P1-MILESTONE.md)).

---

## Competitive advantages

| Advantage | Why it matters |
|-----------|----------------|
| **Fitness-native matching** | Not dating repurposed; compatibility on goals, schedule, activities |
| **Full social stack** | Match + message + groups + events in one app — not bolted-on DMs |
| **Explainable compatibility** | Trust through transparency ("why we matched you") |
| **Trainer + athlete dual market** | Two-sided network effects |
| **Premium dark UX** | Distinct from cluttered legacy fitness apps |
| **Founder ops built-in** | Faster iteration, safer launches at scale |
| **Security-first architecture** | RLS, RPC-only mutations, audit trails |
| **Human-first AI (future)** | Coaching that supports relationships, not replaces them |

**Competitors we learn from (not copy):** Strava (activity), Nike Training Club (content), Meetup (events), LinkedIn (professional networking model).

---

## Technical principles

1. **Supabase as backend** — Postgres, RLS, Realtime, Edge Functions, Auth.
2. **RPCs for mutations** — Sensitive writes via `SECURITY DEFINER` functions, not direct client INSERT.
3. **RLS everywhere** — Users access only their rows; no policy gaps on hot tables.
4. **Typed monorepo** — `@frennix/types`, `@frennix/api`, `@frennix/ui` shared packages.
5. **React Query caching** — Sensible stale times; invalidation on Realtime/push events.
6. **Feature flags** — `feature_flags` table + `evaluate_feature_flag()` for kill switches.
7. **Separate Realtime channels** — One topic per concern (v0.8.0 messaging pattern).
8. **Migrations are contracts** — Every schema change has rollback SQL and verify scripts.
9. **Observability early** — Sentry domains, `product_events`, Founder Platform Health.
10. **Mobile + Web parity** — Expo Router; platform-specific where necessary, shared where possible.

---

## Security principles

1. **Least privilege** — Client gets anon key + RLS; service role only in Edge Functions.
2. **No bypass paths** — If RPC validates, client cannot INSERT directly (e.g. `match_swipes` SELECT-only).
3. **Block enforcement server-side** — Blocked users excluded in candidate RPCs, not UI-only.
4. **Staff access is invite-based** — Roles, permissions, audit log for founder tools.
5. **Secrets never in client** — API keys in env / Edge Functions only.
6. **Privacy by design** — Gender/filter prefs private; document in public privacy policy.
7. **Push token hygiene** — Remove tokens on logout; respect notification preferences.
8. **Production changes gated** — No deploy without Release Checklist + founder approval.

See [`matching/SECURITY.md`](./matching/SECURITY.md) for domain examples.

---

## AI strategy

**Principle:** AI augments human training relationships; it does not replace them.

| Phase | Scope |
|-------|-------|
| **Now (P1–P7)** | No user-facing AI; optional internal analytics summaries (P8) |
| **P10 — AI Coach** | Workout suggestions, plan drafts, form tips (TBD), progress insights |
| **Guardrails** | No medical diagnoses; clear "AI-generated" labeling; human coach escalation |
| **Premium tie-in** | AI Coach as Premium / add-on bundle (P9+P10) |
| **Data** | User opt-in for training data used in personalization; no sale of AI training data |
| **Infrastructure** | Edge Functions + usage metering; rate limits per tier |

**Anti-patterns:** AI chatbots that simulate training partners; unsolicited AI messages; dark-pattern upsells.

---

## Founder principles

1. **User-facing product first** — P1–P7 before expanding Founder Dashboard (P8).
2. **Explicit approval gates** — No commit, tag, push, or deploy without founder sign-off.
3. **Checkpoint after every milestone** — Review doc + Release Checklist before next phase.
4. **Living documentation** — PROJECT-PROGRESS updates after every milestone.
5. **Four perspectives always** — UX, Growth, Founder Ops, Scalability per [`MILESTONE-FRAMEWORK.md`](./MILESTONE-FRAMEWORK.md).
6. **Question misaligned features** — Use this vision doc as the filter.
7. **Beta before broadcast** — Real-user testing before major GA.
8. **Rollback ready** — Every release has a flag or revert plan before deploy.

---

## Company values

| Value | Meaning |
|-------|---------|
| **Show up** | For users, partners, and teammates — reliability builds trust |
| **Build for real workouts** | If it doesn't lead to training together, deprioritize |
| **Respect the athlete** | Safety, privacy, and honest communication |
| **Craft matters** | Premium feel is a feature, not polish at the end |
| **Think in decades** | Architecture and culture that scale to millions |
| **Default to transparency** | Explain matching, explain AI, explain data use |
| **Ship responsibly** | Flags, checklists, monitoring — speed with safety |

---

## Vision alignment checklist

Use before starting any feature or milestone:

| Question | Must be "yes" or justified |
|----------|----------------------------|
| Does this strengthen human fitness connection? | |
| Is the language fitness-native (not dating)? | |
| Does it support retention, referrals, or DAU? | |
| Is there a path to revenue (even if deferred)? | |
| Are safety and moderation considered? | |
| Does it scale to 10k+ users? | |
| Does it have analytics + rollback plan? | |
| Does it fit the official roadmap priority? | |

If any answer is "no," document the exception and obtain founder approval before build.

---

## Document hierarchy

```
PRODUCT-VISION.md          ← Source of truth (this document)
    ├── PRODUCT-ROADMAP.md   ← What we build, in what order
    ├── MILESTONE-FRAMEWORK.md ← How we evaluate each milestone
    ├── PROJECT-PROGRESS.md  ← Where we are now
    └── features/*/          ← Milestone-specific detail
```

When documents conflict, **Product Vision → Roadmap → Milestone docs**.

---

## Approval log

| Date | Decision | Approver |
|------|----------|----------|
| 2025-06 | Product Vision established as source of truth | Founder |
