# Training partners — security review (Phase 13)

Audit date: 2026-06-20  
Scope: `matches`, `match_swipes`, `notifications` RLS and RPC access paths.

## Summary

| Table | Client access | Mutations | Verdict |
|-------|---------------|-----------|---------|
| `matches` | SELECT own rows only | Via `record_match_swipe`, `remove_training_match` RPCs (SECURITY DEFINER) | ✅ Secure |
| `match_swipes` | SELECT own rows only (Phase 13) | Via `record_match_swipe` RPC only | ✅ Hardened |
| `notifications` | SELECT + UPDATE own rows | INSERT via SECURITY DEFINER triggers only | ✅ Secure |

**No changes to match, message, or notification row data.** Phase 13 RLS change closes a bypass where clients could insert swipes directly without RPC validation.

---

## matches

**Policies (unchanged):**
- `Users view own matches` — SELECT where `user_a` or `user_b` = `auth.uid()`

**Mutations:**
- `record_match_swipe` — creates/updates match on mutual connect
- `remove_training_match` — sets `status = 'unmatched'`
- `handle_block` trigger — sets `status = 'unmatched'` on block

All mutation RPCs/triggers run as SECURITY DEFINER. Clients cannot INSERT/UPDATE/DELETE match rows directly.

---

## match_swipes

**Before Phase 13:**
- `Users manage own swipes` — FOR ALL (client could INSERT swipes bypassing RPC checks)

**After Phase 13 (`20250626000001_production_readiness.sql`):**
- `Users view own swipes` — SELECT only where `swiper_id = auth.uid()`

**Impact:** Normal app flow unchanged — all swipes go through `record_match_swipe`. Existing swipe rows untouched.

---

## notifications

**Policies (unchanged):**
- `View own notifications` — SELECT where `user_id = auth.uid()`
- `Update own notifications` — UPDATE where `user_id = auth.uid()`

**INSERT:** No client INSERT policy. Rows created by SECURITY DEFINER triggers (`notify_on_match`, `notify_on_message`, etc.).

---

## RPC grants (authenticated)

| RPC | Purpose |
|-----|---------|
| `get_match_candidates` | Discovery deck |
| `record_match_swipe` | Connect / Skip |
| `get_training_matches` | Matches list |
| `remove_training_match` | Remove match |
| `set_presence` | Online/offline |
| `expire_stale_presence` | Stale cleanup (cron) |

Verified via migration GRANT statements and `scripts/verify-matchmaking-qa.ts`.

---

## Triggers (production pipeline)

| Trigger | Table | Purpose |
|---------|-------|---------|
| `on_match_notify` | `matches` | In-app match notifications |
| `on_notification_push_dispatch` | `notifications` | Push via `send-push` edge function |

---

## Privacy notes (external policy)

The public privacy policy at `https://frennix.app/privacy` should document:

- Training partner discovery is opt-in (`matching_enabled`)
- Gender and partner filters are private (not shown on public profile)
- Match data retained until unmatch; chat history independent
- Block removes active training match

*Website update is outside the mobile repo.*
