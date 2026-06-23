# Frennix Agent Handoff — Training Partners & Presence

**Last updated:** June 2026 (Phase 13 complete)  
**Status:** Phases 4–13 **live**. Matchmaking ready for production sign-off pending human device QA.

---

## Current state

| Area | Status |
|------|--------|
| **Training partner discovery** | Live — deck, preferences, readiness gate |
| **Training matches list** | Live — unread, presence, remove match |
| **Notifications** | Live — in-app + push, fitness copy, deep links |
| **Push hardening** | Live — permission UX, type-aware invalidation |
| **Safety** | Live — unmatch RPC, block auto-unmatch |
| **Presence** | Hardened — heartbeat, background offline, realtime UI, stale cron |
| **Production readiness** | Phase 13 — monitoring, RLS audit, docs, automated QA |

---

## Phase summary (4–13)

See [`features/matching/README.md`](./features/matching/README.md).

| Phase | Focus |
|-------|--------|
| 4–6 | Preferences, discovery deck, matches list |
| 7 | Presence hardening |
| 8–9 | Notifications + push hardening |
| 10 | Match removal & blocking |
| 11 | Settings refinement & discovery gate |
| 12 | Pre-production QA (automated script + checklist) |
| 13 | Production readiness (cron, RLS, Sentry, docs) |

---

## Production launch

```bash
# Automated QA (expect 30+ PASS)
cd apps/mobile && npx tsx scripts/verify-matchmaking-qa.ts

# Load test (read-only, requires TEST_USER_JWT)
TEST_USER_JWT=... npx tsx scripts/load-test-match-candidates.ts
```

**Docs:**
- [`features/matching/QA.md`](./features/matching/QA.md) — device checklist + sign-off
- [`features/matching/PRODUCTION.md`](./features/matching/PRODUCTION.md) — rollout + monitoring
- [`features/matching/SECURITY.md`](./features/matching/SECURITY.md) — RLS audit

**Remaining before launch:** Human device QA sign-off + privacy policy website update.

---

## Phase 14 — Trainer Matching

Phase **14A complete** (live). Phase **14B blocked** until Phase 15 exit.

See [`features/trainers/README.md`](./features/trainers/README.md) and [`features/trainers/PHASE-14B.md`](./features/trainers/PHASE-14B.md).

---

## Next: Phase 15 — Real User Validation (live)

Invited beta testing, Supabase analytics, enhanced feedback, performance baselines.

See [`features/validation/PHASE-15.md`](./features/validation/PHASE-15.md).

Phase 14B (Trainer Leads Dashboard) **blocked** until Phase 15 exit criteria met.

---

## Architecture quick reference

| Item | Path |
|------|------|
| Git root | `/Users/startswithu/Source/frennix/apps/mobile` |
| Monorepo root | `/Users/startswithu/Source/frennix` |
| Supabase project | `wkrwncovmpsveatlrqel` |
| Expo start | `cd apps/mobile && npx expo start --clear` |
| Migrations | `cd /Users/startswithu/Source/frennix && supabase db push` |
| Deploy push | `supabase functions deploy send-push` |

### Key routes

| Route | Screen |
|-------|--------|
| `/matching-settings` | Training partner preferences |
| `/matching` | Discovery deck |
| `/matching/matches` | Training matches list |
| `/notifications` | Notifications center |
| `/chat/:conversationId` | Chat |

---

## Monitoring (Sentry)

Tag: `matchmaking_domain` — values: `match_swipe`, `match_candidates`, `match_remove`, `presence`, `push_registration`

See [`features/matching/PRODUCTION.md`](./features/matching/PRODUCTION.md).

---

## Commands cheat sheet

```bash
cd apps/mobile && npx expo start --clear
cd /Users/startswithu/Source/frennix && supabase db push
cd apps/mobile && npx tsx scripts/verify-matchmaking-qa.ts
```
