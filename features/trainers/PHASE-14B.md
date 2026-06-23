# Phase 14B — Trainer Leads Dashboard (planning)

**Status:** Planning only — not approved for build.  
**Prerequisite:** Phase 14A trainer matching validated by real users.

---

## Goal

Give trainers a dedicated dashboard to understand inbound interest and manage coaching leads — without payments, booking, or subscriptions.

---

## Trainer Leads Dashboard

A trainer-only screen (separate from `/trainers/connections` athlete view) surfacing:

| Metric / section | Description |
|------------------|-------------|
| **Profile views** | How many athletes viewed the trainer’s public profile (time range TBD) |
| **Connection requests** | Pending coaching requests awaiting accept/decline |
| **Accepted connections** | Active coaching clients connected via request-to-connect |
| **Messages received** | Inbound DMs from connected clients (count + recent preview) |

### UX notes

- Entry from Settings → **Trainer leads** (trainers only)
- Fitness/coaching language — **Coaching request**, **Connected client**, **New message**
- Reuse existing connection + messaging infrastructure from Phase 14A
- Deep links from dashboard rows to `/trainers/connections`, `/chat/:id`, `/trainer/[username]`

### Data / implementation sketch (when approved)

- `trainer_profile_views` table or aggregated events for profile view counts
- RPC `get_trainer_leads_summary(trainer_id)` returning counts + recent items
- Optional: mark profile view on `/trainer/[username]` load (deduped per viewer/day)

---

## Explicitly out of Phase 14B (unless separately approved)

- Payments / payment processing
- Booking calendar / session scheduling
- Subscriptions / premium trainer tiers
- Featured placement purchases
- Review / ratings UI (schema exists from 14A; UI deferred)

---

## Approval gate

Do **not** start Phase 14B until:

1. Phase 14A production sign-off complete
2. Explicit **“Proceed with Phase 14B”** approval
3. Product sign-off on profile view tracking privacy copy
