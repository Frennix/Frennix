# Release vX.Y.Z — [Release Title]

**Status:** `draft` | `internal-testing` | `qa` | `staging-ready` | `staging-verified` | `production-ready` | `deployed` | `monitoring` | `complete` | `rolled-back`  
**Milestone:** P_  
**Type:** major | minor | patch | hotfix  
**Target date:** YYYY-MM-DD

---

## Summary

[One paragraph: what this release ships and why.]

---

## Scope

### Added
-

### Fixed
-

### Known issues
-

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

## Phase 3 — Human QA

**Checklist:** [`checklists/HUMAN-QA.md`](./checklists/HUMAN-QA.md)

| Platform | Tester | Date | Pass |
|----------|--------|------|------|
| iPhone Safari | | | ⬜ |
| iPhone app | | | ⬜ |
| Android | | | ⬜ |
| Desktop Web | | | ⬜ |

| Gate | Status | Date |
|------|--------|------|
| All critical flows pass | ⬜ | |
| Post-login not black (iPhone Safari) | ⬜ | |
| **Human QA approved** | ⬜ | |

---

## Phase 4 — Staging

**Checklist:** [`checklists/STAGING-DEPLOYMENT.md`](./checklists/STAGING-DEPLOYMENT.md)

| Field | Value |
|-------|-------|
| Staging URL | https://staging.frennix.vercel.app |
| Deployment ID | |
| Commit SHA | |
| Bundle hash | |

| Gate | Status | Date |
|------|--------|------|
| Staging deployed | ⬜ | |
| Staging verification complete | ⬜ | |
| **Founder staging approval** | ⬜ | |

---

## Phase 5 — Production

**Checklist:** [`checklists/PRODUCTION-DEPLOYMENT.md`](./checklists/PRODUCTION-DEPLOYMENT.md)

### Approval record

| Step | Phrase | Date | Approved |
|------|--------|------|----------|
| Commit | `Approved — commit vX.Y.Z` | | ⬜ |
| Tag | `Approved — tag vX.Y.Z` | | ⬜ |
| Push | `Approved — push vX.Y.Z` | | ⬜ |
| Deploy | `Approved — deploy vX.Y.Z` | | ⬜ |

### Deployment record

| Field | Value |
|-------|-------|
| Commit SHA | |
| Git tag | |
| GitHub Release | |
| Production URL | https://frennix.vercel.app |
| Deployment ID | |
| Bundle hash | |
| Deploy date | |

### Migrations

| Migration | Applied staging | Applied production |
|-----------|-----------------|-------------------|
| | ⬜ | ⬜ |

### Post-deploy verification

| Check | Pass | Date |
|-------|------|------|
| HTTP 200 | ⬜ | |
| Correct bundle | ⬜ | |
| Migrations synced | ⬜ | |
| iPhone Safari login → feed | ⬜ | |
| API smoke test | ⬜ | |

---

## Phase 6 — Monitoring (24–48h)

**Checklist:** [`checklists/POST-RELEASE-MONITORING.md`](./checklists/POST-RELEASE-MONITORING.md)

| Window | Clear | Date |
|--------|-------|------|
| 0–2 hours | ⬜ | |
| 24 hours | ⬜ | |
| 48 hours | ⬜ | |

---

## Phase 7 — Release completion

**Checklist:** [`checklists/RELEASE-COMPLETION.md`](./checklists/RELEASE-COMPLETION.md)

| Task | Done |
|------|------|
| CHANGELOG.md updated | ⬜ |
| PROJECT-PROGRESS.md updated | ⬜ |
| RELEASE-HISTORY.md updated | ⬜ |
| QA checklists archived | ⬜ |
| Lessons learned recorded | ⬜ |
| **Founder release complete approval** | ⬜ |

---

## Rollback plan

1. [Primary rollback step — e.g. feature flag, Vercel promote]
2. [Secondary — redeploy prior tag dist]
3. [Data safety notes]

**Prior known-good:** v___ @ commit `_______`

---

## Lessons learned

| Category | Notes |
|----------|-------|
| What went well | |
| What went wrong | |
| Process improvements | |

---

## Sign-off log

| Role | Action | Name | Date |
|------|--------|------|------|
| Engineering | Internal testing | | |
| Founder | Human QA | | |
| Founder | Staging approval | | |
| Founder | Commit approval | | |
| Founder | Tag approval | | |
| Founder | Push approval | | |
| Founder | Deploy approval | | |
| Founder | Release complete | | |
