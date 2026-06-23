# Training partners — production rollout (Phase 13)

Production readiness for Phases 4–12. **No new matchmaking features.**

## Pre-launch checklist

| Step | Command / action | Status |
|------|------------------|--------|
| Apply migrations | `cd /Users/startswithu/Source/frennix && supabase db push` | Run before launch |
| Verify migrations synced | `supabase migration list` | All local = remote |
| Verify `send-push` | `supabase functions list` | ACTIVE |
| Automated QA | `cd apps/mobile && npx tsx scripts/verify-matchmaking-qa.ts` | 27+ PASS |
| RLS review | Read `features/matching/SECURITY.md` | Documented |
| Device QA | Complete `features/matching/QA.md` sign-off | Human tester |
| pg_cron job | Supabase Dashboard → Database → Cron → `expire-stale-presence` | Every 5 min |

## What Phase 13 changed

| Change | User impact |
|--------|-------------|
| pg_cron `expire_stale_presence` | Stale `is_online` cleared — more accurate presence |
| `match_swipes` RLS SELECT-only | No client-visible change — swipes still via RPC |
| Sentry tags on match/presence/push errors | None — monitoring only |

**Not changed:** discovery deck, chat, notifications, match data, messages.

## Monitoring (Sentry)

Errors tagged with `matchmaking_domain`:

| Tag | Source |
|-----|--------|
| `match_swipe` | Connect / Skip RPC failures |
| `match_list` | Load matches failures |
| `match_remove` | Remove training match failures |
| `match_candidates` | Discovery candidate load failures |
| `presence` | Presence RPC failures |
| `push_registration` | Expo push token registration failures |

**Watch after launch:**
- Spike in `match_swipe` errors → RPC or auth issue
- Spike in `push_registration` → Expo/project config
- Spike in `presence` → `set_presence` or session issue

## Rollback

| Issue | Action |
|-------|--------|
| Discovery broken | Check Supabase logs for RPC errors; no app update needed |
| Push not delivering | Redeploy `send-push`; verify `on_notification_push_dispatch` trigger |
| Presence stuck online | Confirm `expire-stale-presence` cron job running |
| Emergency disable discovery | Ask users to turn off in preferences; no global kill switch in Phase 13 |

**Data safety:** Rollback steps do not delete matches, messages, or notifications.

## Load testing

Read-only stress test for `get_match_candidates`:

```bash
cd apps/mobile
# Requires TEST_USER_JWT env var (authenticated user with matching_enabled)
npx tsx scripts/load-test-match-candidates.ts
```

Or run in Supabase SQL editor (as authenticated user via RPC):

```sql
SELECT COUNT(*) FROM public.get_match_candidates(20);
```

Run 50–100 sequential calls; watch query duration in Supabase Dashboard → Reports.

## Privacy policy (external)

Update `https://frennix.app/privacy` to cover training partner discovery (see `SECURITY.md`).

## Sign-off

Production-ready when:

1. ✅ Automated QA script PASS  
2. ✅ Phase 13 migration applied  
3. ✅ pg_cron job confirmed  
4. ⬜ Human device QA complete (`QA.md`)  
5. ⬜ Privacy policy updated (website)

---

## Future roadmap

**Phase 14 — Trainer Matching** (not started): dedicated trainer profiles, client discovery/filters, connect flow, messaging, trust & safety. See [`TRAINER-MATCHING.md`](./TRAINER-MATCHING.md).
