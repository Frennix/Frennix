# v1.0.1 Stabilization Period

**Status:** Active  
**Started:** 2026-07-04  
**Ends:** 2026-07-06 (48 hours)  
**Production:** https://frennix.vercel.app  
**Commit:** `88e4b88cf032aa59f6f9d0007370cb725490d64e`  
**Tag:** `v1.0.1`

---

## Priority

**Stability only — no new features** until the stabilization window closes.

| Do | Don't |
|----|-------|
| Fix production bugs users report | Ship roadmap features (partner rails, circles, seasons) |
| Patch crashes and P0/P1 regressions | Start Calendar v1.1 milestone work |
| Improve user-facing error messages | Refactors unrelated to reported issues |
| Document every issue in the bug list | Merge speculative enhancements |

**Bug list:** [`v1.0.2-BUG-LIST.md`](./v1.0.2-BUG-LIST.md)

---

## Critical flow smoke tests

Run on **production** (https://frennix.vercel.app) — iPhone Safari + desktop web minimum.

| # | Flow | Route / entry | 0–24h | 24–48h | Notes |
|---|------|---------------|-------|--------|-------|
| 1 | **Login** | `/login` → feed | ⬜ | ⬜ | No black screen post-login |
| 2 | **Signup** | `/signup` → onboarding | ⬜ | ⬜ | |
| 3 | **Feed** | `/(tabs)` | ⬜ | ⬜ | Posts load, scroll, interactions |
| 4 | **Messages** | `/(tabs)/messages` | ⬜ | ⬜ | List, open chat, send message |
| 5 | **Notifications** | `/notifications` | ⬜ | ⬜ | Open, dismiss, deep links |
| 6 | **Calendar** | `/(tabs)/events` | ⬜ | ⬜ | Today's Focus, month/week, create session |
| 7 | **Events** | `/events/browse` | ⬜ | ⬜ | Community events browse |
| 8 | **Stories** | Feed stories row, `/create-story` | ⬜ | ⬜ | View, create, engage |
| 9 | **Workout sharing** | Create post / share workout | ⬜ | ⬜ | Log + share flows |
| 10 | **Profile editing** | `/edit-profile` | ⬜ | ⬜ | Save changes persist |
| 11 | **Matching** | `/(tabs)/discover` | ⬜ | ⬜ | Discover, filters, match display |

---

## Infrastructure checks

| # | Check | Status | Date | Notes |
|---|-------|--------|------|-------|
| 1 | Supabase migrations synced (local = remote) | ✅ | 2026-07-04 | 77/77 migrations matched |
| 2 | Production deploy healthy | ✅ | 2026-07-04 | `dpl_5g2gLSwpsNz5MhdRHyb3SBMDAfHe` |
| 3 | Bundle hash matches v1.0.1 | ✅ | 2026-07-04 | `index-f6791dbeee27440f70af2f38d78cb107.js` |
| 4 | Automated verify scripts pass | ✅ | 2026-07-04 | post-login, audit-shell, training-calendar |

### Automated verification commands

```bash
npx tsx scripts/audit-post-login-shell.ts
npx tsx scripts/verify-post-login.ts
npx tsx scripts/verify-training-calendar.ts
npx supabase migration list
```

---

## Error handling rules (48h)

1. **Never expose technical errors to users** — no raw `error.message`, stack traces, HTTP codes, or Supabase/Postgres errors in UI.
2. **Replace with friendly copy** — use `lib/alerts.ts` helpers or localized fallback strings.
3. **Log technical detail server-side / console** — Sentry, founder dashboard, or dev logs only.
4. **Every production issue** → add row to [`v1.0.2-BUG-LIST.md`](./v1.0.2-BUG-LIST.md) before fixing.

---

## Monitoring schedule

| Window | Focus |
|--------|-------|
| **0–2h** | Immediate smoke re-check; error rate baseline |
| **2–24h** | User reports; Beta Feedback queue; flow regressions |
| **24–48h** | Trend analysis; bug list triage; stabilization sign-off |

See also: [`checklists/POST-RELEASE-MONITORING.md`](./checklists/POST-RELEASE-MONITORING.md)

---

## Stabilization sign-off (after 48h)

| Gate | Pass |
|------|------|
| No open P0 bugs | ⬜ |
| P1 bugs triaged (fix or defer to v1.0.2) | ⬜ |
| Critical flows smoke-tested twice | ⬜ |
| Migrations confirmed synced | ⬜ |
| Founder approves exit from stabilization | ⬜ |

**Exit phrase:** *"v1.0.1 stabilization complete — approved to begin next milestone."*

---

## Related

- [`RELEASE-HISTORY.md`](./RELEASE-HISTORY.md)
- [`RELEASE-v1.0.1.md`](./RELEASE-v1.0.1.md)
- [`v1.0.2-BUG-LIST.md`](./v1.0.2-BUG-LIST.md)
- [`../training-calendar/ROADMAP.md`](../training-calendar/ROADMAP.md) — deferred until stabilization ends
