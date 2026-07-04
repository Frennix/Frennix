# Today's Focus — Daily Fitness Dashboard

**Status:** v1 ships personal dashboard; partner rail activates in v1.1  
**Last updated:** 2026-07-04  
**Owner:** Product / Engineering

---

## Vision

When users open Frennix each morning, **Today's Focus** is their **daily fitness dashboard** — it answers three questions instantly:

1. **What am I doing today?** — scheduled workout or rest day  
2. **How am I progressing?** — streak + weekly completion  
3. **Who else is training today?** — favorite partners and matches (privacy-safe)  
4. **Who needs a partner today?** — open sessions and partner-seeking posts (privacy-safe)  
5. **Who is the best person for me to train with today?** — smart, ranked recommendations (privacy-safe)  
6. **What are my circles doing today?** — small-group communities and shared schedules (privacy-safe)  
7. **How am I contributing to the Season?** — community-wide program progress and days remaining  
8. **What is my fitness story?** — personal Journey milestones, memories, and annual recap (long-term)

The Calendar tab becomes the user's **fitness home**, not only a scheduling grid. Over time, **Frennix Journey** becomes the place where that story is preserved and celebrated.

---

## v1 (current — staging QA)

| Element | Status |
|---------|--------|
| Today's scheduled workout / Rest Day | ✅ Live |
| Current workout streak | ✅ Live |
| Weekly progress (e.g. 3 of 5 completed) | ✅ Live |
| Next scheduled workout | ✅ Live |
| **Start Workout** primary CTA | ✅ Live |
| Training partner status | 🔜 Shell ready; hidden until data exists |
| 🏋️ Training Together Today rail | 🔜 UI + actions wired; API returns `[]` |

**Start Workout behavior (v1):**

- Scheduled session today → open session detail  
- Rest day / no session → open workout log (`create-post`)  
- Completed today → log another workout  

---

## v1.1 — Training Together Today

### When to show

Display **🏋️ Training Together Today** only when at least one **favorite training partner** or **Frennix Match** has a **privacy-visible** workout scheduled for today.

**Never show** private sessions.

### Example

```
🏋️ Training Together Today

Sarah
Leg Day • 6:00 PM
[View] [Join] [Message] [Invite]

Mike
Morning Run • 7:00 AM
[View] [Join] [Message] [Invite]
```

### Quick actions

| Action | v1.1 behavior |
|--------|----------------|
| **View Workout** | Open partner's visible session (read-only or joinable) |
| **Join Workout** | Open Session join / request-to-join |
| **Message** | Open DM (`/chat/[conversationId]`) |
| **Invite to Train** | Pre-fill Training Calendar create with partner |

### Privacy rules (required)

- Show only **Public**, **Friends** (mutual), or **Open Session** workouts  
- **Private** workouts never appear  
- User controls visibility per session (`training_calendar_items.privacy`)  
- Server-side filter + RLS before any client render  

### Platform integration

| Capability | Role |
|------------|------|
| Training Calendar | Source of sessions + privacy |
| Favorite Training Partners | Primary social graph |
| Frennix Match | Secondary graph for matches |
| Workout Invites | Invite from partner row |
| Open Sessions | Join / request flows |
| Messaging | Quick DM from row |

### API (planned)

`getPartnersTrainingToday(userId, dateKey)` → `PartnerTrainingTodayEntry[]`

Stub lives in `packages/api/src/partners-training-today.ts` (returns `[]` until v1.1).

---

## v1.2+ — Need a Training Partner Today

**Complements** Training Together Today: surfaces users **actively looking for a partner**, not only people in your social graph who already have a session scheduled.

### When to show

Display **Need a Training Partner Today?** when at least one privacy-visible session is marked **Open Session** or **Looking for Partner** for today.

**Never show** private workouts.

### Example

```
Need a Training Partner Today?

🏋️ Sarah
Looking for a lifting partner • 5:30 PM

🏃 Mike
Looking for a running partner • 6:00 AM

🚴 Alex
Cycling partner needed • Beginner pace • 7:00 PM
```

### Card fields

| Field | Notes |
|-------|-------|
| Profile photo | Avatar from user profile |
| Workout type | Lifting, run, cycling, etc. |
| Time | Session start |
| Location / distance | When provided |
| Skill level / pace | When provided |
| Available spots | Open Session capacity |

### Quick actions

| Action | Behavior |
|--------|----------|
| **Join Session** | Request to join or join open slot |
| **Message** | Open DM with host |
| **View Profile** | Navigate to user profile |

### Privacy and safety

- Only **Open Session** or **Looking for Partner** visibility  
- **Private** workouts never appear  
- Host **approves or declines** join requests  
- Respect calendar visibility + workout visibility settings  
- Server-side filter + RLS before client render  

### Platform integration

Training Calendar · Open Sessions · Workout Invites · Favorite Training Partners · Frennix Match · Notifications

**Status:** Roadmap only — not in v1. Ship after Training Together Today (v1.1) and v1 production stability.

---

## v1.3+ — Smart Partner Recommendations

**Elevates** Need a Training Partner Today from a flat discovery list to a **ranked, personalized recommendation engine** — answering the question that ties the whole dashboard together.

### Core question

> *"Who is the best person for me to train with today?"*

Instead of showing everyone who needs a partner, Frennix scores and ranks candidates by fit for **this user, today**.

### When to show

Display **Recommended Training Partners** when the engine returns at least one privacy-visible, high-confidence match for today.

May **replace or augment** the unranked Need a Training Partner Today list as signals mature.

### Example

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

### Scoring signals

Shared workout interests · fitness goals · training schedule · skill level · preferred workout time · distance · gym location · favorite activities · previous workouts together · mutual friends or matches · reliability (attendance/completion history)

### Quick actions

| Action | Behavior |
|--------|----------|
| **Join Workout** | Join or request open session |
| **Invite** | Send workout invite |
| **Message** | Open DM |
| **View Profile** | Full profile before committing |

### Privacy and safety

- Only privacy-visible sessions and profiles in the candidate pool  
- **Private** workouts never recommended  
- User can dismiss or hide recommendations  
- Server-side scoring + RLS before client render  

### Platform integration

Powers **Frennix Match**, **Calendar**, **Open Sessions**, **Daily Dashboard**, and **Notifications** — one engine, many surfaces.

**Status:** Roadmap only — not in v1. Ship after Need a Training Partner Today (v1.2+) and sufficient profile/activity data.

**Long-term goal:** Frennix becomes the smartest fitness partner platform by recommending the right workout partner at the right time.

---

## v2+ — Fitness Circles

**Extends** the partner experience from individuals to **small groups** — friends, family, coworkers, teammates, gym partners, or people met through Frennix.

### Core idea

People don't always train with just one partner. Fitness Circles are persistent groups with shared accountability, not one-off session matching.

### Circle features

Circle name · group photo · members · shared calendar · shared challenges · group chat · workout attendance · weekly streak · leaderboard · upcoming sessions · invite new members

### Calendar — who's training today

```
🏃 Morning Run Crew
Today:
• Sarah - 6:00 AM
• Mike - 6:30 AM
• Alex - Rest Day

[Join Session] [Message Circle] [Create Group Workout] [View Calendar]
```

### Quick actions

| Action | Behavior |
|--------|----------|
| **Join Session** | Join a member's visible or group session |
| **Message Circle** | Open group chat |
| **Create Group Workout** | Schedule a circle session |
| **View Calendar** | Open shared circle calendar |

### Privacy and safety

- Member workouts respect **individual privacy** — private sessions never appear in the circle feed  
- Invite-only membership with accept/decline  
- Members can leave; admins manage roster  
- Server-side filter + RLS before client render  

### Platform integration

Calendar · Events · Challenges · Group Chat · Open Sessions · Frennix Match · Daily Dashboard · Smart Partner Recommendations

**Status:** Roadmap only — not in v1. Ship after partner rails and recommendation engine (v2+).

**Long-term goal:** Frennix becomes the place where people **build long-term fitness communities**, not just find individual workout partners.

---

## v3+ — Fitness Seasons

**Layers** community-wide **recurring fitness seasons** (30, 60, or 90 days) on top of circles, partners, and the daily dashboard — giving users a shared reason to return every day.

### Example seasons

Summer Shred · Fall Strength · Winter Build · New Year Reset · Spring Marathon Prep

### What users get when they join

Personal progress tracking · team leaderboard · circle leaderboard · workout streaks · weekly goals · community milestones · seasonal badges · completion medals · season recap at the end

### Calendar

- Display **current Season** name and **days remaining**
- Season-themed visual treatment on calendar header
- Milestone dates on the schedule

### Daily Dashboard

- **Today's contribution** toward the active Season
- e.g. `Day 12 of 60 · Summer Shred` with progress toward weekly goal

### Platform integration

Calendar · Challenges · Fitness Circles · Training Partners · Daily Dashboard · Community Events · Open Sessions · Smart Recommendations — every feature feeds season progress.

**Status:** Roadmap only — not in v1. Ship after Fitness Circles (v3+).

**Long-term goal:** Give every user a reason to come back every day because they're participating in something **bigger than themselves**.

---

## v4+ — Frennix Journey

**Capstone** feature: a personal fitness **story** that grows over months and years — milestones, memories, and annual recaps so users feel Frennix remembers their entire journey.

### Journey page — auto-celebrated milestones

First workout · first training partner · first Fitness Circle · first community event · first challenge completed · longest streak · personal records · biggest weight loss or muscle gain · most active month · favorite workout locations · workouts completed · friends helped · sessions hosted · community impact

### Timeline cards

```
🏅 One year ago today...
You completed your first workout with Sarah.

🔥 You have trained with 47 different people.

💪 You have completed 1,000 workouts.

🏃 You've attended 85 community events.

❤️ You helped 14 new members stay consistent.
```

### Annual recap (Spotify Wrapped–style)

Total workouts · active days · favorite activity · favorite training partner · favorite Circle · community impact · streaks · achievements · growth over last year

### Daily Dashboard touchpoints

- **Journey moments** on anniversaries surfaced in Today's Focus
- Link to full Journey page from profile and achievements

### Platform integration

Calendar · Fitness Seasons · Fitness Circles · Challenges · Community Events · Training Partners · Daily Dashboard · Achievements · Personal Records

**Status:** Roadmap only — not in v1. Ship after Fitness Seasons (v4+).

**Long-term vision:** Every user feels that **Frennix remembers and celebrates their entire fitness journey**.

---

## Morning experience (long-term)

```
Open Frennix → Calendar tab
  → Season banner (name + days remaining)               [v3+]
  → Today's Focus (dashboard)
      → My workout + streak + weekly bar
      → Today's Season contribution                     [v3+]
      → Start Workout
      → Partners training today (if any)              [v1.1]
      → Need a training partner today (if any)        [v1.2+]
      → Recommended training partners (ranked)        [v1.3+]
      → Fitness Circles — who's training today        [v2+]
      → Journey moment (anniversary / milestone)      [v4+]
  → Month / Week calendar (sticky controls)
  → Community events (below on mobile)
```

### Rails & long-term surfaces — how they connect

| Surface | What it answers |
|---------|-----------------|
| Training Together Today | Who I already know is training today |
| Need a Training Partner Today | Who is openly looking for someone today |
| Smart Partner Recommendations | Who is the **best** fit for me to train with today |
| Fitness Circles | What are **my groups** doing today |
| Fitness Seasons | How am I contributing to the **community-wide program** |
| Frennix Journey | **What is my fitness story** — milestones, memories, annual recap |

---

## Related

- [`ROADMAP.md`](./ROADMAP.md) — release sequencing  
- [`QA-TESTER-GUIDE.md`](./QA-TESTER-GUIDE.md) — v1 manual QA  
