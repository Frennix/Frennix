# Release v1.0.1 — Safari Tab Layout Hotfix

**Status:** `draft`  
**Milestone:** P1  
**Type:** patch / hotfix  
**Target date:** TBD

---

## Summary

Fixes the iPhone Safari post-login black screen introduced in v1.0.0 by restoring the conservative fixed tab-scene chrome offset in `lib/web-tab-scene-layout.ts`. Re-ships P1 Matchmaking on top of v1.0.0 code with this single layout fix.

---

## Scope

### Fixed
- iPhone Safari post-login black screen (`lib/web-tab-scene-layout.ts`)

### Added
- (none — hotfix only)

### Known issues
- (carry forward from v1.0.0 release notes as applicable)

---

## Phase 2 — Internal testing

**Checklist:** [`checklists/INTERNAL-TESTING.md`](./checklists/INTERNAL-TESTING.md)

| Gate | Status | Date |
|------|--------|------|
| All automated tests PASS | ⬜ | |
| Migrations reviewed | ⬜ | |
| Analytics verified | ⬜ | |
| Permissions verified | ⬜ | |
| Notifications/messaging verified | ⬜ | |
| Build clean | ⬜ | |
| **Internal testing complete** | ⬜ | |

---

## Phase 2.5 — Release Readiness Report

**Report:** [`RELEASE-v1.0.1-READINESS.md`](./RELEASE-v1.0.1-READINESS.md)

| Gate | Status | Date |
|------|--------|------|
| Readiness report complete | ✅ | 2026-06-28 |
| Recommendation documented (Ready / Not Ready) | ✅ Ready for Human QA | 2026-06-28 |
| **Release readiness report delivered** | ⬜ | |
| Founder approved Human QA | ⬜ | |

---

## Phase 3 — Human QA

**Checklist:** [`checklists/HUMAN-QA.md`](./checklists/HUMAN-QA.md)

| Gate | Status | Date |
|------|--------|------|
| All critical flows pass | ⬜ | |
| Post-login not black (iPhone Safari) | ⬜ | |
| **Human QA approved** | ⬜ | |

---

## Phase 4 — Staging

**Checklist:** [`checklists/STAGING-DEPLOYMENT.md`](./checklists/STAGING-DEPLOYMENT.md)

| Gate | Status | Date |
|------|--------|------|
| Staging deployed | ⬜ | |
| Staging verification complete | ⬜ | |
| **Founder staging approval** | ⬜ | |

---

## Phase 5 — Production

**Checklist:** [`checklists/PRODUCTION-DEPLOYMENT.md`](./checklists/PRODUCTION-DEPLOYMENT.md)

| Step | Phrase | Date | Approved |
|------|--------|------|----------|
| Commit | `Approved — commit v1.0.1` | | ⬜ |
| Tag | `Approved — tag v1.0.1` | | ⬜ |
| Push | `Approved — push v1.0.1` | | ⬜ |
| Deploy | `Approved — deploy v1.0.1` | | ⬜ |

---

## Rollback plan

1. `npx vercel promote` prior v0.8.0 deployment or redeploy `c2cb3f9` dist
2. Disable `training_matchmaking` flag if matchmaking-specific issue
3. Migrations unchanged from v1.0.0 — no DB rollback needed

**Prior known-good:** v0.8.0 @ `c2cb3f9`

---

## Lessons learned

(To be completed after release — see v1.0.0 incident in [`RELEASE-HISTORY.md`](./RELEASE-HISTORY.md))
