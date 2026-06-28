# Milestone Four Perspectives — P1 through P10

**Living document** — update when each milestone starts or completes.  
**Framework:** [`MILESTONE-FRAMEWORK.md`](./MILESTONE-FRAMEWORK.md)  
**Full P1 detail:** [`matching/P1-MILESTONE.md`](./matching/P1-MILESTONE.md)

---

## Summary table

| Phase | Version | Completion | Duration | Release notes |
|-------|---------|------------|----------|---------------|
| P1 Matchmaking | v1.0.0 | 90% | 3–4 wk | [RELEASE-v1.0.0.md](./releases/RELEASE-v1.0.0.md) |
| P2 Messaging | v1.1.0 | 78% | 3–4 wk | TBD |
| P3 Groups | v1.2.0 | 35% | 6–8 wk | TBD |
| P4 Challenges | v1.3.0 | 62% | 4–5 wk | TBD |
| P5 Nutrition | v1.4.0 | 5% | 6–8 wk | TBD |
| P6 Events | v1.5.0 | 68% | 4–5 wk | TBD |
| P7 Referrals | v1.6.0 | 38% | 5–6 wk | TBD |
| P8 Founder | v1.7.0+ | 55% | 2–3 wk/slice | TBD |
| P9 Marketplace | v2.0.0 | 8% | 10–14 wk | TBD |
| P10 AI Coach | v2.1.0 | 0% | 10–14 wk | TBD |

---

## P1 — Matchmaking ✅ In progress

**See:** [`matching/P1-MILESTONE.md`](./matching/P1-MILESTONE.md)

| Perspective | Headline |
|-------------|----------|
| **UX** | Premium training-partner deck; explainable compatibility; fast prefetch |
| **Growth** | Core retention loop (match → chat); DAU via discovery; revenue path via premium/boost |
| **Founder Ops** | Match KPIs live; activity triggers; in-deck moderation; Sentry domains |
| **Scale** | RPC candidates; 10k-ready; 1M needs server-side ranking |

---

## P2 — Messaging

**Dependencies:** P1  
**Rollback:** `messaging_realtime_v2` flag

| Perspective | Plan |
|-------------|------|
| **UX** | Stable, expressive chat — reactions, read receipts, typing, media; feels as good as iMessage for fitness |
| **Growth** | Partner messages drive daily opens; push tap-through; badge sync |
| **Founder Ops** | Message volume KPIs; Realtime health subsystem; error rate alerts |
| **Scale** | Message pagination; channel lifecycle; separate Realtime topics; 1M = read replicas + message archival |

**Success metrics:** Realtime P0 = 0; median delivery < 2s; push tap-through ≥ 25%

**Risks:** Safari/web Realtime; channel reuse bugs (mitigated v0.8.0 pattern)

**Future:** Voice notes, search, E2E evaluate at scale

---

## P3 — Groups & Communities

**Dependencies:** P2  
**Rollback:** Disable group chat creation flag

| Perspective | Plan |
|-------------|------|
| **UX** | Run clubs and gym communities feel purposeful; admin tools clear; group chat seamless |
| **Growth** | Community bonds → retention; run club invites → referrals (P7); group events → DAU |
| **Founder Ops** | Group creation/join metrics; group-level moderation; trending communities snapshot |
| **Scale** | N-way Realtime rooms; member caps initially; 1M = sharded conversations, fan-out limits |

**Success metrics:** 20+ groups with ≥5 members; 30% group member chat DAU

**Risks:** N-way Realtime complexity; moderation load

**Future:** Paid communities, private clubs

---

## P4 — Challenges

**Dependencies:** P3 optional  
**Rollback:** Hide create challenge; read-only existing

| Perspective | Plan |
|-------------|------|
| **UX** | Progress visible; leaderboards exciting; badges celebrate wins |
| **Growth** | Challenge loops → weekly retention; invite friends → P7; share completions → feed |
| **Founder Ops** | Active challenges KPI (live); check-in events; leaderboard query perf |
| **Scale** | Leaderboard snapshots daily; 1M = precomputed ranks |

**Success metrics:** 25% completion rate; 3 check-ins/participant/week

**Risks:** Leaderboard hot rows; check-in gaming

**Future:** Sponsored challenges, prizes

---

## P5 — Nutrition

**Dependencies:** Feed, moderation  
**Rollback:** `nutrition` feature flag

| Perspective | Plan |
|-------------|------|
| **UX** | Beautiful recipe cards; easy meal logging; discovery feels inspiring not clinical |
| **Growth** | Daily meal logging → DAU; recipe shares → feed engagement; trainer recipes → P9 |
| **Founder Ops** | Nutrition domain analytics; recipe report queue; macro adoption tracking |
| **Scale** | Recipe search indexes; image storage quotas; 1M = CDN + search service |

**Success metrics:** 100+ recipes/30d; 15% weekly meal loggers

**Risks:** Medical claims; moderation volume

**Future:** Macros full, barcode scan, meal plans

---

## P6 — Events

**Dependencies:** P3 for group events  
**Rollback:** Disable check-in; RSVP only

| Perspective | Plan |
|-------------|------|
| **UX** | Local events easy to find; RSVP + check-in smooth; event chat natural |
| **Growth** | Real-world meetups → strong retention; share events → referrals |
| **Founder Ops** | Events KPI (live); attendance funnel; geo-sparse market alerts |
| **Scale** | Geo/time indexes; 1M = regional aggregation, recommendation service |

**Success metrics:** 50% RSVP→check-in; 10+ events/week beta

**Risks:** Sparse local supply; geo privacy

**Future:** Recurring events, paid tickets

---

## P7 — Referral & Ambassador

**Dependencies:** P1–P6 engagement loops  
**Rollback:** Disable rewards; keep invite links

| Perspective | Plan |
|-------------|------|
| **UX** | Invite flow frictionless; ambassador dashboard motivating; rewards feel meaningful |
| **Growth** | **Primary growth milestone** — viral coefficient ≥ 0.3; 20% attributed signups |
| **Founder Ops** | Referral growth KPI (live); ambassador admin UI; fraud alerts |
| **Scale** | Referral ledger; rate limits; 1M = async attribution pipeline |

**Success metrics:** Viral coefficient ≥ 0.3; ambassador tier progression

**Risks:** Referral fraud; reward cost

**Future:** Creator fund, gym partnerships

---

## P8 — Founder Dashboard (resume)

**Dependencies:** P1–P7 metrics richness  
**Rollback:** `founder_dashboard` flag

| Perspective | Plan |
|-------------|------|
| **UX** | Founders get answers in <5 min; mobile-usable ops center |
| **Growth** | Faster iteration → better product → indirect growth |
| **Founder Ops** | **Meta milestone** — inbox, releases, flags, funnel charts for P1–P7 |
| **Scale** | Aggregate tables; cron metrics; 1M = warehouse export, sampled activity |

**Success metrics:** Zero manual SQL for staff; incident diagnose < 5 min

**Risks:** Ops work blocks product (mitigated: slice-based)

**Future:** Revenue dashboard, AI insights

---

## P9 — Marketplace

**Dependencies:** P8 release tooling; Stripe/RevenueCat  
**Rollback:** `marketplace` flag; disable checkout

| Perspective | Plan |
|-------------|------|
| **UX** | Trustworthy checkout; clear coach/trainer listings; premium feels worth it |
| **Growth** | Revenue **direct**; coaches bring audiences → referrals |
| **Founder Ops** | Revenue KPIs; GMV; payout alerts; fraud monitoring |
| **Scale** | Stripe webhooks; idempotent orders; 1M = payout batch jobs, tax infra |

**Success metrics:** GMV target at kickoff; 2% listing→purchase conversion

**Risks:** PCI; seller quality

**Future:** Subscriptions bundle with P10

---

## P10 — AI Coach

**Dependencies:** P5 nutrition data; P9 premium optional  
**Rollback:** `ai_coach` flag

| Perspective | Plan |
|-------------|------|
| **UX** | Coach feels personal, safe, motivating — not generic chatbot |
| **Growth** | Daily coach check-ins → DAU; premium upsell; share insights |
| **Founder Ops** | AI session metrics; cost/token monitoring; safety incident alerts |
| **Scale** | Rate limits; quota per user; 1M = dedicated inference budget, caching |

**Success metrics:** 10% MAU WAU on AI; 4.0/5 satisfaction

**Risks:** API cost; liability on advice

**Future:** Voice, wearables, marketplace coaches + AI hybrid

---

## Update log

| Date | Change |
|------|--------|
| 2025-06-25 | Four-perspective framework added; P1 detailed; P2–P10 planning summaries |
