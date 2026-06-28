# Frennix v0.8.0 – Messaging Stability

| Field | Value |
|-------|-------|
| **Version** | 0.8.0 |
| **Release date** | 2026-06-28 |
| **Commit** | `c2cb3f947b1ad7205690a84f3f2b4bc343b13a9a` |
| **Git tag** | `v0.8.0` |
| **Production URL** | https://frennix.vercel.app |
| **Web bundle** | `index-623f4d405879707a92a881e88293ab6e.js` |
| **Scope** | Option A — Messaging Stability only |

---

## Summary

Frennix v0.8.0 fixes a critical Messages crash affecting users with exactly one conversation, hardens Supabase Realtime subscription lifecycle across presence, messages, typing, and reactions, and ensures chat remains fully usable when live updates fail. Historical messages, send, and read receipts continue to work via REST.

UI polish (safe-area, tab shell, skeletons) is intentionally excluded from this release and scheduled for the next milestone.

---

## Features added

- Unique Realtime channel topics per subscription (`allocRealtimeTopic`)
- Shared `subscribePostgresChanges` helper — all handlers registered before `subscribe()`
- Graceful degraded-mode banners on Messages list and Chat screen
- Messaging realtime state reset on sign-out
- Static + live verification scripts for duplicate subscription regression

---

## Bugs fixed

| Bug | Impact |
|-----|--------|
| Messages tab crash for single-conversation users | Critical — `cannot add postgres_changes callbacks after subscribe()` |
| Duplicate Realtime subscriptions (list + chat presence collision) | High |
| Presence subscription errors crashing the tab | High |
| Message history dependent on Realtime availability | Medium |
| Orphaned typing channels after logout | Low |
| Duplicate typing listeners on rapid resubscribe | Low |

---

## Known issues

1. UI polish pass (safe-area, dark theme edge-to-edge, loading skeletons) — deferred to next milestone.
2. `subscribeToNotifications` uses a stable topic — safe today (single instance) but not yet migrated to unique-topic pattern.
3. Post Interaction Sheet device QA (PI-03–PI-13) pending on some platforms.

---

## QA checklist completed

### Automated
- [x] `node scripts/verify-messaging-realtime.mjs`
- [x] `pnpm run verify:supabase` (duplicate presence subscriptions)
- [x] `npx expo export -p web` (build succeeds)

### Manual (June 2026)
- [x] New user, zero conversations
- [x] User with one conversation (prior crash case)
- [x] User with many conversations
- [x] Multiple chats back-to-back
- [x] Rapid tab switching
- [x] Log out and log back in
- [x] Background and reopen
- [x] Offline then reconnect
- [x] Two users messaging simultaneously
- [x] Online status, typing, read receipts, notifications, delivery

---

## Rollback plan

1. Redeploy previous Vercel production deployment (commit `5f412e2` or prior known-good `dpl_`).
2. No database migrations — rollback is app-only.
3. Monitor Sentry and `beta_feedback` for 24 hours post-deploy.

```bash
cd apps/mobile
git checkout 5f412e2 -- dist/
npx vercel --prod --yes --project frennix
```

---

## Sign-off log

| Date | Deployment ID | Automated | Device QA | Notes |
|------|---------------|-----------|-----------|-------|
| 2026-06-28 | _recorded at deploy_ | PASS | PASS | Option A — messaging only |

---

## Technical files changed (commit c2cb3f9)

- `packages/api/src/realtime-utils.ts` (new)
- `packages/api/src/presence.ts`
- `packages/api/src/messaging.ts`
- `packages/api/src/reactions.ts`
- `lib/useProfilesPresence.ts`
- `app/(tabs)/messages.tsx`
- `app/chat/[conversationId].tsx`
- `providers/AuthProvider.tsx`
- `scripts/verify-messaging-realtime.mjs` (new)
- `scripts/verify-supabase-init.ts`
- `dist/` (web production bundle)
