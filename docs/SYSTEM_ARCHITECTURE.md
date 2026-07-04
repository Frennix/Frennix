# Frennix System Architecture

**Status:** Architectural baseline — frozen foundation (2026-07-04)  
**Last updated:** 2026-07-04  
**Philosophy:** Build once, reuse everywhere. Extend existing systems before creating new ones.

---

## Architecture Freeze Rule

The current architecture is the **baseline foundation** for Frennix. It is considered complete for the platform's current scope.

**Product development does not pause for architecture work** unless a **real limitation** is discovered — a concrete blocker where existing capabilities cannot support the feature. Document the limitation before adding infrastructure.

**New architectural systems should only be introduced when an existing capability cannot reasonably support a new feature.** Every proposed change must include a documented reason before adding infrastructure.

### Default approach

- **Extend** existing systems before creating new ones
- **Improve** existing APIs rather than introducing parallel endpoints
- **Reuse** existing tables, services, and data models
- **Avoid** duplicate functionality or parallel systems
- **Avoid** new infrastructure without a documented justification

### Primary focus moving forward

Deliver **polished, user-facing features** on top of this foundation. Prioritize:

1. User experience
2. Performance
3. Stability
4. Accessibility
5. Polish

…over expanding platform infrastructure.

**Product mode:** See [`PRODUCT_VISION.md`](../features/PRODUCT_VISION.md) § Product building mode (approved 2026-07-04).

The goal is to keep Frennix **simple, scalable, maintainable, and enjoyable to build** as it grows. Preserve the strong architectural foundation; only modify it when a feature genuinely requires it.

**Competitive advantage is execution and polish** — a best-in-class fitness experience built on this foundation, not expanding the foundation itself.

**Capability reference:** [`PLATFORM_CAPABILITIES.md`](./PLATFORM_CAPABILITIES.md)

---

## Core architectural rules

As Frennix grows, every new feature must first determine whether it **extends an existing system** before creating a new one.

**Priority order:**

1. **Extend existing architecture**
2. **Reuse existing tables and APIs**
3. **Publish Platform Activity Events** (`publishPlatformActivity`)
4. **Avoid duplicate data**
5. **Avoid duplicate business logic**
6. **Create a brand-new system only when absolutely necessary**

**Before starting any major feature, ask:**

1. Does this extend an existing system?
2. If it is scheduled or time-based → does it go through the **Training Calendar**?
3. If it is a meaningful user action → does it **publish a Platform Activity Event**?
4. If it needs badges → does the **Achievement Engine** read from the activity stream?
5. If it affects trust/accountability → does **Reputation** aggregate from the same stream?

If yes to (3), **do not** create a separate analytics, tracking, or history table.

---

## Architecture overview

```
                         ┌─────────────────────────┐
                         │   Training Calendar     │  ← Central planning hub
                         │   (native + virtual)    │
                         └───────────┬─────────────┘
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         ▼                           ▼                           ▼
   Stories / Messages          Events / Challenges          Future: AI, wearables
         │                           │
         └───────────────┬───────────┘
                         ▼
              ┌──────────────────────┐
              │ Platform Activity    │  ← Single standardized event stream
              │ Engine               │
              │ platform_activity_   │
              │ events               │
              └──────────┬───────────┘
                         │
     ┌───────────────────┼───────────────────┬──────────────────┐
     ▼                   ▼                   ▼                  ▼
 Achievements      Reputation         Analytics /        Weekly & monthly
 (badges)          (background)       founder stats      recaps, AI, streaks
```

### Shared layers (never duplicate)

| Layer | API | Purpose |
|-------|-----|---------|
| **Calendar read** | `getCalendarView` | One schedule surface for native + virtual items |
| **Workout history** | `getWorkoutActivityDates` | Completed workouts across posts, calendar, commitments |
| **Platform Activity Engine** | `publishPlatformActivity`, `getPlatformActivityStream` | Every meaningful action → one standardized event |
| **Partner invites** | `training_session_invites` | All partner workout scheduling |
| **Notifications** | `notifications` + deep links | One inbox; routes to calendar/event/challenge/chat |

---

## 0. Platform Activity Engine

**Purpose:** The single event stream for all meaningful Frennix actions. Powers achievements, reputation, analytics, recaps, streaks, leaderboards, and future AI — **no feature-specific tracking tables**.

**Owns table:** `platform_activity_events`

**Event shape:**

| Field | Description |
|-------|-------------|
| `activity_type` | Canonical action (e.g. `workout_completed`, `event_joined`) |
| `source_type` | Originating domain/table (e.g. `training_calendar_items`, `posts`) |
| `source_id` | UUID of the source record |
| `user_id` | Actor who performed the action |
| `occurred_at` | When it happened |
| `metadata` | Optional JSON context |

**Key APIs:**

- `publishPlatformActivity()` — **the only write path** (API + `publish_platform_activity` RPC)
- `getPlatformActivityStream()` — query user activity for recaps/insights
- `getPlatformActivityCounts()` — aggregated counts for achievements
- `countPlatformActivity()` — time-bounded counts

**Canonical activity types include:**

`workout_completed`, `workout_scheduled`, `workout_rescheduled`, `workout_cancelled`, `story_posted`, `story_viewed`, `story_reacted`, `story_replied`, `feed_post_created`, `feed_post_liked`, `feed_post_commented`, `challenge_joined`, `challenge_completed`, `event_created`, `event_joined`, `event_attended`, `match_created`, `training_partner_favorited`, `message_sent`, `workout_invite_sent`, `workout_invite_accepted`, `workout_invite_declined`, `achievement_earned`, and more.

**Publishers (who writes events):**

- **DB triggers** — posts, likes, comments, calendar status, event join/create, challenge join, invites, story views
- **API hooks** — story publish, messages, favorites, matches, calendar delete, achievement unlock

**Consumers (who reads events):**

| Consumer | How |
|----------|-----|
| Achievement Engine | `getPlatformActivityCounts` + streak |
| Reputation | `refresh_user_reputation` on insert |
| Workout history | `getWorkoutActivityDates` (completion layer; aligns with `workout_completed` events) |
| Future: Weekly recap | `getPlatformActivityStream(range)` |
| Future: Founder analytics | aggregate queries on `platform_activity_events` |
| Future: AI recommendations | activity stream + calendar |

**Rule:** No feature creates its own activity/analytics table. Ask: *"Can this publish a Platform Activity Event instead?"*

---

## 1. Training Calendar

**Purpose:** Central hub for all scheduled, date-based fitness activity in Frennix.

**Owns tables:**
- `training_calendar_items` — user-created and mirrored sessions
- `training_session_invites` — partner workout invites (single invite system)
- `training_session_participants` — owner + partner roles
- `training_calendar_external_links` — future Google/Apple/Strava sync (schema only)

**Key APIs:** `getCalendarView`, `createTrainingCalendarItem`, `updateTrainingCalendarItemStatus`, `respondTrainingSessionInvite`, `getWorkoutActivityDates`

**Depends on:** Events (`events`, `event_attendees`), Challenges (`challenges`, `challenge_participants`), Stories (`story_workout_commitments`)

**Used by:** Calendar tab, session detail, story partner CTA, messages invite (future), notifications (`training_session_*`), profile upcoming (future)

**Virtual projections (read-time, not duplicated):**
- Joined community events → `item_type: event`
- Active challenges → daily markers in range
- Story commitments with `due_at` → deadline items

**Future expansion:** Run clubs, group workouts, coaching sessions, nutrition challenges, AI recommendations — all as `source_type` on native items or virtual projections. External calendars via `training_calendar_external_links`.

---

## 2. Workout History & Activity Layer

**Purpose:** Single retrospective record of completed fitness activity.

**Owns tables:** None exclusively — **reads** `posts`, `training_calendar_items`, `story_workout_commitments`; **writes** `platform_activity_events` via triggers.

**Key APIs:** `getWorkoutActivityDates`, `getWorkoutStreak`, `recordPlatformActivity`

**Depends on:** Training Calendar completions, Posts, Story commitments

**Used by:** Calendar green dots, streak badge, profile stats, **Achievement Engine**, **Reputation** aggregation

**Rule:** Do not create a separate “workout log” or “history” table. New completion sources must either appear in the activity read layer or emit `platform_activity_events`.

---

## 3. Achievement System

**Purpose:** Centralized badges from real participation — reads **only** from the Platform Activity Engine + workout streak.

**Owns tables:**
- `achievement_definitions` — catalog
- `user_achievements` — unlocked badges
- **Reads** `platform_activity_events` via `getPlatformActivityCounts`

**Key APIs:** `evaluateUserAchievements`, `getProfileAchievementDisplays`, `publishPlatformActivity({ activityType: 'achievement_earned' })`

**Depends on:** Platform Activity Engine, workout activity layer (streak)

**Rule:** Do not add achievement-specific tracking tables. New badges = new rules reading existing activity types.

---

## 4. Reputation System (future-ready, no UI)

**Purpose:** Consistency and accountability score — **not** popularity. Records positive participation now; UI introduced when user base is larger.

**Owns tables:**
- `platform_activity_events` — source ledger (shared with achievements)
- `reputation_event_weights` — per-event dimension weights
- `user_reputation_scores` — aggregated consistency / reliability / community / partnership scores

**Key APIs:** `getUserReputationScore`, `refreshUserReputation` (internal)

**Depends on:** Activity ledger triggers

**Used by:** Nothing public yet. Reserved for future profile trust indicators, match quality, event host credibility.

**Dimensions:**
- **Consistency** — regular workouts, commitments kept
- **Reliability** — showing up, completing scheduled sessions; missed sessions reduce reliability weight
- **Community** — events attended/hosted, helping beginners, positive interactions
- **Partnership** — partner workouts completed, invite accept rate (future)

**Rule:** Do not build a separate “karma” or “likes” score. Reputation only increments from `platform_activity_events` with defined weights.

---

## 5. Messaging

**Purpose:** Training partner communication.

**Owns tables:** `conversations`, `conversation_members`, `messages`, `conversation_user_preferences` (pin, favorite, mute)

**Key APIs:** `getConversations`, `sendMessage`, `favoriteTrainingPartner`

**Depends on:** Profiles, matching, notifications (`message`)

**Favorite Training Partners:** `favorited_at` on preferences — **invitee picker only**, not a scheduling system. Schedule via Calendar + `training_session_invites`.

**Future expansion:** “Schedule workout” from chat → `createTrainingCalendarItem` with `source_type: message_invite`.

---

## 6. Stories

**Purpose:** Fitness-first daily engagement — workouts, partner CTAs, commitments, challenges.

**Owns tables:** `stories`, `story_slides`, `story_workout_commitments`, `story_training_challenges`, etc.

**Key APIs:** `publishStory`, `createStoryWorkoutCommitment`, story fitness/engagement modules

**Depends on:** Training Calendar (partner CTA → `/training-calendar/create`), activity ledger (commitment completion → `story_commitment_completed`)

**Rule:** No story-specific calendar. Commitments with `due_at` project onto Training Calendar virtually.

**Legacy:** `story_train_invites` — migrate intents to `training_session_invites` + calendar items.

---

## 7. Events (Community)

**Purpose:** Discoverable group workouts and community gatherings.

**Owns tables:** `events`, `event_attendees`, `event_invitations`

**Key APIs:** `getWorkoutEvents`, `joinWorkoutEvent`, `inviteToWorkoutEvent`

**Depends on:** Training Calendar virtual projections, activity ledger (`event_attended`, `event_hosted`), notifications (`event_invite`, `event_join`)

**Rule:** No separate Events calendar tab for personal schedule — joined events appear on Training Calendar via `getCalendarView`.

---

## 8. Challenges

**Purpose:** Time-bound fitness goals and community competition.

**Owns tables:** `challenges`, `challenge_participants`, `challenge_invitations`

**Key APIs:** `getChallenges`, `joinChallenge`, challenge invite flows

**Depends on:** Training Calendar virtual projections, activity ledger (`challenge_joined`, `challenge_completed`), achievements

**Rule:** Challenge dates appear on calendar as virtual items; optional native linked sessions use `linked_challenge_id`.

---

## 9. Notifications

**Purpose:** One inbox routing users to the right surface.

**Owns tables:** `notifications`, `push_tokens`, preference JSON on profiles

**Key APIs:** `getNotifications`, `createNotification`, `buildNotificationDisplay`

**Deep links:**
- `training_session_*` → `/training-calendar/[id]`
- `event_*` → `/event/[id]`
- `challenge_*` → `/challenge/[id]`
- `message` → `/chat/[conversationId]`

**Depends on:** All feature systems (triggers + API insert)

---

## 10. User Profiles

**Purpose:** Identity, stats, achievements, social graph.

**Owns tables:** `profiles`, `follows`, `posts` (authored content)

**Key APIs:** `getProfile`, `getProfileStats`, `getProfileAchievementDisplays`

**Depends on:** Workout activity (streak), achievement engine, reputation (future)

**Stats:** `workoutStreak` from unified `getWorkoutStreak` — not posts-only.

---

## 11. Favorite Training Partners

**Purpose:** Quick access to top training partners in Messages.

**Owns:** `conversation_user_preferences.favorited_at` (max 5, app-enforced)

**Not a scheduling system.** Used only to pick partners for calendar invites and message shortcuts.

---

## 12. AI Recommendations (future)

**Purpose:** Suggest workouts, partners, and optimal training times.

**Planned integration:** Emit `platform_activity_events` with `source_type: ai_recommendation` on calendar items; never a separate recommendation calendar.

**Tables:** Extend `training_calendar_items.source_type` only.

---

## 13. External Calendar & Wearable Integrations (future)

**Purpose:** Sync with Google Calendar, Apple Calendar, Outlook, Garmin, Apple Health, Google Fit, Strava, Fitbit.

**Owns tables:** `training_calendar_external_links` (already created)

**Planned flow:** Import/export via `external_id` + `provider`; map to native `training_calendar_items`; completions still flow to `platform_activity_events`.

**Rule:** Wearables do not get their own achievement or reputation tables — completions normalize into the activity ledger.

---

## Decision checklist for new features

| Question | If yes → |
|----------|----------|
| Is it scheduled or time-based? | Training Calendar (`training_calendar_items` or virtual projection) |
| Is it a meaningful user action? | `publishPlatformActivity()` — never a new tracking table |
| Is it a completed workout? | `workout_completed` activity + activity read layer |
| Is it a partner invite? | `training_session_invites` only |
| Should it award a badge? | `achievement_definitions` + engine rule |
| Should it affect trust/accountability? | `reputation_event_weights` + ledger event |
| Should user get notified? | `notifications` with calendar/event deep link |

---

## Migration index (calendar + achievements)

| Migration | Contents |
|-----------|----------|
| `20250716000001_training_calendar.sql` | Calendar hub tables + RLS |
| `20250717000001_training_calendar_phase2.sql` | Provenance, external links, invite notifications |
| `20250718000001_achievements_reputation.sql` | Achievement catalog, reputation scores, initial ledger |
| `20250719000001_platform_activity_engine.sql` | Standardized activity engine, expanded types, triggers |

---

## Related documents

- [`PLATFORM_CAPABILITIES.md`](./PLATFORM_CAPABILITIES.md) — **master capability registry** (owners, APIs, tables, events, screens)
- [`features/PRODUCT_VISION.md`](../features/PRODUCT_VISION.md) — product principles
- [`features/PRODUCT-ROADMAP.md`](../features/PRODUCT-ROADMAP.md) — delivery phases

**Maintainers:** Update this file when extending existing systems. New architectural systems require documented justification per the Architecture Freeze Rule.
