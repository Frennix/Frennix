# Frennix Training Partners — Phase 12 QA

Pre-production sign-off for Phases 4–11. **Phase 13 (production rollout) is separate.**

## Quick reference

| Item | Value |
|------|-------|
| Supabase project | `wkrwncovmpsveatlrqel` |
| Automated script | `npx tsx scripts/verify-matchmaking-qa.ts` (from `apps/mobile`) |
| Two-account runbook | [Two-account test runbook](#two-account-test-runbook) |
| Sign-off template | [Sign-off log](#sign-off-log) |

---

## Automated verification (run before device QA)

```bash
cd apps/mobile
npx tsx scripts/verify-matchmaking-qa.ts
```

Checks: migration files, RPC references, copy audit, FrennixLogo imports, remote migration sync, `send-push` deployment.

---

## Master checklist

Status key: ⬜ Not run · ✅ Pass · ❌ Fail · ⏭ N/A

### Matchmaking core

| ID | Test | iOS | Android | Web |
|----|------|-----|---------|-----|
| MM-01 | Enable discovery with complete profile → deck loads candidates | ⬜ | ⬜ | ⬜ |
| MM-02 | Skip → candidate removed, no `matches` row | ⬜ | ⬜ | ⬜ |
| MM-03 | One-way Connect → no match row, no match notification | ⬜ | ⬜ | ⬜ |
| MM-04 | Mutual Connect → match row for both, both notified | ⬜ | ⬜ | ⬜ |
| MM-05 | Matched users excluded from each other's decks | ⬜ | ⬜ | ⬜ |
| MM-06 | Gender/partner filters apply bidirectionally | ⬜ | ⬜ | ⬜ |
| MM-07 | Blocked user excluded from deck | ⬜ | ⬜ | ⬜ |
| MM-08 | Incomplete profile → discovery gate (Phase 11) | ⬜ | ⬜ | ⬜ |
| MM-09 | Banned / onboarding-incomplete users excluded | ⬜ | ⬜ | ⬜ |

### Training matches list

| ID | Test | iOS | Android | Web |
|----|------|-----|---------|-----|
| ML-01 | List sorted unread-first | ⬜ | ⬜ | ⬜ |
| ML-02 | Unread badge per row + header summary | ⬜ | ⬜ | ⬜ |
| ML-03 | Online now / last seen on rows | ⬜ | ⬜ | ⬜ |
| ML-04 | Open chat → `/chat/:id` (create or reuse) | ⬜ | ⬜ | ⬜ |
| ML-05 | Remove training match → confirm → row gone | ⬜ | ⬜ | ⬜ |
| ML-06 | Chat history remains in Messages after remove | ⬜ | ⬜ | ⬜ |
| ML-07 | Pull-to-refresh updates matches + unread | ⬜ | ⬜ | ⬜ |

### Notifications & push

| ID | Test | iOS | Android | Web |
|----|------|-----|---------|-----|
| NT-01 | In-app match notification: **New Training Match** copy | ⬜ | ⬜ | ⬜ |
| NT-02 | Realtime notification insert without refresh | ⬜ | ⬜ | ⬜ |
| NT-03 | Tap in-app match notification → chat | ⬜ | ⬜ | ⬜ |
| NT-04 | Partner message: **Training partner message** copy | ⬜ | ⬜ | ⬜ |
| PU-01 | Push received when app backgrounded (match) | ⬜ | ⬜ | N/A |
| PU-02 | Push received when app backgrounded (message) | ⬜ | ⬜ | N/A |
| PU-03 | Tap push (cold start) → correct chat | ⬜ | ⬜ | N/A |
| PU-04 | App icon badge matches unread count | ⬜ | ⬜ | N/A |
| PU-05 | Disable **Training matches** → no match push | ⬜ | ⬜ | N/A |
| PU-06 | Disable **Messages** → no partner message push | ⬜ | ⬜ | N/A |
| PU-07 | Permission banner on notification settings | ⬜ | ⬜ | N/A |

### Presence

| ID | Test | iOS | Android | Web |
|----|------|-----|---------|-----|
| PR-01 | Login → online within one heartbeat (~60s) | ⬜ | ⬜ | ⬜ |
| PR-02 | Foreground resume → online refreshed | ⬜ | ⬜ | ⬜ |
| PR-03 | Background → offline within ~2s debounce | ⬜ | ⬜ | ⬜ |
| PR-04 | Sign-out → offline immediately | ⬜ | ⬜ | ⬜ |
| PR-05 | "Online now" only within 3-minute threshold | ⬜ | ⬜ | ⬜ |
| PR-06 | Training matches presence updates without manual refresh | ⬜ | ⬜ | ⬜ |

### Safety

| ID | Test | iOS | Android | Web |
|----|------|-----|---------|-----|
| SF-01 | Block → removed from discovery deck | ⬜ | ⬜ | ⬜ |
| SF-02 | Block → removed from training matches list | ⬜ | ⬜ | ⬜ |
| SF-03 | Block → auto-unmatch | ⬜ | ⬜ | ⬜ |
| SF-04 | Unblock → does not rematch or restore deck | ⬜ | ⬜ | ⬜ |

### Settings & onboarding (Phase 11)

| ID | Test | iOS | Android | Web |
|----|------|-----|---------|-----|
| ST-01 | Onboarding → `/matching-settings?welcome=1` | ⬜ | ⬜ | ⬜ |
| ST-02 | Readiness checklist blocks discovery toggle | ⬜ | ⬜ | ⬜ |
| ST-03 | Gender/partner filters described as private | ⬜ | ⬜ | ⬜ |
| ST-04 | No dating/hearts/romance language in matching flows | ⬜ | ⬜ | ⬜ |

---

## Two-account test runbook

Use **Account A** and **Account B** on staging/production with discovery enabled and complete profiles.

### Setup (both accounts)

1. Complete onboarding (city, goals, workout style, gender).
2. Open **Settings → Training partner preferences**.
3. Enable **Show me in training partner discovery**.
4. Save preferences.
5. (Native only) Enable push on **Notification settings**.

### Test 1 — Mutual connect

1. Account A: `/matching` → Connect on Account B's card.
2. Account B: `/matching` → Connect on Account A's card.
3. **Expect:** Both see **New Training Match** modal.
4. **Expect:** Both receive in-app notification.
5. **Expect:** Both appear in `/matching/matches`.
6. **Expect:** Neither sees the other in discovery deck anymore.

### Test 2 — One-way connect

1. Use a third candidate or reset swipes in SQL (staging only).
2. Account A Connects; Account B does not reciprocate.
3. **Expect:** No match row, no match notification for either.

### Test 3 — Message + push

1. From Account A, open chat with B from matches list.
2. Send a message.
3. **Expect:** B sees **Training partner message** in notifications.
4. **Expect:** B receives push when app backgrounded (native).

### Test 4 — Remove match

1. Account A: `/matching/matches` → **Remove** on B's row → confirm.
2. **Expect:** Row gone for A; chat still in Messages.
3. **Expect:** B's list updated on refresh.

### Test 5 — Block

1. Account A blocks B from profile or chat moderation.
2. **Expect:** B gone from matches list and discovery deck.
3. Account A unblocks B.
4. **Expect:** No automatic rematch; deck unchanged (swipes retained).

---

## SQL verification (Supabase SQL editor)

```sql
-- Active training matches for a user
SELECT * FROM public.get_training_matches();

-- Match notification trigger exists
SELECT tgname FROM pg_trigger WHERE tgname = 'on_match_notify';

-- Push dispatch trigger exists
SELECT tgname FROM pg_trigger WHERE tgname = 'on_notification_push_dispatch';

-- Stale presence function exists
SELECT proname FROM pg_proc WHERE proname = 'expire_stale_presence';
```

---

## Sign-off log

| Date | Tester | Automated script | Device QA | Blockers | Approved |
|------|--------|------------------|-----------|----------|----------|
| 2026-06-20 | Agent (automated) | ✅ 27/27 PASS | ⬜ Pending human | None from automation | ⬜ |

**Automated run (2026-06-20):** `PASS: 27  FAIL: 0  MANUAL: 25`

**Production-ready when:** Automated script PASS + all device rows ✅ + no open blockers.

---

## Known gaps (post–Phase 13)

- Human device QA sign-off pending (`QA.md`)
- Privacy policy website update for matchmaking section
- Load test with production JWT optional (`scripts/load-test-match-candidates.ts`)

## Phase 13 automated results (2026-06-20)

- Migration `20250626000001_production_readiness.sql` applied
- Automated QA: run `npx tsx scripts/verify-matchmaking-qa.ts` (expect 30+ PASS)
- pg_cron: confirm `expire-stale-presence` in Supabase Dashboard → Database → Cron
