# Changelog

Public release summaries. **Full release log (issues, QA, migrations, severity):** [`features/releases/RELEASE.md`](features/releases/RELEASE.md) · **Severity system:** [`features/releases/BUG-SEVERITY.md`](features/releases/BUG-SEVERITY.md)  
**In-app:** Settings → Release Notes · **Future ideas:** [`features/releases/FUTURE-IDEAS.md`](features/releases/FUTURE-IDEAS.md)

## [1.0.2] – Workout Sharing Hotfix — 2026-07-04

**Status:** Closed · **Tag:** `v1.0.2` · **Commit:** `56fba6d` · **Production:** https://frennix.vercel.app · **Deploy:** `dpl_357TLT9m2EaRSG4fRe5Fem5QE6Fa` · **Migration:** `20250722000001` applied

### Fixed
- Workout, photo, and video sharing failed when creating posts (`event_type` column error)
- Raw SQL / Supabase error codes no longer shown when sharing fails (client update)

### Improvements
- Friendly message when sharing is temporarily unavailable
- Production verification script: `npm run verify:post-sharing`
- Schema sync gate in release checklist (`verify:schema-sync`)

### Database
- `20250722000001_fix_post_activity_trigger.sql` — replaces legacy post activity trigger with `feed_post_activity_record`

### Verified in production
- `npm run verify:post-sharing` — 9/9 PASS (workout, photo, video inserts)
- `npm run verify:v1.0.2-complete` — 11/11 PASS (feed, stories, notifications, calendar, friendly errors in bundle)

---

## [1.0.1] – Training Calendar — 2026-07-04

**Tag:** `v1.0.1` · **Commit:** `88e4b88` · **Production:** https://frennix.vercel.app

### Added
- Training Calendar tab with month and week views
- Today's Focus daily fitness dashboard (workout, streak, weekly progress)
- Training session create / edit / complete / reschedule flows
- Workout invites from Messages and Stories
- Community Events browse
- Dedicated workout stories, lifestyle matching on Discover

### Fixed
- iPhone Safari post-login black screen
- Calendar horizontal overflow on mobile
- Post-login shell crashes (missing imports, story viewer state)

### Performance
- Mounted tab shell for faster switching
- Safari web scroll shell improvements
- Calendar view prefetch

### Known issues
- Training Together Today partner rail ships in a future update

---

## [0.8.0] – Messaging Stability — 2026-06-28

**Tag:** `v0.8.0` · **Commit:** `c2cb3f9` · **Production:** https://frennix.vercel.app

### Fixed
- Messages crash for users with a single conversation (Realtime channel topic collision)
- Duplicate Realtime subscriptions across Messages list and open chat
- Presence subscription errors crashing the Messages tab
- Message history reliability when Realtime is unavailable
- Graceful reconnect / degraded-mode handling with user-facing banners
- Logout cleanup for messaging Realtime state

### Added
- `realtime-utils.ts` — unique topics, safe subscribe/teardown helpers
- Verification scripts for messaging Realtime architecture

### Deferred
- UI polish (safe-area, tab shell, skeletons) → next milestone

---

## Prior releases

Releases before v0.8.0 were deployed without formal versioning. Notable milestones on `main` include Workout Stories 2.0, Post Interaction Sheet, and iPhone Safari feed scroll fixes.
