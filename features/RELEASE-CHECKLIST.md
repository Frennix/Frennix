# Frennix Release Checklist (All Milestones)

**Applies to:** P1–P10 and all semver releases  
**Source of truth:** [`PRODUCT-VISION.md`](./PRODUCT-VISION.md) — features must align before release  
**Rule:** A milestone is **not finished** until every applicable item is checked and documented.

Copy this checklist into each milestone folder (e.g. `features/matching/P1-RELEASE-CHECKLIST.md`) and track status there. Link from [`PRODUCT-ROADMAP.md`](./PRODUCT-ROADMAP.md).

---

## Release Checklist

| # | Item | Owner | Status |
|---|------|-------|--------|
| 1 | **Feature complete** — All scope items implemented; no known P0 gaps in code | Engineering | ⬜ |
| 2 | **UI/UX polish complete** — Loading/empty/error states, mobile safe areas, copy audit | Engineering | ⬜ |
| 3 | **Performance tested** — Screen load, list scroll, RPC latency within targets | Engineering | ⬜ |
| 4 | **Security review** — RLS, RPC auth, input validation, abuse paths documented | Engineering | ⬜ |
| 5 | **Database migration reviewed** — Migrations applied/tested; rollback SQL documented | Engineering | ⬜ |
| 6 | **Manual QA completed** — iOS, Android, Web sign-off matrix | QA / Founder | ⬜ |
| 7 | **Automated tests passing** — Verification scripts green in CI/local | Engineering | ⬜ |
| 8 | **Accessibility review** — Labels, roles, focus order, screen reader smoke test | Engineering | ⬜ |
| 9 | **Analytics events verified** — Events fire in staging; founder metrics updated if applicable | Engineering | ⬜ |
| 10 | **Error logging verified** — Sentry tags/domains; no silent catch blocks on critical paths | Engineering | ⬜ |
| 11 | **Production deployment checklist** — Migrations, Edge Functions, env vars, cron jobs | Engineering | ⬜ |
| 12 | **Rollback plan documented** — Feature flags, revert steps, data safety notes | Engineering | ⬜ |
| 13 | **Release notes written** — `CHANGELOG.md` + `features/releases/RELEASE-vX.Y.Z.md` | Engineering | ⬜ |
| 14 | **Founder approval** — Explicit approval to commit, tag, push, deploy | Founder | ⬜ |
| 15 | **Version tag assigned** — Git tag `vX.Y.Z` on approved commit | Engineering | ⬜ |
| 16 | **Production deployment** — Deploy to production; verify bundle/deployment ID | Engineering | ⬜ |
| 17 | **Post-release monitoring (24–48h)** — Sentry, founder platform health, user reports | Engineering / Founder | ⬜ |
| 18 | **Bug-fix patch milestone if needed** — `vX.Y.Z+1` scoped, approved, shipped | Engineering | ⬜ |

---

## Milestone-specific checklist files

| Phase | Checklist file |
|-------|----------------|
| P1 | [`matching/P1-RELEASE-CHECKLIST.md`](./matching/P1-RELEASE-CHECKLIST.md) |
| P2 | `messaging/P2-RELEASE-CHECKLIST.md` *(create at P2 start)* |
| P3 | `groups/P3-RELEASE-CHECKLIST.md` *(create at P3 start)* |
| P4 | `challenges/P4-RELEASE-CHECKLIST.md` *(create at P4 start)* |
| P5 | `nutrition/P5-RELEASE-CHECKLIST.md` *(create at P5 start)* |
| P6 | `events/P6-RELEASE-CHECKLIST.md` *(create at P6 start)* |
| P7 | `referrals/P7-RELEASE-CHECKLIST.md` *(create at P7 start)* |
| P8 | `founder-dashboard/P8-RELEASE-CHECKLIST.md` *(create at P8 resume)* |
| P9 | `marketplace/P9-RELEASE-CHECKLIST.md` *(create at P9 start)* |
| P10 | `ai-coach/P10-RELEASE-CHECKLIST.md` *(create at P10 start)* |

---

## Approval gates (unchanged)

1. Milestone **start** — Founder approves (e.g. *Approved — begin P1*).  
2. Milestone **finish** — All checklist items complete + founder sign-off on release.  
3. **Commit / tag / push / deploy** — Separate explicit founder approval for each step.

See [`releases/RELEASE-WORKFLOW.md`](./releases/RELEASE-WORKFLOW.md).
