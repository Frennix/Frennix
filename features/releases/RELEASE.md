# Frennix Release Log

**Purpose:** Formal record of every production release — issues, fixes, migrations, and verification.  
**Public summary:** [`CHANGELOG.md`](../../CHANGELOG.md)  
**In-app notes:** [`whats-new.ts`](./whats-new.ts)  
**Future product ideas (not active release work):** [`FUTURE-IDEAS.md`](./FUTURE-IDEAS.md)

---

## How we use this log

1. **Before fixing anything** reported in production or QA → add an issue row to the **active release** below.
2. **When fixed** → fill root cause, fix, QA verified, deploy commit.
3. **On ship** → set status to **Released**, update CHANGELOG + whats-new.ts.
4. **Never mix** roadmap features into bug-fix releases — use FUTURE-IDEAS.md instead.

### Issue priority

| Priority | Meaning |
|----------|---------|
| **Critical** | Core flow broken for all or most users |
| **High** | Major feature degraded; workaround difficult |
| **Medium** | Partial impact or easy workaround |
| **Low** | Cosmetic or edge case |

---

## v1.0.3 — Active release

| Field | Value |
|-------|-------|
| **Status** | In Progress |
| **Target date** | TBD |
| **Type** | Patch — post–v1.0.2 stabilization |

> **All new production issues, tester feedback, bugs, and enhancements go here first** — document before fixing.

### New features

_None yet._

### Improvements

_None yet._

### Bug fixes

| ID | Priority | Description | Reported | Reporter | Root cause | Fix | QA | Prod |
|----|----------|-------------|----------|----------|------------|-----|-----|------|
| — | — | — | — | — | — | — | — | — |

### Performance improvements

_None yet._

### Known issues

| Feature | Status | Notes |
|---------|--------|-------|
| Events RSVP | Temporary | Confirmations may lag; RSVP still saved |
| Training Together Today | Coming Soon | UI shell only; data in v1.1 |
| Story Replies | Coming Soon | Planned |

### Database migrations

_None planned._

### QA checklist

- [ ] _Add items when v1.0.3 scope is defined_

### Production verification

| Check | Pass | Notes |
|-------|------|-------|
| _Pending v1.0.3 deploy_ | ⬜ | |

**Bug list:** [`v1.0.3-BUG-LIST.md`](./v1.0.3-BUG-LIST.md)

---

## v1.0.2 — Workout sharing hotfix ✅ Closed

| Field | Value |
|-------|-------|
| **Status** | Closed |
| **Date** | 2026-07-04 |
| **Type** | Patch — production stability |
| **Production** | https://frennix.vercel.app |
| **Deploy** | `dpl_357TLT9m2EaRSG4fRe5Fem5QE6Fa` |
| **Bundle** | `index-8cd1571b6bf170c2fed505b5efa633b0.js` |
| **Migration** | `20250722000001` applied to production Supabase |

### New features

_None — stability release only._

### Improvements

- Friendly error messages when workout/photo/video sharing fails (no raw SQL or Supabase codes)
- Production schema sync gate added to release checklist (`verify:schema-sync`, `verify:post-sharing`)

### Bug fixes

| ID | Priority | Description | Reported | Reporter | Root cause | Fix | QA | Prod |
|----|----------|-------------|----------|----------|------------|-----|-----|------|
| BUG-001 | **Critical** | Sharing workout/post fails: `column 'event_type' of relation 'platform_activity_events' does not exist` | 2026-07-04 | User (production) | `20250719000001` renamed `event_type` → `activity_type` but left legacy `workout_post_activity_record` trigger calling `record_activity_workout_post()` which still INSERTs `event_type` | Migration `20250722000001_fix_post_activity_trigger.sql` + friendly share errors | ✅ | ✅ |

### Performance improvements

_None._

### Known issues (after v1.0.2)

| Feature | Status | Notes |
|---------|--------|-------|
| Events RSVP | Temporary | Confirmations may lag; RSVP still saved |
| Training Together Today | Coming Soon | UI shell only; data in v1.1 |
| Story Replies | Coming Soon | Planned |

### Database migrations

| Migration | Purpose | Applied |
|-----------|---------|---------|
| `20250722000001_fix_post_activity_trigger.sql` | Replace legacy post activity trigger; use `activity_type` via `publish_platform_activity` | ✅ 2026-07-04 |

### QA checklist

- [x] Share a workout post — no error; appears in feed
- [x] Share a photo post — no error; appears in feed
- [x] Share a video post — no error; appears in feed
- [x] Failure path shows friendly message (not SQL) — deployed `dpl_357TLT9m2EaRSG4fRe5Fem5QE6Fa`
- [x] `npm run verify:schema-sync` PASS
- [x] `npm run verify:post-sharing` PASS (9/9)
- [x] `npm run verify:v1.0.2-complete` PASS (11/11)
- [x] `npx supabase migration list` — local = remote (78/78)

### Production verification

| Check | Pass | Notes |
|-------|------|-------|
| Migration applied to production Supabase | ✅ | `npx supabase db push` — `20250722000001` |
| Legacy `workout_post_activity_record` removed | ✅ | `feed_post_activity_record` active |
| Workout / photo / video insert smoke (DB) | ✅ | `npm run verify:post-sharing` |
| Existing posts feed loads | ✅ | REST query — 10 recent posts |
| No `event_type` in post-related functions | ✅ | Schema audit via linked query |
| Web deploy to frennix.vercel.app | ✅ | `dpl_357TLT9m2EaRSG4fRe5Fem5QE6Fa` |
| Friendly errors in production bundle | ✅ | Verified via `verify:v1.0.2-complete` |
| Stories / feed / notifications / calendar | ✅ | Production API + completion gate |
| Founder smoke: share workout | ✅ | DB + REST insert smoke (9/9) |
| No `event_type` errors in logs | ✅ | Schema audit + post inserts clean |

---

## v1.0.1 — Training Calendar

| Field | Value |
|-------|-------|
| **Status** | Released |
| **Date** | 2026-07-04 |
| **Commit** | `88e4b88cf032aa59f6f9d0007370cb725490d64e` |
| **Production** | https://frennix.vercel.app |

### Highlights

- Training Calendar tab with Today's Focus daily dashboard
- Month/week views, session CRUD, workout invites
- iPhone Safari post-login layout fix
- Sticky calendar controls + responsive layout

### Database migrations (shipped)

`20250716000001` through `20250721000001` (Training Calendar, achievements, platform activity engine, RLS fixes)

### Stabilization

[`STABILIZATION-v1.0.1.md`](./STABILIZATION-v1.0.1.md) — 48h window active through 2026-07-06

---

## v0.8.0 — Messaging Stability

| Field | Value |
|-------|-------|
| **Status** | Released |
| **Date** | 2026-06-28 |
| **Commit** | `c2cb3f9` |

### Highlights

- Messages realtime crash fixes
- Graceful reconnect / degraded-mode banners

---

## Related

- [`RELEASE_PROCESS.md`](./RELEASE_PROCESS.md)
- [`v1.0.3-BUG-LIST.md`](./v1.0.3-BUG-LIST.md) — **active**
- [`v1.0.2-BUG-LIST.md`](./v1.0.2-BUG-LIST.md)
- [`RELEASE-HISTORY.md`](./RELEASE-HISTORY.md)
