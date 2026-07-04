# Postmortem — BUG-001

**Process:** [`POSTMORTEM-PROCESS.md`](../POSTMORTEM-PROCESS.md)

---

## Summary

| Field | Value |
|-------|-------|
| **Bug ID** | BUG-001 |
| **Severity** | **P0** |
| **Priority** | Fix immediately |
| **Version Found** | v1.0.1 |
| **Version Fixed** | v1.0.2 |
| **Assigned Milestone** | v1.0.2 |
| **Date reported** | 2026-07-04 |
| **Who discovered it** | User (production) |
| **Status** | Closed |

### User impact

Sharing a workout, photo, or video failed with a database error; users could not create posts.

---

## Root cause

Migration `20250719000001_platform_activity_engine.sql` renamed `event_type` → `activity_type` on `platform_activity_events` and introduced `publish_platform_activity()`, but **did not replace** the legacy `workout_post_activity_record` trigger on `posts`. That trigger still called `record_activity_workout_post()`, which INSERTed into the removed `event_type` column. Post inserts for workout/photo/video types failed at the database trigger layer.

---

## Why automated testing did not catch it

| Gap | Detail |
|-----|--------|
| No post-insert smoke test | No script exercised `INSERT INTO posts` with workout/photo/video types against remote Supabase before deploy |
| Migration sync ≠ trigger audit | `supabase migration list` showed 77/77 synced but did not verify trigger/function wiring after partial engine migration |
| Schema sync gate missing | `verify:schema-sync` did not exist until after the incident |
| Critical User Flows not enforced | POST-01/02/03 were not mandatory pre-deploy gates for v1.0.1 |

---

## What code was changed

| Area | Files / migrations | Commit / deploy |
|------|-------------------|-----------------|
| Database | `20250722000001_fix_post_activity_trigger.sql` | `56fba6d` / applied 2026-07-04 |
| Error UX | `lib/share-post-errors.ts`, `packages/api/src/profile-utils.ts`, `app/create-post.tsx` | `56fba6d` |
| Verification | `scripts/verify-post-sharing-production.ts`, `scripts/verify-schema-sync.ts` | `56fba6d` |
| Release docs | `RELEASE.md`, `CRITICAL-USER-FLOWS` (added after incident class) | subsequent commits |

---

## What QA test was added to prevent recurrence

| Type | Test added | Location |
|------|------------|----------|
| Automated | `npm run verify:post-sharing` — workout/photo/video insert smoke on production | `scripts/verify-post-sharing-production.ts` |
| Automated | `npm run verify:schema-sync` — trigger fix + friendly errors | `scripts/verify-schema-sync.ts` |
| Manual | POST-01, POST-02, POST-03 — create workout/photo/video posts | `CRITICAL-USER-FLOWS.md` |
| Deploy gate | Migrations before client; `verify:schema-sync` in production checklist | `PRODUCTION-DEPLOYMENT.md` |

---

## Release version containing the fix

| Field | Value |
|-------|-------|
| **Fix version** | v1.0.2 |
| **Deploy ID** | `dpl_357TLT9m2EaRSG4fRe5Fem5QE6Fa` |
| **Production verified** | ✅ 2026-07-04 (`verify:post-sharing` 9/9) |

---

## Process improvement

**Did this reveal a release process weakness?** ✅ Yes

| Checklist / doc updated | Change made | Date |
|-------------------------|-------------|------|
| `PRODUCTION-DEPLOYMENT.md` | Added `verify:schema-sync` gate (16c) | 2026-07-04 |
| `RELEASE.md` | Formal release log + bug tracking | 2026-07-04 |
| `CRITICAL-USER-FLOWS.md` | Mandatory 43-flow pre-deploy checklist | 2026-07-04 |
| `POSTMORTEM-PROCESS.md` | This process (after BUG-001 class) | 2026-07-04 |

---

## Timeline

| Date | Event |
|------|-------|
| 2026-07-04 | User reported sharing failure in production |
| 2026-07-04 | BUG-001 logged in RELEASE.md |
| 2026-07-04 | Migration `20250722000001` applied; client deployed v1.0.2 |
| 2026-07-04 | Production verification PASS |
| 2026-07-04 | v1.0.2 closed; process gates added |
| 2026-07-04 | Postmortem closed |

---

## Sign-off

| Role | Name | Date | Approved |
|------|------|------|----------|
| Engineering | Cursor agent | 2026-07-04 | ✅ |
| Founder | | | ⬜ |

**Bug marked Closed in RELEASE.md v1.0.2.**
