# Release: v0.8.0 – Messaging Stability

**Status:** Ready for production  
**Production URL:** https://frennix.vercel.app  
**Fix commit:** `c2cb3f947b1ad7205690a84f3f2b4bc343b13a9a`  
**Bundle:** `index-623f4d405879707a92a881e88293ab6e.js`

---

## Summary

This release fixes a critical Messages crash affecting users with a single conversation, hardens Supabase Realtime subscription lifecycle across presence, messages, typing, and reactions, and ensures chat remains usable when live updates fail.

---

## Fixed

| Area | Description |
|------|-------------|
| **Messages crashing for some users** | Supabase reused Realtime channels by topic; when the Messages list and an open chat both subscribed to `presence:<partner-id>`, the second subscription threw `cannot add postgres_changes callbacks after subscribe()`. Each subscription now uses a unique topic via `allocRealtimeTopic()`. |
| **Duplicate realtime subscriptions** | List + chat could collide on the same presence topic (especially one-conversation accounts). Messages, reactions, and presence each allocate fresh channel topics per subscription instance. |
| **Presence subscription errors** | `useProfilesPresence` wraps subscribe in try/catch, exposes `realtimeUnavailable`, and shows a non-blocking banner instead of crashing the tab. |
| **Message history loading reliability** | Historical messages load via REST (`getMessages`) independent of Realtime. Chat queries are enabled on focus; send/read use REST mutations. |
| **Graceful reconnect handling** | Chat and list show degraded-state banners when live updates fail; subscriptions return `{ ok }` and never throw into React. Typing resubscribe removes an existing channel before creating a new listener. |
| **Logout cleanup** | `resetMessagingRealtimeState()` clears module-level typing caches on sign-out; chat effect teardown calls `unsubscribe()` + `teardownTypingChannel()` + reaction cleanup. |

---

## Technical changes

- **`packages/api/src/realtime-utils.ts`** — unique topics, register all `postgres_changes` handlers before `subscribe()`, shared teardown helpers
- **`packages/api/src/presence.ts`** — presence via `subscribePostgresChanges`
- **`packages/api/src/messaging.ts`** — messages/typing subscriptions, typing dedupe, logout reset
- **`packages/api/src/reactions.ts`** — per-subscription reaction channel topics
- **`lib/useProfilesPresence.ts`** — defensive subscribe, `realtimeUnavailable` flag
- **`app/(tabs)/messages.tsx`** — presence fallback banner
- **`app/chat/[conversationId].tsx`** — safe subscribe/cleanup, dedupe incoming messages, degraded banner
- **`providers/AuthProvider.tsx`** — messaging realtime reset on sign-out
- **`scripts/verify-messaging-realtime.mjs`** — static architecture checks
- **`scripts/verify-supabase-init.ts`** — duplicate presence subscription regression test

---

## Verify

Run automated checks before device QA:

```bash
cd apps/mobile
node scripts/verify-messaging-realtime.mjs
pnpm run verify:supabase
```

### Manual verification checklist

| ID | Scenario | Expected | Pass |
|----|----------|----------|:----:|
| MS-01 | **New conversations** — new user with zero threads | Empty state; no crash; Discover CTA works | ⬜ |
| MS-02 | **Existing conversations** — user with one or many threads | List loads; previews and unread badges correct | ⬜ |
| MS-03 | **Notifications** — message notification received | Notification appears; tapping opens conversation; unread counts update | ⬜ |
| MS-04 | **Reactions** — react to a message in chat | Reaction persists; other user sees update (realtime or refresh) | ⬜ |
| MS-05 | **Multiple chats** — open several threads back-to-back | No crash; each thread loads history; back navigation clean | ⬜ |
| MS-06 | **Login / logout** — sign out and back in | Messages list loads; no orphaned subs; no duplicate typing events | ⬜ |

### Additional regression (QA sign-off June 2026)

| Scenario | Result |
|----------|--------|
| Brand-new user, zero conversations | PASS |
| User with one conversation (prior crash case) | PASS |
| User with many conversations | PASS |
| Multiple chats back-to-back | PASS |
| Rapid tab switching (Feed / Discover / Events / Messages) | PASS |
| Log out and log back in | PASS |
| Background and reopen app | PASS |
| Offline then reconnect | PASS |
| Two users messaging simultaneously | PASS |
| Online status, typing, read receipts, notifications, delivery | PASS |

---

## Sign-off log

| Date | Version | Deployment | Commit | Automated | Device QA |
|------|---------|------------|--------|-----------|-----------|
| _pending_ | v0.8.0 | _pending_ | `c2cb3f9` | PASS | PASS (June 2026 manual QA) |

---

## Rollback

Redeploy previous production bundle from commit `5f412e2` if a regression is found. Messages Realtime changes are isolated to the files listed above; no database migrations required.
