# Release v1.0.0 — Training Partners (Production Ready)

**Status:** Draft — do not tag or deploy without founder approval  
**Milestone:** P1  
**Target date:** TBD

---

## Summary

First production-ready core feature: **Training Partner Matchmaking**. Athletes can discover compatible training partners, connect, match, and message — with safety controls, analytics, and a global kill switch.

---

## Features added

- Training partner discovery deck (Connect / Skip)
- Compatibility scoring with match % and “Why we matched you”
- Optional training compatibility profile (skill, schedule, environment, home gym)
- In-deck report and block
- Product analytics: skip, connect, deck loaded/empty, perf timing
- Feature flag `training_matchmaking` for emergency rollback
- Accessibility improvements on matching screens

---

## Bugs fixed

- (None in this release — builds on v0.8.0 Messaging stability)

---

## Known issues

- Human device QA sign-off pending
- Privacy policy update on external website pending
- Gesture swipe deck deferred to post-P1
- Geo/distance matching requires lat/lng (future)

---

## Migrations

- `20250630000014_matching_scoring_phase_a.sql` (if not applied)
- `20250704000001_p1_training_matchmaking_flag.sql`

---

## Rollback plan

1. Set `training_matchmaking` flag to `enabled_globally = false` in Supabase
2. Or revert client deploy — matches and messages preserved
3. Monitor Sentry `matchmaking_domain` tags for 24–48h post-deploy

---

## QA

- Automated: `npx tsx scripts/verify-matchmaking-qa.ts`
- Manual: `features/matching/QA.md` (including A11Y + SF-05)

---

## Approval checklist

See [`matching/P1-RELEASE-CHECKLIST.md`](./matching/P1-RELEASE-CHECKLIST.md)
