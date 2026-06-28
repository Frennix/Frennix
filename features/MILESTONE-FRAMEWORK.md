# Frennix Milestone Framework

**Applies to:** Every production milestone P1–P10  
**Source of truth:** [`PRODUCT-VISION.md`](./PRODUCT-VISION.md)  
**Companion docs:** [`PRODUCT-ROADMAP.md`](./PRODUCT-ROADMAP.md) · [`MILESTONE-PERSPECTIVES.md`](./MILESTONE-PERSPECTIVES.md) · [`RELEASE-CHECKLIST.md`](./RELEASE-CHECKLIST.md) · [`PROJECT-PROGRESS.md`](./PROJECT-PROGRESS.md)

Every milestone must be evaluated through **four perspectives** before it is considered production-ready.

---

## Four perspectives

### 1. User Experience

| Question | Goal |
|----------|------|
| Does this make the experience feel **premium**? | Polished UI, fitness-native copy, delight moments |
| Is it **intuitive**? | Minimal steps, clear empty/error states, discoverable actions |
| Does it feel **fast**? | Perceived performance, prefetch, optimistic UI where safe |
| Would someone choose Frennix over another fitness app? | Differentiation, core loop clarity, trust |

**Deliverables:** UI/UX polish sign-off, accessibility review, perf targets met.

---

### 2. Business Growth

| Question | Goal |
|----------|------|
| How does this increase **retention**? | Habit loops, notifications, social bonds |
| How does this increase **referrals**? | Share moments, invite hooks, viral loops |
| How does this increase **DAU**? | Reasons to return daily |
| How will this eventually **generate revenue**? | Path to premium, marketplace, or ads (even if not monetized yet) |

**Deliverables:** Success metrics with 30-day targets, analytics events, growth hooks documented.

---

### 3. Founder Operations

| Question | Goal |
|----------|------|
| What **analytics** appear in the Founder Dashboard? | KPIs, drill-downs, domain registry |
| What **moderation tools** are needed? | Report, block, admin review queues |
| What **alerts** should founders receive? | Inbox items, Sentry, health degradation |
| What **KPIs** should this feature produce? | Executive + community metrics |

**Deliverables:** Metric definitions, activity triggers, placeholder or live dashboard widgets.

---

### 4. Scalability

| Scale | Design bar |
|-------|------------|
| **100 users** | Works correctly; manual QA sufficient |
| **10,000 users** | Indexed queries, pagination, no N+1 client patterns |
| **1,000,000 users** | RPC aggregates, sampling, caching, partition-ready schema |

**Also evaluate:** Database queries, Realtime subscriptions, notifications, caching.

**Deliverables:** Architecture review notes, load test where hot paths exist.

---

## Required metadata (every milestone)

Each milestone document must include:

| Field | Description |
|-------|-------------|
| **Estimated completion time** | Weeks; confidence range |
| **Dependencies** | Prior milestones, infra, migrations |
| **Risks** | Top 3+ with mitigations |
| **Success metrics** | Measurable 30-day targets |
| **Rollback plan** | Flags, revert steps, data safety |
| **Future enhancements** | Post-milestone backlog |
| **Completion percentage** | Honest % with rationale |
| **Version number** | Target semver |
| **Release notes** | Link to `features/releases/RELEASE-vX.Y.Z.md` |

Plus: **Release Checklist** (18 items) · **Four Perspectives** (this framework)

---

## Milestone document map

| Phase | Perspectives detail | Release checklist | Review |
|-------|---------------------|-------------------|--------|
| P1 | [`matching/P1-MILESTONE.md`](./matching/P1-MILESTONE.md) | [`matching/P1-RELEASE-CHECKLIST.md`](./matching/P1-RELEASE-CHECKLIST.md) | [`matching/P1-REVIEW.md`](./matching/P1-REVIEW.md) |
| P2–P10 | [`MILESTONE-PERSPECTIVES.md`](./MILESTONE-PERSPECTIVES.md) | Create at milestone start | Create at milestone end |

When a milestone **starts**, create its release checklist copy. When it **completes**, update [`PROJECT-PROGRESS.md`](./PROJECT-PROGRESS.md) and the perspectives doc.

---

## Process gates

1. **Milestone start** — Founder approval; create checklist; update PROJECT-PROGRESS  
2. **Milestone build** — Four perspectives reviewed during architecture review  
3. **Milestone finish** — Release checklist 18/18; perspectives signed off; PROJECT-PROGRESS updated  
4. **No commit / tag / push / deploy** without separate explicit founder approval
