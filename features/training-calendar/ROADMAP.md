# Training Calendar — Product Roadmap

**Status:** Post–v1 enhancements (do not block current release)  
**Last updated:** 2026-07-04  
**Current release focus:** QA, stability, and polish for Training Calendar v1 on staging

**Daily dashboard spec:** [`DAILY-FITNESS-DASHBOARD.md`](./DAILY-FITNESS-DASHBOARD.md)

---

## v1 (current release — in QA)

Shipped on `hotfix/v1.0.1-safari-tab-layout` / staging:

- Personal Training Calendar tab (month + week views)
- Create / edit / delete / complete / missed / rescheduled sessions
- Partner workout invites (Messages, Stories)
- **Today's Focus** — daily fitness dashboard (personal schedule, streak, weekly progress, Start Workout)
- **Training Together Today** — UI shell + quick actions (hidden until partner data exists)
- Sticky Month/Week controls + scroll-linked FAB
- Responsive layout (mobile single column, desktop sidebar for Community events)
- Community events browse (separate from personal schedule)

**Gate before merge to `main`:** Founder QA pass on staging (`mobile-beta-blond.vercel.app`).

---

## v1.1+ — After Training Calendar is stable and deployed

### Training Together Today (data layer)

**Goal:** Users open Frennix every morning and instantly know what they're doing, who else is training, and whether to join or invite.

**Example:**

| Partner | Session |
|---------|---------|
| Sarah | Leg Day · 6:00 PM |
| Mike | Morning Run · 7:00 AM |

**Quick actions:**

- View Workout
- Join Workout (Open Sessions)
- Message
- Invite to Train

**Privacy (required before ship):**

- Only **Public**, **Friends** (mutual), or **Open Session** workouts
- **Private** workouts never appear to others
- Per-session privacy + user visibility controls

**Integrations:**

| System | Use |
|--------|-----|
| Training Calendar | Sessions + privacy |
| Frennix Match | Match partner candidates |
| Favorite Training Partners | Prioritize favorites in rail |
| Workout Invites | Invite from partner row |
| Open Sessions | Join / request-to-join |
| Messaging | DM shortcut |

**Implementation:** Extend `getPartnersTrainingToday` (stub in `packages/api/src/partners-training-today.ts`). UI already in `TrainingTogetherTodaySection`.

**Not in scope for v1.** Ship after production sign-off and v1 stability window.

---

### Need a Training Partner Today (discovery rail)

**Goal:** In addition to **Training Together Today** (people you already know), surface users who are **actively looking for a training partner** today — so the Calendar helps you find someone new to train with, not only coordinate with favorites and matches.

**Example section:**

```
Need a Training Partner Today?

🏋️ Sarah
Looking for a lifting partner • 5:30 PM

🏃 Mike
Looking for a running partner • 6:00 AM

🚴 Alex
Cycling partner needed • Beginner pace • 7:00 PM
```

**Each card includes:**

- Profile photo
- Workout type
- Time
- Location or distance (when available)
- Skill level / pace (when available)
- Available spots
- **Join Session** — request or join an open slot
- **Message** — start a conversation
- **View Profile** — see full profile before committing

**Privacy and safety (required before ship):**

- Show only sessions marked **Open Session** or **Looking for Partner**
- **Private** workouts never appear
- Host can **approve or decline** join requests
- Respect calendar visibility and per-workout visibility settings
- Server-side filter + RLS before any client render

**Integrations:**

| System | Use |
|--------|-----|
| Training Calendar | Source sessions + visibility flags |
| Open Sessions | Join / available-spots model |
| Workout Invites | Invite after connecting |
| Favorite Training Partners | Optional boost for known partners also seeking |
| Frennix Match | Surface compatible seekers |
| Notifications | Join requests, approvals, session updates |

**Sequencing:** After **Training Together Today** data layer (v1.1). Not in scope for v1. Document-only until v1 is stable and deployed.

---

### Smart Partner Recommendations (recommendation engine)

**Goal:** Go beyond listing everyone who needs a partner — **intelligently recommend the best training partners for each user today**. This is the layer that ties together Training Together Today, Need a Training Partner Today, Frennix Match, and the Daily Dashboard into one coherent partner experience.

**Core question the engine answers:**

> *"Who is the best person for me to train with today?"*

**Example section:**

```
Recommended Training Partners

⭐ Sarah (98% Match)
Leg Day • 5:30 PM
0.8 miles away

⭐ Mike (95% Match)
Morning Run • 7:00 AM
Same pace as you

⭐ Alex (92% Match)
Cycling • 6:00 PM
Also training for a half marathon
```

**Quick actions:**

- Join Workout
- Invite
- Message
- View Profile

**Recommendation signals (weighted scoring model):**

| Signal | Use |
|--------|-----|
| Shared workout interests | Activity overlap (lifting, running, cycling, etc.) |
| Fitness goals | Goal alignment (strength, endurance, race prep) |
| Training schedule | Calendar overlap for today / this week |
| Skill level | Comparable experience band |
| Preferred workout time | Morning / evening / lunch-window fit |
| Distance | Proximity to user |
| Gym location | Same gym or nearby facility |
| Favorite activities | Profile activity preferences |
| Previous workouts together | Past sessions + completion history |
| Mutual friends or matches | Social graph + Frennix Match status |
| Reliability | Attendance and session completion rate |

**Privacy and safety (required before ship):**

- Recommend only **privacy-visible** sessions and profiles
- **Private** workouts never enter the candidate pool
- Respect calendar visibility and workout visibility settings
- Users can dismiss or hide recommendations; no forced exposure
- Server-side scoring + RLS before any client render

**Powers across the platform:**

| Surface | Role |
|---------|------|
| **Frennix Match** | Primary match scoring + discovery |
| **Calendar / Today's Focus** | Daily ranked partner rail |
| **Open Sessions** | Rank joinable sessions by fit |
| **Daily Dashboard** | Morning "best partner today" answer |
| **Notifications** | Timely nudges when a high-fit partner is training soon |

**Sequencing:** After **Need a Training Partner Today** (v1.2+). Requires stable calendar data, open-session flows, and enough profile/activity signals to score meaningfully. Not in scope for v1.

**Long-term vision:** Frennix becomes the **smartest fitness partner platform** — recommending the right workout partner at the right time, not just showing who is available.

---

### Fitness Circles (group communities)

**Goal:** People don't always train with just one partner — they usually have a **small group**. Fitness Circles let users build long-term fitness communities with friends, family, coworkers, teammates, gym partners, or people they've met through Frennix.

**Each Circle includes:**

| Feature | Description |
|---------|-------------|
| Circle name | User-defined group identity |
| Group photo | Shared avatar / cover |
| Members | Roster with roles (owner, member) |
| Shared Calendar | Group-visible schedule |
| Shared Challenges | Circle-wide goals and competitions |
| Group Chat | Dedicated conversation thread |
| Workout attendance | Who showed up, completion tracking |
| Weekly streak | Collective consistency metric |
| Leaderboard | Friendly competition within the circle |
| Upcoming sessions | Next group or member workouts |
| Invite new members | Grow the circle via link or direct invite |

**Calendar integration — who's training today:**

```
🏃 Morning Run Crew
Today:
• Sarah - 6:00 AM
• Mike - 6:30 AM
• Alex - Rest Day

[Join Session] [Message Circle] [Create Group Workout] [View Calendar]
```

**Quick actions:**

- Join Session
- Message Circle
- Create Group Workout
- View Calendar

**Privacy and safety (required before ship):**

- Only show member workouts that respect **individual privacy settings** (private sessions never leak to the circle)
- Circle admins can manage membership; members can leave at any time
- Invite flows require acceptance; no forced group membership
- Shared calendar aggregates only **circle-visible** sessions
- Server-side filter + RLS before any client render

**Integrations:**

| System | Role |
|--------|------|
| **Calendar** | Shared schedule + "who's training today" on Daily Dashboard |
| **Events** | Circle-attached community events |
| **Challenges** | Shared circle challenges + leaderboards |
| **Group Chat** | Circle conversation |
| **Open Sessions** | Group workouts with available spots |
| **Frennix Match** | Suggest members from compatible matches |
| **Daily Dashboard** | Circle activity rails in Today's Focus |
| **Smart Partner Recommendations** | Suggest circles or members to train with today |

**Sequencing:** After individual partner rails and recommendation engine (v2+). Requires stable calendar, messaging, and challenge primitives. Not in scope for v1.

**Long-term vision:** Frennix becomes the place where people **build long-term fitness communities** — not just find individual workout partners.

---

### Fitness Seasons (community-wide recurring programs)

**Goal:** Create **recurring community-wide fitness seasons** (30, 60, or 90 days) that give every user a reason to come back every day — they're participating in something **bigger than themselves**.

**Example seasons:**

- Summer Shred
- Fall Strength
- Winter Build
- New Year Reset
- Spring Marathon Prep

**When a user joins a Season they receive:**

| Benefit | Description |
|---------|-------------|
| Personal progress tracking | Individual contribution toward season goals |
| Team leaderboard | Compete with your training partners / match group |
| Circle leaderboard | Compete within Fitness Circles |
| Workout streaks | Season-scoped consistency tracking |
| Weekly goals | Rolling targets that reset each week |
| Community milestones | Platform-wide achievements unlocked together |
| Seasonal badges | Earned during the season |
| Completion medals | Awarded at season end |
| Season recap | Summary of personal + community performance |

**Calendar integration:**

- Visually display the **current Season** and **days remaining**
- Season-themed styling or badge on the calendar header
- Season milestones marked on the schedule

**Daily Dashboard integration:**

- Show **today's contribution** toward the active Season
- Progress bar or chip: e.g. "Day 12 of 60 · Summer Shred"
- Tie workout completion, streaks, and circle activity to season points

**Everything connects into Seasons:**

| System | Role |
|--------|------|
| **Calendar** | Season banner, days remaining, milestone dates |
| **Challenges** | Season-scoped challenge tracks |
| **Fitness Circles** | Circle leaderboards + group season goals |
| **Training Partners** | Team leaderboards, partner accountability |
| **Daily Dashboard** | Today's season contribution |
| **Community Events** | Season kickoff, mid-season, finale events |
| **Open Sessions** | Season-themed group workouts |
| **Smart Recommendations** | Suggest partners aligned with season goals |

**Sequencing:** After **Fitness Circles** (v3+). Requires challenges, leaderboards, badges, and stable circle/partner infrastructure. Not in scope for v1.

**Long-term vision:** Seasons create a **shared rhythm** across the Frennix community — turning daily workouts into participation in a collective fitness journey.

---

### Frennix Journey (personal fitness story)

**Goal:** Give every user a **personal fitness story** that grows over months and years — so Frennix **remembers and celebrates** their entire journey, not just today's workout.

**The Journey page** automatically surfaces milestones and memories:

| Milestone | Example |
|-----------|---------|
| First workout | Platform entry point |
| First training partner | First shared session |
| First Fitness Circle | First group joined or created |
| First community event | First event attended |
| First challenge completed | First challenge finish |
| Longest streak | Personal best consistency |
| Personal records | PRs across activities |
| Biggest weight loss or muscle gain | Body composition highlights (opt-in) |
| Most active month | Peak activity period |
| Favorite workout locations | Top gyms, trails, parks |
| Workouts completed | Lifetime count |
| Friends helped | Members you supported |
| Sessions hosted | Open sessions you led |
| Community impact | Collective contribution score |

**Timeline cards (auto-generated):**

```
🏅 One year ago today...
You completed your first workout with Sarah.

🔥 You have trained with 47 different people.

💪 You have completed 1,000 workouts.

🏃 You've attended 85 community events.

❤️ You helped 14 new members stay consistent.
```

**Annual recap (Spotify Wrapped–style):**

- Total workouts
- Active days
- Favorite activity
- Favorite training partner
- Favorite Circle
- Community impact
- Streaks
- Achievements
- Growth over last year

**Daily Dashboard integration:**

- Occasional **Journey moments** on anniversaries: e.g. "One year ago today…"
- Link to full Journey page from profile and achievements

**Everything connects into Journey:**

| System | Role |
|--------|------|
| **Calendar** | Workout history, streaks, session milestones |
| **Fitness Seasons** | Season completions, badges, medals in timeline |
| **Fitness Circles** | Circle firsts, group milestones |
| **Challenges** | Challenge completions and PRs |
| **Community Events** | Event attendance memories |
| **Training Partners** | Partner firsts, training-with counts |
| **Daily Dashboard** | Anniversary cards and recap prompts |
| **Achievements** | Badge and achievement timeline |
| **Personal Records** | PR cards and growth highlights |

**Sequencing:** After **Fitness Seasons** (v4+). Requires rich historical data across calendar, partners, circles, seasons, events, and achievements. Not in scope for v1.

**Long-term vision:** Every user feels that **Frennix remembers and celebrates their entire fitness journey** — turning years of activity into a story worth revisiting.

---

## Frennix fitness platform arc (long-term)

```
v1     Today's Focus (personal dashboard)
         ↓
v1.1   Training Together Today (known partners + matches)
         ↓
v1.2+  Need a Training Partner Today (open discovery)
         ↓
v1.3+  Smart Partner Recommendations (ranked best-fit partners)
         ↓
v2+    Fitness Circles (small-group communities)
         ↓
v3+    Fitness Seasons (community-wide 30/60/90-day programs)
         ↓
v4+    Frennix Journey (personal fitness story + annual recap)
```

---

## How to propose the next Calendar item

1. Confirm v1 sign-off: *"Training Calendar verified — approved to merge to main and deploy to production."*
2. Open Calendar v1.1 milestone with UX + privacy review.
3. Extend existing APIs — no parallel calendar system.

---

## Related docs

- [`DAILY-FITNESS-DASHBOARD.md`](./DAILY-FITNESS-DASHBOARD.md) — Today's Focus product spec
- [`QA-TESTER-GUIDE.md`](./QA-TESTER-GUIDE.md) — v1 manual QA
- [`../PRODUCT-ROADMAP.md`](../PRODUCT-ROADMAP.md) — company-wide priorities
- [`../../docs/PLATFORM_CAPABILITIES.md`](../../docs/PLATFORM_CAPABILITIES.md) — capability map
