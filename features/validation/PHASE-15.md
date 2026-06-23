# Phase 15 — Real User Validation

**Status:** Implemented  
**Analytics:** Supabase `product_events` table  
**Testing:** Invited beta users (see runbooks)

---

## Principle

No new major user-facing features until real users validate **Training Partners** and **Trainer Matching**. Phase 14B remains blocked until Phase 15 exit criteria are met.

---

## What was built

### Analytics (Supabase events)

| Metric | Event name | Source |
|--------|------------|--------|
| Signups | `user_signed_up` | DB trigger on `profiles` insert |
| Daily active users | `daily_active_user` | Client (`track_daily_active_user`, once/day) |
| Training Partner matches | `training_partner_match` | DB trigger on `matches` |
| Trainer connection requests | `trainer_connection_requested` | DB trigger on `trainer_connections` |
| Trainer connections accepted | `trainer_connection_accepted` | DB trigger on `trainer_connections` |
| Messages sent | `message_sent` | DB trigger on `messages` |
| Events joined | `event_joined` | DB trigger on `event_attendees` |
| Screen / feed / messaging perf | `perf_*` | Client |

**Admin dashboard:** Settings (admin) → **Product analytics** (`/admin-analytics`)

### Feedback

- **Report a bug** · **Suggest a feature** · **General feedback** (`/beta-feedback`)
- Feature area + screen path + app version auto-attached
- Contextual **Report an issue** links on matching, trainers, messages, events
- Admin dashboard filters by type, status, feature area

### Performance

- Client: screen load, feed load, messaging load events
- Scripts: `measure-feed-perf.ts`, `measure-messaging-perf.ts`, `measure-trainer-search-perf.ts`
- Baselines: [PERFORMANCE.md](./PERFORMANCE.md)

### Testing (invited beta)

- [REAL-USER-TESTING.md](./REAL-USER-TESTING.md) — cohort + invite checklist
- Runbooks: Training Partners, Trainer Matching, Messaging, Events, Notifications
- [SIGN-OFF-TEMPLATE.md](./SIGN-OFF-TEMPLATE.md)

---

## Migration

`supabase/migrations/20250629000001_phase15_analytics_and_feedback.sql`

## Verification

```bash
cd apps/mobile && npx tsx scripts/verify-phase15.ts
```

---

## Exit criteria

- [ ] ≥10 athlete testers — Training Partners critical path
- [ ] ≥5 athletes + ≥3 trainers — Trainer Matching critical path
- [ ] 2+ weeks analytics with real usage
- [ ] P0 bugs resolved; P1 triaged
- [ ] Performance baselines recorded

**Then:** Product gate for Phase 14B or other features.

---

## Related

- [PHASE-14B](../trainers/PHASE-14B.md) — planning only, blocked
- [features/matching/QA.md](../matching/QA.md)
