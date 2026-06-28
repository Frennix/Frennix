# Changelog

All notable Frennix releases are documented here. See `features/releases/` for detailed release notes.

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
