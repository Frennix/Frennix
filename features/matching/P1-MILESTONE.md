# P1 — Matchmaking (Production Ready)

**Version:** v1.0.0  
**Completion:** **90%** (code complete; QA + deploy pending)  
**Duration:** 3–4 weeks  
**Release notes:** [`../releases/RELEASE-v1.0.0.md`](../releases/RELEASE-v1.0.0.md)  
**Framework:** [`../MILESTONE-FRAMEWORK.md`](../MILESTONE-FRAMEWORK.md)  
**Vision alignment:** [`../PRODUCT-VISION.md`](../PRODUCT-VISION.md)

---

## Vision alignment (P1)

| Vision element | P1 contribution |
|----------------|-----------------|
| **Mission** | Core loop: discover → connect → train together |
| **Fitness-native** | Training partners language; not dating |
| **Premium feel** | Compatibility badge, match celebration, dark UI |
| **Safety** | In-deck report/block; server-side block enforcement |
| **Growth** | Match → message retention loop; analytics funnel |
| **Scale** | RPC candidates, feature flag rollback |

P1 is the **highest-priority vision-aligned feature** — without production-ready matchmaking, Frennix has no differentiated core.

| Field | Value |
|-------|-------|
| **Dependencies** | M2 Messaging stability (v0.8.0); profile/onboarding; push tokens |
| **Risks** | Low candidate pool in beta; Realtime edge cases; privacy compliance | 
| **Rollback** | `training_matchmaking` feature flag; no data deletion |
| **Future enhancements** | Gesture deck, geo/distance matching, trainer matching (Phase 14), ML ranking |

### Success metrics (30 days post-launch)

| Metric | Target |
|--------|--------|
| Mutual match rate (connect → match) | ≥ 15% |
| Day-7 retention (matchers) | ≥ 40% |
| P0 matchmaking bugs | 0 |
| Median deck load time | < 2s |

---

## 1. User Experience

| Criterion | P1 approach | Status |
|-----------|-------------|--------|
| **Premium feel** | Frennix branding, fitness-native copy (not dating), match modal celebration, compatibility badge | ✅ |
| **Intuitive** | Connect/Skip actions, readiness gate, clear empty deck, preferences in one screen | ✅ |
| **Fast** | Candidate prefetch (next avatar), deck pagination via RPC limit 20, perf analytics | ✅ |
| **Choose Frennix** | Core differentiator: *training partners* with explainable compatibility (“Why we matched you”) | ✅ |

**Gaps:** Gesture swipe deck deferred post-P1; human QA pending.

---

## 2. Business Growth

| Criterion | P1 approach |
|-----------|-------------|
| **Retention** | Match → chat loop; push on mutual match; presence on match list; workout streak on cards |
| **Referrals** | Share moment deferred; match success is future invite hook (P7) |
| **DAU** | Discovery requires return visits; `daily_active_user` + deck engagement events |
| **Revenue path** | Premium filters / boosted visibility (P9 marketplace era); trainer matching upsell (Phase 14) |

**Analytics events:** `match_skip`, `match_connect`, `match_deck_loaded`, `match_deck_empty`, `perf_matching_load`, server `training_partner_match`.

---

## 3. Founder Operations

| Area | P1 implementation |
|------|-------------------|
| **Dashboard analytics** | Executive KPI: New Matches; Community Health: matches_today; Activity feed: `training_match` events; Domain: `/founder/analytics/matchmaking` |
| **Moderation** | In-deck report/block; block removes from deck + auto-unmatch; reports → existing moderation queue |
| **Founder alerts** | Sentry spikes on `matchmaking_domain`; activity feed errors; future: inbox on match RPC failure rate (P8) |
| **KPIs** | `new_matches_today`, match conversion funnel (product_events), active matchers (DAU subset) |

**Placeholder until P8:** Dedicated matchmaking funnel chart; push delivery rate for match notifications.

---

## 4. Scalability

| Scale | Design |
|-------|--------|
| **100 users** | ✅ RPC deck, client-side scoring on ≤20 candidates |
| **10,000 users** | ✅ Indexed swipes/matches; block list in RPC; RLS hardened |
| **1,000,000 users** | 🔄 Server-side ranking migration planned; activity sampling; candidate cache layer |

| System | Scale notes |
|--------|-------------|
| **Database** | `get_match_candidates` RPC with filters; no client full-table scans |
| **Realtime** | Match notifications via DB trigger + push; not deck Realtime |
| **Notifications** | Existing push pipeline; preference gates |
| **Caching** | React Query 60s stale; avatar prefetch for next card |

**Load test:** `scripts/load-test-match-candidates.ts` before deploy.

---

## P1 implementation status

| Work stream | Status |
|-------------|--------|
| Core match flow | ✅ |
| Compatibility scoring + UI | ✅ |
| Analytics instrumentation | ✅ |
| Feature flag kill switch | ✅ (migration pending apply) |
| In-deck safety | ✅ |
| Accessibility (code) | ✅ |
| Phase A profile fields UI | ✅ |
| Human QA | ⬜ |
| Privacy policy (external) | ⬜ |
| Production deploy | ⬜ |

See [`P1-RELEASE-CHECKLIST.md`](./P1-RELEASE-CHECKLIST.md) · [`P1-REVIEW.md`](./P1-REVIEW.md)
