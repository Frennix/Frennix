# Real User Testing — Invited Beta Program

**Phase 15** · Invited beta users (not internal-only)

---

## Goal

Validate **Training Partners**, **Trainer Matching**, **Messaging**, **Events**, and **Notifications** with real athletes and trainers before building Phase 14B or other major features.

---

## Cohort (suggested)

| Group | Count | Invite focus |
|-------|-------|--------------|
| Athletes — Training Partners | 10–20 | Local gym / run club contacts |
| Athletes — Find Trainer | 10–15 | People actively looking for a coach |
| Trainers | 5–10 | Certified or experienced coaches willing to set up a profile |
| Two-device pairs | 3–5 | Friends who can test connect + chat same day |

---

## Invite checklist

- [ ] Send TestFlight / APK / Expo preview link
- [ ] Share link to **Settings → Send feedback**
- [ ] Ask testers to complete their profile (city, goals, activities)
- [ ] Trainers: **Settings → Become a trainer** or **Trainer profile**
- [ ] Confirm push notifications enabled on device
- [ ] Point athletes to **Discover → Find a trainer** and **Settings → Find training partners**

---

## Session scripts

| Flow | Runbook |
|------|---------|
| Training Partners | [TRAINING-PARTNERS-RUT.md](./TRAINING-PARTNERS-RUT.md) |
| Trainer Matching | [TRAINER-MATCHING-RUT.md](./TRAINER-MATCHING-RUT.md) |
| Messaging | [MESSAGING-RUT.md](./MESSAGING-RUT.md) |
| Events | [EVENTS-RUT.md](./EVENTS-RUT.md) |
| Notifications | [NOTIFICATIONS-RUT.md](./NOTIFICATIONS-RUT.md) |

---

## Sign-off

Use [SIGN-OFF-TEMPLATE.md](./SIGN-OFF-TEMPLATE.md) per tester.

**Exit criteria (Phase 15 complete):**
- ≥10 athlete testers completed Training Partners critical path
- ≥5 athletes + ≥3 trainers completed Trainer Matching critical path
- All P0 bugs resolved; P1 triaged
- Analytics show non-zero activity for matches, messages, and/or trainer requests over 2+ weeks

---

## Admin tools

| Tool | Path |
|------|------|
| Product analytics | Settings (admin) → Product analytics |
| Feedback triage | Settings (admin) → Feedback dashboard |
| Automated checks | `npx tsx scripts/verify-phase15.ts` |
