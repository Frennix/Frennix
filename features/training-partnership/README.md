# Training Partner Journey

Modular architecture for dyadic training partnerships — distinct from personal Frennix Journey (training calendar roadmap) and pre-match **Frennix Match** compatibility scoring.

## Product flow

1. **Mutual Connect** → bootstrap `training_partnerships` row + `partnership_started` milestone.
2. **Intro screen** (`/matching/journey/[matchId]/intro`) — each user sees **Your Training Partner Journey Begins** once.
3. **Start Your Journey** → records per-user intro completion in `training_partnership_intro_views`.
4. **Compatibility Timeline** (`/matching/journey/[matchId]`) — living history with date, time, optional location, and trigger metadata.

## Layers

| Layer | Path | Responsibility |
|-------|------|----------------|
| Types | `packages/types/src/training-partnership.ts` | Milestone codes, metadata, level ids, journey DTOs |
| Domain | `packages/matching/src/partnership/` | Level thresholds, milestone catalog, timeline builder |
| API | `packages/api/src/training-partnership.ts` | RPC calls, route resolution |
| DB | `supabase/migrations/20260729000001_training_partner_journey.sql` | Partnership rows, milestones, intro views, RPCs |
| UI | `app/matching/journey/[matchId]/*`, `components/Partnership*.tsx` | Intro + timeline screens |

## Partnership integrity

- One `training_partnerships` row per `match_id` (shared timeline for both users).
- `matches` already enforces `UNIQUE (user_a, user_b)` — no duplicate partnerships between the same pair.
- Milestones are unique per `(match_id, milestone_code)`.
- Intro completion is per `(match_id, user_id)`.

## Security model

- Tables are **SELECT-only** under RLS via `user_can_access_match()` (matched status + participant + not blocked).
- All writes go through `SECURITY DEFINER` RPCs.
- Milestone awards use `internal_award_partnership_milestone()` with `validate_partnership_milestone_eligibility()`.
- Clients cannot call raw milestone insert RPCs.

## Milestone metadata (extensible)

Each milestone stores JSON metadata:

```json
{
  "trigger_source": "conversation_sync",
  "location_label": "Austin, TX",
  "links": {
    "workout_id": null,
    "challenge_id": null,
    "event_id": null,
    "photo_url": null
  },
  "celebration": null
}
```

Future features (photos, workout/challenge/event links, animations, AI insights) attach here without schema migrations.

## Active milestone detectors (v1)

- **partnership_started** — match trigger / bootstrap RPC (server-validated)
- **first_conversation** — server sync when both users have exchanged real DM messages (non-empty content, media, or post share; not deleted-for-everyone)

Additional milestones render as **upcoming** story beats until detectors ship.

## Verification

```bash
pnpm verify:training-partner-journey
pnpm verify:training-partner-notifications
pnpm verify:partnership-timeline
```
