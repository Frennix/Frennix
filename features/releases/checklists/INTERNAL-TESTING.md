# Internal Testing Checklist

**Phase:** 2 of 7  
**Owner:** Engineering  
**Blocks:** Human QA (Phase 3)

Copy applicable rows into `features/releases/RELEASE-vX.Y.Z.md` and mark each item before requesting QA.

---

## Automated tests

| # | Check | Command | Pass | Notes |
|---|-------|---------|------|-------|
| 1 | Matchmaking QA (if in scope) | `npx tsx scripts/verify-matchmaking-qa.ts` | ⬜ | 0 FAIL required |
| 2 | Post-login shell (web) | `npx tsx scripts/verify-post-login.ts` | ⬜ | Run after `build:web` |
| 3 | Phase 15 feedback | `npx tsx scripts/verify-phase15.ts` | ⬜ | If feedback touched |
| 4 | Messaging Realtime | `npx tsx scripts/verify-messaging-realtime.ts` | ⬜ | If messaging touched |
| 5 | TypeScript | `npx tsc --noEmit` | ⬜ | Zero errors on touched packages |
| 6 | Web build | `npx expo export -p web && node scripts/patch-web-html.js` | ⬜ | Zero errors |
| 7 | Release gate — internal | `npx tsx scripts/verify-release-gates.ts --release <file> --phase internal` | ⬜ | Exit 0 |

---

## Database & migrations

| # | Check | Pass | Notes |
|---|-------|------|-------|
| 8 | Migration files reviewed (RLS, RPC auth, rollback SQL) | ⬜ | |
| 9 | `supabase db reset` or local migration up succeeds | ⬜ | |
| 10 | `supabase migration list` — no unexpected drift | ⬜ | |
| 11 | Enum/type additions split across transactions if needed | ⬜ | See M7.3 lesson |

---

## Analytics

| # | Check | Pass | Notes |
|---|-------|------|-------|
| 12 | New events defined in `packages/types/src/analytics.ts` | ⬜ | |
| 13 | Events fire in dev (console / Supabase `product_events`) | ⬜ | |
| 14 | Founder analytics RPCs return expected shape | ⬜ | If dashboard touched |

---

## Permissions & security

| # | Check | Pass | Notes |
|---|-------|------|-------|
| 15 | RLS policies on new/changed tables | ⬜ | |
| 16 | RPC `SECURITY DEFINER` has capability checks | ⬜ | |
| 17 | Staff/founder routes gated by capability | ⬜ | |
| 18 | No secrets in committed files | ⬜ | |

---

## Notifications & messaging

| # | Check | Pass | Notes |
|---|-------|------|-------|
| 19 | Push notification copy reviewed | ⬜ | |
| 20 | In-app notification rows render | ⬜ | |
| 21 | Realtime subscribe/unsubscribe lifecycle clean | ⬜ | |
| 22 | Message send/receive in dev | ⬜ | |

---

## Build quality

| # | Check | Pass | Notes |
|---|-------|------|-------|
| 23 | No console.error in touched flows (dev) | ⬜ | |
| 24 | No linter errors on changed files | ⬜ | |
| 25 | Bundle size change documented if >10% | ⬜ | |

---

## Sign-off

| Role | Name | Date | Approved |
|------|------|------|----------|
| Engineering | | | ⬜ |

**All rows must be ✅ before proceeding to Human QA.**
