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
| 8 | Bug severity docs wired | `npm run verify:bug-severity` | ⬜ | [`BUG-SEVERITY.md`](../BUG-SEVERITY.md) |
| 9 | Postmortem docs wired | `npm run verify:postmortem` | ⬜ | [`POSTMORTEM-PROCESS.md`](../POSTMORTEM-PROCESS.md) |

After all applicable rows pass, produce the **Release Readiness Report** (Phase 2.5) before requesting Human QA.

---

## Database & migrations

| # | Check | Pass | Notes |
|---|-------|------|-------|
| 10 | Migration files reviewed (RLS, RPC auth, rollback SQL) | ⬜ | |
| 11 | `supabase db reset` or local migration up succeeds | ⬜ | |
| 12 | `supabase migration list` — no unexpected drift | ⬜ | |
| 13 | Enum/type additions split across transactions if needed | ⬜ | See M7.3 lesson |

---

## Analytics

| # | Check | Pass | Notes |
|---|-------|------|-------|
| 14 | New events defined in `packages/types/src/analytics.ts` | ⬜ | |
| 15 | Events fire in dev (console / Supabase `product_events`) | ⬜ | |
| 16 | Founder analytics RPCs return expected shape | ⬜ | If dashboard touched |

---

## Permissions & security

| # | Check | Pass | Notes |
|---|-------|------|-------|
| 17 | RLS policies on new/changed tables | ⬜ | |
| 18 | RPC `SECURITY DEFINER` has capability checks | ⬜ | |
| 19 | Staff/founder routes gated by capability | ⬜ | |
| 20 | No secrets in committed files | ⬜ | |

---

## Notifications & messaging

| # | Check | Pass | Notes |
|---|-------|------|-------|
| 21 | Push notification copy reviewed | ⬜ | |
| 22 | In-app notification rows render | ⬜ | |
| 23 | Realtime subscribe/unsubscribe lifecycle clean | ⬜ | |
| 24 | Message send/receive in dev | ⬜ | |

---

## Build quality

| # | Check | Pass | Notes |
|---|-------|------|-------|
| 25 | No console.error in touched flows (dev) | ⬜ | |
| 26 | No linter errors on changed files | ⬜ | |
| 27 | Bundle size change documented if >10% | ⬜ | |

---

## Sign-off

| Role | Name | Date | Approved |
|------|------|------|----------|
| Engineering | | | ⬜ |

**All rows must be ✅ before producing the Release Readiness Report.**

### Phase 2.5 deliverable — Release Readiness Report

| # | Task | Done |
|---|------|------|
| 28 | Copy [`templates/RELEASE-READINESS-REPORT-TEMPLATE.md`](../templates/RELEASE-READINESS-REPORT-TEMPLATE.md) → `RELEASE-vX.Y.Z-READINESS.md` | ⬜ | |
| 29 | Fill all sections: tests, build, migrations, perf, security, risks, recommendation | ⬜ | |
| 30 | Link report from release file; mark **Release readiness report delivered** ✅ | ⬜ | |
| 31 | Deliver report to Founder for review **before** Human QA | ⬜ | |

**Human QA (Phase 3) must not begin until the Founder reviews the readiness report and approves Phase 3.**
