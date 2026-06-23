# Training partners (matching)

Fitness networking — not dating. Use **Training partners**, **Connect**, **Training match** language in UI.

## Phase 4 — Training partner preferences (live)

| File | Purpose |
|------|---------|
| `app/matching-settings.tsx` | Discovery toggle, gender & partner filters, training profile preview |
| `app/settings.tsx` | Settings → Training partners section |
| `lib/matching-preferences.ts` | Labels and filter constants |

**Route:** `/matching-settings` · **API:** `setMatchingEnabled`, `updateProfile`

## Phase 5 — Discovery deck (live)

| File | Purpose |
|------|---------|
| `app/matching/index.tsx` | Training partner discovery deck |
| `components/TrainingPartnerCard.tsx` | Athlete card — goals, workout styles, shared interests, city |
| `components/TrainingMatchModal.tsx` | Training match confirmation + message CTA |
| `lib/training-partner-utils.ts` | Shared interest helpers |

**Route:** `/matching` · **API:** `getMatchCandidates`, `recordMatchSwipe`, `getOrCreateConversation`

## Phase 6 — Training matches list (live)

| File | Purpose |
|------|---------|
| `app/matching/matches.tsx` | Training matches list with unread + presence |
| `components/TrainingMatchRow.tsx` | Match row — avatar, online/last active, unread badge, Open chat |
| `lib/training-match-rows.ts` | Enrich matches with conversations + sort |

**Route:** `/matching/matches` · **API:** `getMatches`, `getConversations`, `getOrCreateConversation` → `/chat/:id`

**Indicators:** Unread message badge per row + summary header · Online now / last active via `formatPresenceStatus`

## Phase 7 — Presence hardening (live)

Realtime profile presence, stale cleanup, foreground heartbeat, background offline.

## Phase 8 — Match notifications & deep links (live)

| File | Purpose |
|------|---------|
| `components/FrennixNotificationRow.tsx` | Two-line headline + detail rows with Frennix branding |
| `lib/notification-navigation.ts` | Match tap → chat via `getOrCreateConversation`; push deep links |
| `lib/useNotificationSubscription.ts` | Realtime inserts with actor enrichment + match/message invalidation |
| `app/notifications.tsx` | Notifications center with training match copy |
| `supabase/migrations/20250624000002_training_match_message_notifications.sql` | `from_training_match` flag on message notifications |
| `supabase/functions/send-push/index.ts` | Push copy for training matches + partner messages |

**Notification copy:**
- Training match: **New Training Match** / **You and [name] are ready to train together.**
- Partner message: **Training partner message** / **[name]: [preview]**

**Deep links:** Match notification → `/chat/:id` (fallback `/matching/matches`) · Message → `/chat/:conversationId`

**Settings:** Notification preferences include **Training matches** toggle (`match` key).

## Phase 9 — Push production hardening (live)

| File | Purpose |
|------|---------|
| `lib/notifications.ts` | Permission helpers, type-aware push invalidation, badge sync on receive |
| `app/_layout.tsx` | Refresh training-matches / conversations when push arrives |
| `app/notification-settings.tsx` | Permission banner, enable flow, clearer toggle copy |
| `app/settings.tsx` | Notification settings link hint |
| `packages/api/src/notification-preferences.ts` | Training match vs message toggle descriptions |

**Push receive:** `match` push → invalidates training-matches + notifications · `message` push → invalidates conversations + unread-messages

**Permission UX:** Banner when push disabled · Enable button · Open device settings when denied

**Toggle clarity:** Training matches = mutual connect alerts · Messages = all DMs including training partners

## Phase 10 — Match removal & blocking (live)

| File | Purpose |
|------|---------|
| `supabase/migrations/20250625000001_training_match_removal_and_block.sql` | `remove_training_match` RPC, `get_training_matches` RPC, block auto-unmatch |
| `packages/api/src/matching.ts` | `removeTrainingMatch`, server-filtered `getMatches` |
| `components/TrainingMatchRow.tsx` | Remove training match action per row |
| `app/matching/matches.tsx` | Confirm dialog + remove mutation |
| `lib/alerts.ts` | `confirmRemoveTrainingMatch` fitness copy |
| `lib/useModeration.tsx` | Invalidate training-matches on block |

**Remove match:** Sets `status = 'unmatched'` · Chat history kept in Messages · Swipes retained (no re-deck)

**Block:** Auto-unmatches active training match · Blocked users excluded from matches list server-side · Unblock does not rematch

## Phase 11 — Settings refinement (live)

| File | Purpose |
|------|---------|
| `lib/training-partner-readiness.ts` | Profile readiness rules for discovery |
| `components/TrainingPartnerReadinessCard.tsx` | Checklist UI for missing profile items |
| `app/matching-settings.tsx` | Private filter copy, readiness gate, onboarding welcome |
| `app/matching/index.tsx` | Block deck when profile incomplete |
| `app/onboarding.tsx` | Training partner copy, required city/goals/activities, → preferences |
| `app/settings.tsx` | Hint text under training partner links |
| `components/TrainingMatchModal.tsx` | "New Training Match" title alignment |

**Discovery gate:** Requires gender, ≥1 goal, ≥1 workout style, and city before enabling discovery

**Onboarding flow:** Completes → `/matching-settings?welcome=1` with optional skip to feed

## Phase 12 — Pre-production QA (live)

| File | Purpose |
|------|---------|
| `features/matching/QA.md` | Master checklist, two-account runbook, sign-off log |
| `scripts/verify-matchmaking-qa.ts` | Automated migration/copy/deploy verification |

## Phase 13 — Production readiness (live)

| File | Purpose |
|------|---------|
| `supabase/migrations/20250626000001_production_readiness.sql` | pg_cron stale presence + match_swipes RLS hardening |
| `lib/matchmaking-observability.ts` | Sentry tags for match/presence/push errors |
| `features/matching/SECURITY.md` | RLS audit documentation |
| `features/matching/PRODUCTION.md` | Rollout, monitoring, rollback guide |
| `scripts/load-test-match-candidates.ts` | Read-only RPC load test |

**Monitoring:** Sentry `matchmaking_domain` tags — no user-facing behavior changes

**Security:** `match_swipes` SELECT-only for clients; mutations via RPC only

**Cron:** `expire-stale-presence` every 5 minutes (updates `profiles.is_online` only)

**Data safety:** No match, message, or notification rows modified or deleted

---

## Roadmap — after production (not started)

Phases 4–13 cover **peer training partner** matching (athlete ↔ athlete). The following is planned **after** production sign-off. **Do not build until explicitly approved.**

### Phase 14 — Trainer Matching (future)

**Goal:** Trainers create trainer profiles; users looking for a coach have a dedicated place to find and connect with trainers who fit their needs.

**Separate from training partners:** Trainer Matching is its own section — not the existing `/matching` peer discovery deck.

| # | Requirement |
|---|-------------|
| 1 | **Trainer profile type** — distinct from regular athlete profiles |
| 2 | **Trainer profile fields** — bio, specialties, certifications, location, availability, pricing/packages |
| 3 | **User filters** — goal, training style, location, budget, online vs in-person |
| 4 | **Trainer discovery section** — separate UI/routes from training partner discovery |
| 5 | **Match or request-to-connect flow** — trainer ↔ client connection (TBD: mutual match vs request/approve) |
| 6 | **Messaging after match** — chat opens once trainer and user connect |
| 7 | **Trust & safety review** — verification, reporting, block integration, policy review before launch |

**Language:** Professional fitness coaching — not dating. No romance/hearts wording.

**Likely new surfaces (TBD at kickoff):**
- `/trainers` or `/trainer-matching` — client discovery
- `/trainer-profile` — trainer onboarding & profile edit
- `/trainer-matches` — active trainer–client connections
- Settings entry separate from **Training partners**

**Dependencies:** Phase 13 production sign-off · human device QA · privacy policy update

**Full spec:** [`TRAINER-MATCHING.md`](./TRAINER-MATCHING.md)
