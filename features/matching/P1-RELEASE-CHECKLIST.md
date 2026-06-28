# P1 Release Checklist — Matchmaking (Production Ready)

**Target version:** v1.0.0  
**Milestone:** P1  
**Completion:** 90%  
**Four perspectives:** [`P1-MILESTONE.md`](./P1-MILESTONE.md)  
**Started:** 2025-06-25  
**Status:** Code complete — QA + deploy pending

Master template: [`../RELEASE-CHECKLIST.md`](../RELEASE-CHECKLIST.md)  
Framework: [`../MILESTONE-FRAMEWORK.md`](../MILESTONE-FRAMEWORK.md)  
Vision: [`../PRODUCT-VISION.md`](../PRODUCT-VISION.md)

---

## Release Checklist

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Feature complete | ✅ | Analytics, safety, a11y, Phase A fields UI |
| 2 | UI/UX polish complete | ✅ | Match score badge, deck safety actions |
| 3 | Performance tested | ⬜ | Run `load-test-match-candidates.ts` before deploy |
| 4 | Security review | ✅ | `features/matching/SECURITY.md`; RLS Phase 13 |
| 5 | Database migration reviewed | ⬜ | Apply `20250704000001` + prior migrations remotely |
| 6 | Manual QA completed | ⬜ | `features/matching/QA.md` — all rows ⬜ |
| 7 | Automated tests passing | 🔄 | Run `verify-matchmaking-qa.ts` (35 PASS, 1 FAIL — remote migrations) |
| 8 | Accessibility review | 🔄 | Code done; device verify pending |
| 9 | Analytics events verified | ⬜ | Staging smoke test after migration |
| 10 | Error logging verified | ✅ | Sentry `matchmaking_domain` tags |
| 11 | Production deployment checklist | ⬜ | See `PRODUCTION.md` |
| 12 | Rollback plan documented | ✅ | `training_matchmaking` flag + `PRODUCTION.md` |
| 13 | Release notes written | ✅ | `features/releases/RELEASE-v1.0.0.md` draft |
| 14 | Founder approval | ⬜ | Separate approval for commit/tag/deploy |
| 15 | Version tag assigned | ⬜ | `v1.0.0` |
| 16 | Production deployment | ⬜ | Not without explicit approval |
| 17 | Post-release monitoring 24–48h | ⬜ | Sentry + Founder Platform Health |
| 18 | Bug-fix patch if needed | ⬜ | `v1.0.1` scoped if hotfixes required |

---

## P1 scope verification

| Requirement | Status |
|-------------|--------|
| Complete matching experience | ✅ Core flow shipped |
| Smart filters | ✅ Gender/preference + readiness |
| Profile compatibility | ✅ Phase A fields UI + score display |
| Discovery improvements | ✅ Deck UX, empty states, refresh |
| Safety and reporting | ✅ In-deck report/block |
| Human QA | ⬜ |
| Privacy review | ⬜ External site |
| Production readiness | 🔄 Flag migration pending apply |

---

## Commands

```bash
# Automated QA
cd apps/mobile && npx tsx scripts/verify-matchmaking-qa.ts

# Scoring unit checks
pnpm verify:matching-scoring

# Load test (optional, needs TEST_USER_JWT)
npx tsx scripts/load-test-match-candidates.ts
```

---

## Sign-off

| Role | Name | Date | Approved |
|------|------|------|----------|
| Engineering | — | — | ⬜ |
| Founder | — | — | ⬜ |

**Milestone complete when:** All checklist items ✅ + founder P1 completion approval.
