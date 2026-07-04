# Frennix Platform Capability Registry

**Status:** Master architectural reference — frozen baseline (2026-07-04)  
**Last updated:** 2026-07-04  
**Companion doc:** [`SYSTEM_ARCHITECTURE.md`](./SYSTEM_ARCHITECTURE.md) (Architecture Freeze Rule, diagrams, decision checklist)

---

## Architecture Freeze Rule

This registry documents the **complete capability set** for Frennix's current architectural foundation. Treat it as the baseline — not a backlog of systems to build.

**Before adding a new capability:**

1. Confirm no existing capability can reasonably support the feature
2. Document why extension is insufficient
3. Get explicit approval to introduce new infrastructure

**Otherwise:** extend an existing capability, improve its APIs, and ship polished user-facing work on top.

See [`SYSTEM_ARCHITECTURE.md` § Architecture Freeze Rule](./SYSTEM_ARCHITECTURE.md#architecture-freeze-rule) for the full development principle.

---

## How to use this document

Every major Frennix system has **one documented owner** and **one clear responsibility**. Before building a new feature, determine whether it **extends an existing capability** rather than creating duplicate functionality.

**Priority order:**

1. Extend an existing capability
2. Reuse existing tables and APIs
3. Publish a Platform Activity Event (`publishPlatformActivity`)
4. Avoid duplicate data and business logic
5. Create a new capability only when absolutely necessary

**Quick decision flow:**

| Question | If yes → extend |
|----------|-----------------|
| Is it scheduled or time-based? | **Training Calendar** |
| Is it a partner workout invite? | **Training Session Invites** |
| Is it a meaningful user action? | **Platform Activity Engine** |
| Should it award a badge? | **Achievement Engine** |
| Should it affect trust/accountability? | **Reputation Engine** |
| Should the user be notified? | **Notifications** |
| Is it about finding people or content? | **Search / Discovery** |

---

## Capability index

| Capability | Owner | Primary API module |
|------------|-------|-------------------|
| [Authentication](#authentication) | Identity & Access | `packages/api/src/auth.ts` |
| [Profiles](#profiles) | Social Identity | `packages/api/src/profiles.ts` |
| [Feed](#feed) | Social Feed | `packages/api/src/posts.ts` |
| [Stories](#stories) | Ephemeral Stories | `packages/api/src/stories.ts` |
| [Messaging](#messaging) | Direct Messaging | `packages/api/src/messaging.ts` |
| [Notifications](#notifications) | Notification Delivery | `packages/api/src/notifications.ts` |
| [Events](#events-community-workouts) | Community Events | `packages/api/src/events.ts` |
| [Challenges](#challenges) | Fitness Challenges | `packages/api/src/challenges.ts` |
| [Training Calendar](#training-calendar) | Training Planning | `packages/api/src/training-calendar.ts` |
| [Training Session Invites](#training-session-invites) | Partner Invites | `packages/api/src/training-session-invites.ts` |
| [Favorite Training Partners](#favorite-training-partners) | Partner Relationships | `packages/api/src/messaging.ts` |
| [Platform Activity Engine](#platform-activity-engine) | Platform Infrastructure | `packages/api/src/platform-activity-engine.ts` |
| [Achievement Engine](#achievement-engine) | Gamification | `packages/api/src/achievement-engine.ts` |
| [Reputation Engine](#reputation-engine) | Trust Signals (Internal) | `packages/api/src/reputation.ts` |
| [AI Recommendation Engine](#ai-recommendation-engine) | Intelligence (Planned) | — (schema stub only) |
| [Search / Discovery](#search--discovery) | Discovery | `packages/api/src/suggestions.ts` |
| [Admin / Moderation](#admin--moderation) | Safety & Operations | `packages/api/src/moderation.ts` |
| [Analytics](#analytics) | Platform Insights | `packages/api/src/analytics.ts` |

---

## Authentication

**Owner:** Identity & Access

### Purpose

Supabase Auth sign-in, sign-up, session management, and password recovery for the mobile app.

### Responsibilities

- Email/password authentication and session lifecycle
- Auth state change propagation to the app shell
- Password reset and update flows
- Bridge authenticated users to `profiles` row creation (via onboarding)

### APIs

| Function | Module |
|----------|--------|
| `signInWithEmail`, `signUpWithEmail`, `signOut` | `auth.ts` |
| `getSession`, `onAuthStateChange` | `auth.ts` |
| `resetPasswordForEmail`, `updatePassword` | `auth.ts` |

### Database tables

| Table | Notes |
|-------|-------|
| `auth.users` | Supabase Auth (managed) |
| `profiles` | App profile created after sign-up (`20250529000000_initial_schema.sql`) |

### Events published

None — authentication is infrastructure, not a gamified action.

### Events consumed

None.

### UI screens

| Route | Purpose |
|-------|---------|
| `app/(auth)/welcome.tsx` | Entry |
| `app/(auth)/login.tsx` | Sign in |
| `app/(auth)/signup.tsx` | Sign up |
| `app/(auth)/forgot-password.tsx` | Password reset request |
| `app/reset-password.tsx` | Password reset completion |
| `app/onboarding.tsx` | Post-auth profile setup |

### Future planned extensions

- Social sign-in (Apple wired in UI; full OAuth polish)
- Session activity events (optional, low priority)
- Multi-device session management

---

## Profiles

**Owner:** Social Identity

### Purpose

User identity, public presence, social graph, and profile-level stats surfaced across the app.

### Responsibilities

- Profile CRUD (username, bio, avatar, cover, fitness preferences)
- Follow / unfollow graph
- Profile stats aggregation (streak, achievements display)
- Profile search and discovery entry points
- Presence and push token storage on profile

### APIs

| Function | Module |
|----------|--------|
| `getProfile`, `getProfileByUsername`, `upsertProfile`, `updateProfile` | `profiles.ts` |
| `getProfileStats`, `uploadAvatar`, `uploadCoverImage` | `profiles.ts` |
| `searchProfiles`, `discoverProfiles` | `profiles.ts` |
| `followUser`, `unfollowUser`, `getFollowers`, `getFollowing` | `follows.ts` |
| `getProfileAchievementDisplays` | `achievement-engine.ts` (via `achievements.ts`) |
| `getWorkoutStreak` | `workout-activity.ts` |

### Database tables

| Table | Notes |
|-------|-------|
| `profiles` | Core identity |
| `follows` | Social graph |
| `profiles.is_admin`, `profiles.is_banned` | Safety flags (`20250529000019_user_safety.sql`) |
| Presence / push columns | `20250617000008_profile_presence.sql` |

### Events published

None directly — profile actions route through Feed, Stories, Calendar, etc.

### Events consumed

| Consumer | Usage |
|----------|-------|
| Workout Activity Layer | `getWorkoutStreak` for profile stats |
| Achievement Engine | `getProfileAchievementDisplays` on profile |
| Reputation Engine | Future trust indicators on profile |

### UI screens

| Route | Purpose |
|-------|---------|
| `app/(tabs)/profile.tsx` | Own profile tab |
| `app/user/[username].tsx` | Public profile |
| `app/edit-profile.tsx` | Edit profile |
| `app/followers/[userId].tsx`, `following/[userId].tsx` | Social graph |
| `app/privacy-settings.tsx` | Privacy controls |
| `components/ProfileScreenContent.tsx` | Streak + achievements display |

### Future planned extensions

- Reputation trust indicators (hidden until user base scales)
- Upcoming training sessions on profile (from Training Calendar)
- Trainer profile integration (`trainer.ts` — extends Profiles)

---

## Feed

**Owner:** Social Feed

### Purpose

The main social workout feed — posts, engagement, saves, and shares.

### Responsibilities

- Feed pagination and enrichment
- Post creation, editing, deletion
- Likes, comments, reactions
- Saved posts and share flows
- Workout post completions feeding activity layer

### APIs

| Function | Module |
|----------|--------|
| `getFeed`, `createPost`, `updatePost`, `deletePost` | `posts.ts` |
| `toggleLike`, `getComments`, `addComment` | `comments.ts`, `posts.ts` |
| Reaction helpers | `reactions.ts` |
| Saved posts | `saved-posts.ts` |
| Share helpers | `share.ts` |

### Database tables

| Table | Notes |
|-------|-------|
| `posts` | Feed content |
| `likes` | Post likes |
| `comments` | Post comments |
| `saved_posts` | User bookmarks |
| Feed enrichment RPCs | `20250617000007_feed_enrichment_rpc.sql` |

### Events published

| Activity type | Publisher |
|---------------|-----------|
| `feed_post_created` | DB trigger on `posts` INSERT |
| `workout_completed` | DB trigger on workout-type `posts` INSERT |
| `feed_post_liked` | DB trigger on `likes` INSERT |
| `feed_post_commented` | DB trigger on `comments` INSERT |

### Events consumed

| Consumer | Usage |
|----------|-------|
| Achievement Engine | Counts `workout_completed`, feed engagement types |
| Reputation Engine | Weights on feed activity types |
| Workout Activity Layer | Reads completed workout posts |

### UI screens

| Route | Purpose |
|-------|---------|
| `app/(tabs)/index.tsx` | Home feed (+ stories rail) |
| `app/create-post.tsx` | Create post |
| `app/post/[id].tsx` | Post detail |
| `app/edit-post/[id].tsx` | Edit post |
| `app/saved-posts.tsx` | Saved posts |

### Future planned extensions

- Rich media carousels and workout templates
- Feed ranking from activity signals (via Platform Activity Engine, not a new table)

---

## Stories

**Owner:** Ephemeral Stories

### Purpose

Fitness-first ephemeral stories — daily engagement, commitments, polls, highlights, and partner CTAs.

### Responsibilities

- Story publish, slides, and expiry
- Story engagement (views, reactions, replies)
- Workout commitments and training challenges on stories
- Story discovery lanes
- Partner CTA → Training Calendar create flow
- Highlights and polls

### APIs

| Function | Module |
|----------|--------|
| `publishStory`, story CRUD | `story-publish.ts`, `stories.ts` |
| Engagement, analytics | `story-engagement.ts` |
| Fitness commitments, challenges | `story-fitness.ts` |
| Discovery lanes | `story-discovery.ts` |
| Polls, highlights | `story-polls.ts`, `story-highlights.ts` |
| Workout story utilities | `workout-story-utils.ts` |
| Calendar invite from story | `lib/story-calendar-invite.ts` |

### Database tables

| Table | Notes |
|-------|-------|
| `stories`, `story_slides` | Core story content |
| `story_item_views`, `story_item_reactions` | Engagement |
| `story_mentions` | Mentions |
| `story_workout_commitments` | Commitment deadlines |
| `story_training_challenges` | Story-embedded challenges |
| `story_countdowns`, `story_questions`, `story_polls` | Interactive elements |
| `story_highlights` | Saved highlights |
| `story_train_invites` | **Legacy** — migrate to Training Session Invites |

### Events published

| Activity type | Publisher |
|---------------|-----------|
| `story_posted` | API (`publishStory`) |
| `story_viewed` | DB trigger on `story_item_views` |
| `story_replied` | API (`sendMessage` with story context) |
| `story_commitment_completed` | DB trigger on commitment completion |
| `workout_completed` | DB trigger on commitment-as-workout completion |
| `story_reacted` | **Defined in schema; publisher not yet wired** |

### Events consumed

| Consumer | Usage |
|----------|-------|
| Achievement Engine | `story_commitment_completed`, `workout_completed` |
| Reputation Engine | Story engagement weights |
| Training Calendar | Virtual projection of commitments with `due_at` |

### UI screens

| Route | Purpose |
|-------|---------|
| `app/(tabs)/index.tsx` | Story viewer rail |
| `app/create-story.tsx` | Create story |
| `app/stories/explore.tsx`, `stories/discover.tsx` | Story discovery |
| `components/story/*` | Viewer, slides, CTAs |

### Future planned extensions

- Deprecate `story_train_invites` → `training_session_invites`
- Auto-sync commitments to Training Calendar (virtual projection today)
- Wire `story_reacted` publisher
- Story-to-calendar deep links for all partner CTAs

---

## Messaging

**Owner:** Direct Messaging

### Purpose

Training partner direct messages with conversation preferences, realtime delivery, and partner shortcuts.

### Responsibilities

- Conversation list and thread management
- Message send/receive with realtime subscriptions
- Pin, mute, hide, and delete conversation preferences
- Story reply routing into conversations
- Future: schedule workout from chat

### APIs

| Function | Module |
|----------|--------|
| `getConversations`, `getMessages`, `sendMessage` | `messaging.ts` |
| `getOrCreateConversation` | `messaging.ts` |
| Pin, mute, hide, favorite preferences | `messaging.ts` |
| Realtime subscriptions | `messaging.ts` |

### Database tables

| Table | Notes |
|-------|-------|
| `conversations`, `conversation_members` | Threads |
| `messages` | Message content |
| `conversation_user_preferences` | Pin, mute, favorite |
| `conversation_user_hides` | Hidden threads (`20250711000001`) |
| `conversation_user_deletions` | Per-user delete |

### Events published

| Activity type | Publisher |
|---------------|-----------|
| `message_sent` | API (`sendMessage`) |
| `story_replied` | API (story reply via `sendMessage`) |

### Events consumed

| Consumer | Usage |
|----------|-------|
| Reputation Engine | `message_sent`, `story_replied` weights |
| Achievement Engine | Indirect via activity counts |

### UI screens

| Route | Purpose |
|-------|---------|
| `app/(tabs)/messages.tsx` | Conversation list |
| `app/chat/[conversationId].tsx` | Chat thread |
| `components/FavoriteTrainingPartnersSection.tsx` | Partner shortcuts |

### Future planned extensions

- **Schedule workout** from chat → `createTrainingCalendarItem` with `source_type: message_invite`
- Group training threads (extend conversations, not a new messaging system)
- In-chat calendar preview cards

---

## Notifications

**Owner:** Notification Delivery

### Purpose

Unified notification inbox with deep links to calendar, events, challenges, and chat.

### Responsibilities

- In-app notification CRUD and display formatting
- Push token registration and dispatch
- Notification preference management
- Deep-link routing to the correct feature surface
- Training session invite / accept / reminder notifications

### APIs

| Function | Module |
|----------|--------|
| `getNotifications`, `createNotification`, `buildNotificationDisplay` | `notifications.ts` |
| Preference CRUD | `notification-preferences.ts` |
| `savePushToken` | `push-tokens.ts` |
| Deep-link routing | `lib/notification-navigation.ts` |
| Push dispatch | `supabase/functions/send-push/index.ts` |

### Database tables

| Table | Notes |
|-------|-------|
| `notifications` | In-app inbox |
| `push_tokens` | Device tokens |
| Notification preference JSON | On `profiles` |

### Events published

None — notifications are **downstream** of feature systems, not a source of activity events.

### Events consumed

None.

### UI screens

| Route | Purpose |
|-------|---------|
| `app/notifications.tsx` | Notification inbox |
| `app/notification-settings.tsx` | Preferences |

### Notification types (deep links)

| Type | Routes to |
|------|-----------|
| `training_session_invite`, `training_session_accepted`, `training_session_reminder` | `/training-calendar/[id]` |
| `event_invite`, `event_join` | `/event/[id]` |
| `challenge_invite` | `/challenge/[id]` |
| `message` | `/chat/[conversationId]` |

### Future planned extensions

- Digest notifications (weekly recap trigger)
- Per-capability notification grouping
- Rich push with calendar preview

---

## Events (Community Workouts)

**Owner:** Community Events

### Purpose

Discoverable group workouts and community gatherings; joined events mirror onto the Training Calendar.

### Responsibilities

- Event CRUD and browse/discover
- Join, leave, and attendee management
- Event invitations
- Virtual projection onto Training Calendar for joined events
- Event completion → activity events

### APIs

| Function | Module |
|----------|--------|
| `getWorkoutEvents`, `getWorkoutEvent` | `events.ts` |
| `createWorkoutEvent`, `updateWorkoutEvent` | `events.ts` |
| `joinWorkoutEvent`, `leaveWorkoutEvent` | `events.ts` |
| `inviteToWorkoutEvent`, `getEventAttendees` | `events.ts` |

### Database tables

| Table | Notes |
|-------|-------|
| `events` | Community events |
| `event_attendees` | RSVPs |
| `event_invitations` | Invites (`20250617000005`) |

### Events published

| Activity type | Publisher |
|---------------|-----------|
| `event_created` | DB trigger on `events` INSERT |
| `event_joined` | DB trigger on `event_attendees` INSERT |
| `event_attended` | DB trigger on calendar completion (`item_type: event`) |

### Events consumed

| Consumer | Usage |
|----------|-------|
| Achievement Engine | `event_created`, `event_joined`, `event_attended` |
| Reputation Engine | Community and reliability dimensions |
| Training Calendar | Virtual projection via `getCalendarView` |

### UI screens

| Route | Purpose |
|-------|---------|
| `app/events/browse.tsx` | Browse community events |
| `app/event/[id].tsx` | Event detail |
| `app/create-event.tsx`, `edit-event/[id].tsx` | Create / edit |
| `app/event/[id]/invite.tsx` | Invite attendees |
| Linked from `app/(tabs)/events.tsx` | Calendar tab → browse link |

### Future planned extensions

- No separate personal events calendar tab — always virtual projection on Training Calendar
- Run club events as `source_type: run_club` on calendar items
- Event host reputation surfacing (via Reputation Engine)

---

## Challenges

**Owner:** Fitness Challenges

### Purpose

Time-bound fitness goals with participants, invitations, and calendar integration.

### Responsibilities

- Challenge CRUD and discovery
- Join, leave, participant management
- Challenge invitations
- Virtual daily markers on Training Calendar
- Challenge completion → activity events

### APIs

| Function | Module |
|----------|--------|
| `getChallenges`, `getChallenge`, `createChallenge` | `challenges.ts` |
| `joinChallenge`, `getChallengeParticipants` | `challenges.ts` |
| Challenge invite flows | `challenges.ts` |

### Database tables

| Table | Notes |
|-------|-------|
| `challenges` | Challenge definitions |
| `challenge_participants` | Participants |
| `challenge_invitations` | Invites |
| `challenge_reports` | Moderation reports |

### Events published

| Activity type | Publisher |
|---------------|-----------|
| `challenge_joined` | DB trigger on `challenge_participants` INSERT |
| `challenge_completed` | DB trigger on calendar completion (`item_type: challenge`) |

### Events consumed

| Consumer | Usage |
|----------|-------|
| Achievement Engine | `challenge_joined`, `challenge_completed` |
| Training Calendar | Virtual daily markers in `getCalendarView` |

### UI screens

| Route | Purpose |
|-------|---------|
| `app/challenge/[id].tsx` | Challenge detail |
| `app/create-challenge.tsx`, `edit-challenge/[id].tsx` | Create / edit |
| `app/challenge/[id]/invite.tsx` | Invite participants |
| `app/(tabs)/discover.tsx` | Challenge discovery lane |

### Future planned extensions

- Optional `linked_challenge_id` on native calendar items
- Nutrition and habit challenges (new `item_type`, same tables)
- Challenge leaderboards from Platform Activity Engine aggregates

---

## Training Calendar

**Owner:** Training Planning

### Purpose

Central hub for all scheduled, date-based fitness activity — native items plus virtual projections from Events, Challenges, and Story commitments.

### Responsibilities

- Native calendar item CRUD (workouts, partner sessions, events, challenges)
- Status lifecycle (scheduled → completed / missed / rescheduled / cancelled)
- Unified read surface via `getCalendarView` (native + virtual)
- Workout activity dates and streak computation
- External calendar link schema (future sync)
- Provenance tracking via `source_type` / `source_id`

### APIs

| Function | Module |
|----------|--------|
| `getCalendarView` | `calendar-view.ts` |
| `createTrainingCalendarItem`, `updateTrainingCalendarItem`, `deleteTrainingCalendarItem` | `training-calendar.ts` |
| `updateTrainingCalendarItemStatus` | `training-calendar.ts` |
| `getWorkoutActivityDates`, `getWorkoutStreak` | `workout-activity.ts` |
| Navigation helpers | `lib/training-calendar-navigation.ts` |

### Database tables

| Table | Notes |
|-------|-------|
| `training_calendar_items` | Native scheduled items |
| `training_session_participants` | Owner + partner roles |
| `training_calendar_external_links` | Future Google/Apple/Strava sync |

**Key migrations:** `20250716000001_training_calendar.sql`, `20250717000001_training_calendar_phase2.sql`

### `source_type` values (provenance)

`manual`, `story_commitment`, `story_invite`, `message_invite`, `event`, `challenge`, `ai_recommendation`, `run_club`, `wearable` — extend this enum; do not create parallel scheduling tables.

### Events published

| Activity type | Publisher |
|---------------|-----------|
| `workout_scheduled` | DB trigger on calendar INSERT |
| `workout_completed` | DB trigger on status → completed |
| `workout_missed` | DB trigger on status → missed |
| `workout_rescheduled` | DB trigger on date change |
| `workout_cancelled` | API on delete |
| `partner_workout_completed` | DB trigger (partner sessions) |
| `event_attended` | DB trigger (event items) |
| `challenge_completed` | DB trigger (challenge items) |
| `run_club_participation` | DB trigger (`source_type: run_club`) |

### Events consumed

| Consumer | Usage |
|----------|-------|
| Achievement Engine | Workout counts, streak, completion types |
| Reputation Engine | Consistency and reliability dimensions |
| Workout Activity Layer | `getWorkoutActivityDates` reads completions |
| Notifications | Session invite / reminder triggers |

### UI screens

| Route | Purpose |
|-------|---------|
| `app/(tabs)/events.tsx` | **Training Calendar tab** (not community events) |
| `app/training-calendar/[id].tsx` | Session detail + completion + invite response |
| `app/training-calendar/create.tsx` | Create session |
| `app/training-calendar/edit/[id].tsx` | Edit session |
| `components/training-calendar/*` | Cards, invites rail, activity dots |

### Virtual projections (read-time, no duplicate tables)

| Source | Projection |
|--------|------------|
| Joined community events | `item_type: event` |
| Active challenges | Daily markers in date range |
| Story commitments with `due_at` | Deadline items |

### Future planned extensions

- External calendar sync via `training_calendar_external_links`
- Run clubs, coaching sessions, nutrition challenges as `source_type` / `item_type`
- AI recommendations as `source_type: ai_recommendation`
- Profile upcoming sessions widget
- Session reminders (notification integration)

---

## Training Session Invites

**Owner:** Partner Invites

### Purpose

The **single** partner workout invite system — tied to Training Calendar items. Replaces legacy `story_train_invites` scheduling.

### Responsibilities

- Send invites when creating partner calendar items
- Pending invite list for invitees
- Accept / decline / maybe-later responses
- Participant role assignment on accept
- Invite notifications and deep links
- Activity events for invite lifecycle

### APIs

| Function | Module |
|----------|--------|
| `getPendingTrainingSessionInvites`, `getTrainingSessionInvite` | `training-session-invites.ts` |
| `respondTrainingSessionInvite` | `training-session-invites.ts` |
| Create invite (with calendar item) | `training-calendar.ts` → `createTrainingCalendarItem` |
| Story CTA bridge | `lib/story-calendar-invite.ts` |

### Database tables

| Table | Notes |
|-------|-------|
| `training_session_invites` | Invite records |
| `training_session_participants` | Shared with Training Calendar |

### Events published

| Activity type | Publisher |
|---------------|-----------|
| `workout_invite_sent` | DB trigger on invite INSERT |
| `workout_invite_accepted` | DB trigger on status → accepted |
| `workout_invite_declined` | DB trigger on status → declined |
| `workout_invite_maybe_later` | DB trigger on status → maybe_later |

### Events consumed

| Consumer | Usage |
|----------|-------|
| Reputation Engine | Partnership dimension (accept/decline rates) |
| Achievement Engine | Indirect via partner workout completions |
| Notifications | `training_session_invite`, `training_session_accepted` |

### UI screens

| Route | Purpose |
|-------|---------|
| `app/(tabs)/events.tsx` | Invites rail (`TrainingCalendarInvitesRail`) |
| `app/training-calendar/[id].tsx` | Respond to invite on session detail |
| Story partner CTA | Routes to calendar create with invitee |

### Future planned extensions

- Message-invite source (`source_type: message_invite`)
- Full deprecation of `story_train_invites`
- Group workout invites (extend participants table, not a new invite system)
- Invite accept-rate in Reputation Engine

---

## Favorite Training Partners

**Owner:** Partner Relationships

### Purpose

Quick-access list (max 5) of top training partners in Messages — **invitee picker only**, not a scheduling system.

### Responsibilities

- Favorite / unfavorite conversations (max 5, app-enforced)
- Surface favorites in Messages tab for quick actions
- Emit favoriting activity for reputation
- Provide invitee picker for calendar and story CTAs

### APIs

| Function | Module |
|----------|--------|
| `favoriteConversationForUser`, `unfavoriteConversationForUser` | `messaging.ts` |
| `MAX_FAVORITE_TRAINING_PARTNERS` | `messaging.ts` |

### Database tables

| Table | Notes |
|-------|-------|
| `conversation_user_preferences.favorited_at` | `20250713000001_conversation_favorites.sql` |

### Events published

| Activity type | Publisher |
|---------------|-----------|
| `training_partner_favorited` | API on favorite action |

### Events consumed

| Consumer | Usage |
|----------|-------|
| Reputation Engine | Partnership dimension weight |

### UI screens

| Route | Purpose |
|-------|---------|
| `app/(tabs)/messages.tsx` | Favorites section |
| `components/FavoriteTrainingPartnersSection.tsx` | Partner list |
| `components/FavoritePartnerQuickActions.tsx` | Quick actions |

### Future planned extensions

- Used only as invitee picker; all scheduling stays on Training Calendar + Training Session Invites
- Suggested favorites from match quality (Search / Discovery + Reputation)

---

## Platform Activity Engine

**Owner:** Platform Infrastructure

### Purpose

The **single append-only event stream** for all meaningful Frennix actions. Powers achievements, reputation, analytics, recaps, streaks, leaderboards, and future AI — **no feature-specific tracking tables**.

### Responsibilities

- Canonical event shape and type registry
- Single write path for all activity events
- DB trigger publishers for domain tables
- API hook publishers for imperative actions
- Query APIs for consumers (stream, counts, weekly workout count)
- Deduplication via unique index on `(user_id, activity_type, source_type, source_id)`

### APIs

| Function | Module |
|----------|--------|
| `publishPlatformActivity` | `platform-activity-engine.ts` |
| `getPlatformActivityStream` | `platform-activity-engine.ts` |
| `getPlatformActivityCounts`, `countPlatformActivity` | `platform-activity-engine.ts` |
| `getWeeklyWorkoutCount` | `platform-activity-engine.ts` |
| `publish_platform_activity` | RPC (migration) |

### Database tables

| Table | Notes |
|-------|-------|
| `platform_activity_events` | Append-only ledger |
| `publish_platform_activity()` | Central write RPC |
| `platform_activity_reputation_refresh` | Trigger on INSERT → reputation |

**Key migration:** `20250719000001_platform_activity_engine.sql`

### Event shape

| Field | Description |
|-------|-------------|
| `activity_type` | Canonical action (e.g. `workout_completed`) |
| `source_type` | Originating domain/table |
| `source_id` | UUID of source record |
| `user_id` | Actor |
| `occurred_at` | Timestamp |
| `metadata` | Optional JSON context |

### Canonical activity types

`workout_completed`, `workout_scheduled`, `workout_rescheduled`, `workout_cancelled`, `workout_missed`, `story_posted`, `story_viewed`, `story_reacted`, `story_replied`, `story_commitment_completed`, `feed_post_created`, `feed_post_liked`, `feed_post_commented`, `challenge_joined`, `challenge_completed`, `event_created`, `event_joined`, `event_attended`, `match_created`, `training_partner_favorited`, `message_sent`, `workout_invite_sent`, `workout_invite_accepted`, `workout_invite_declined`, `workout_invite_maybe_later`, `achievement_earned`, `partner_workout_completed`, `run_club_participation`, `group_workout_completed`, `coaching_session_completed`, `positive_interaction`, `helped_beginner`

### Events published

All capability events above flow through this engine. Publishers:

| Publisher type | Examples |
|----------------|----------|
| DB triggers | Posts, likes, comments, calendar status, events, challenges, invites, story views |
| API hooks | Story publish, messages, favorites, matches, calendar delete, achievement unlock |

### Events consumed

This capability **is** the ledger — it does not consume events. Downstream consumers:

| Consumer | How |
|----------|-----|
| Achievement Engine | `getPlatformActivityCounts`, `getWeeklyWorkoutCount` |
| Reputation Engine | `refresh_user_reputation` on INSERT |
| Workout Activity Layer | Aligns with `workout_completed` (also reads source tables) |
| Analytics (future) | Aggregate queries on ledger |
| AI Recommendation Engine (future) | Activity stream + calendar patterns |

### UI screens

None — backend infrastructure layer.

### Future planned extensions

- Weekly / monthly recaps via `getPlatformActivityStream(range)`
- Founder aggregate dashboards on ledger
- Leaderboards from activity counts
- Historical backfill of pre-engine completions
- Wire remaining publishers (`story_reacted`, `positive_interaction`, `helped_beginner`)

---

## Achievement Engine

**Owner:** Gamification

### Purpose

Centralized badge unlocks from **real participation** — reads only from the Platform Activity Engine and workout streak.

### Responsibilities

- Achievement definition catalog
- Rule evaluation against activity counts and streak
- Unlock persistence and display formatting
- Publish `achievement_earned` on unlock
- Profile achievement display

### APIs

| Function | Module |
|----------|--------|
| `evaluateUserAchievements` | `achievement-engine.ts` |
| `getUserAchievements`, `getProfileAchievementDisplays` | `achievement-engine.ts` |
| `computeProfileAchievements` | `achievements.ts` |

### Database tables

| Table | Notes |
|-------|-------|
| `achievement_definitions` | Badge catalog |
| `user_achievements` | Unlocked badges |

**Key migration:** `20250718000001_achievements_reputation.sql`

### Events published

| Activity type | Publisher |
|---------------|-----------|
| `achievement_earned` | API on unlock (`evaluateUserAchievements`) |

### Events consumed

| Activity types read | Usage |
|---------------------|-------|
| All participation types | `getPlatformActivityCounts` per rule |
| `workout_completed` | Weekly workout count, streak rules |
| Workout streak | `getWorkoutStreak` (via workout activity layer) |

### UI screens

| Route | Purpose |
|-------|---------|
| `components/ProfileScreenContent.tsx` | Achievement badges on profile |

### Future planned extensions

- New badges = new rules on **existing** activity types only
- Achievement detail modal with unlock criteria
- Seasonal / event-specific badges (definitions table only)
- **Never** create achievement-specific tracking tables

---

## Reputation Engine

**Owner:** Trust Signals (Internal)

### Purpose

Background consistency and accountability score — **not** popularity. Records positive participation now; **no public UI** until user base is larger.

### Responsibilities

- Weight configuration per activity type across four dimensions
- Aggregate scores on every activity event insert
- Internal score retrieval for future trust surfaces
- Partnership reliability signals (invite accept rate — future)

### APIs

| Function | Module |
|----------|--------|
| `getUserReputationScore` | `reputation.ts` |
| `refreshUserReputation` | `reputation.ts` (internal; also DB trigger) |

### Database tables

| Table | Notes |
|-------|-------|
| `reputation_event_weights` | Per-type dimension weights |
| `user_reputation_scores` | Aggregated scores per user |
| `platform_activity_events` | Shared ledger (read-only for reputation) |

### Reputation dimensions

| Dimension | Examples |
|-----------|----------|
| **Consistency** | Regular workouts, commitments kept |
| **Reliability** | Showing up, completing sessions; misses reduce score |
| **Community** | Events hosted/attended, positive interactions |
| **Partnership** | Partner workouts, invite accept rate |

### Events published

None — reputation is a **consumer**, not a publisher.

### Events consumed

| Consumer | Usage |
|----------|-------|
| All `platform_activity_events` INSERTs | `refresh_user_reputation` trigger |

### UI screens

None — intentionally hidden.

### Future planned extensions

- Profile trust indicators
- Match quality weighting (Search / Discovery)
- Event host credibility badges
- Partnership invite accept-rate dimension
- **Never** build a separate karma or likes score

---

## AI Recommendation Engine

**Owner:** Intelligence (Planned)

### Purpose

Suggest workouts, training partners, and optimal training times based on activity patterns and calendar availability.

### Responsibilities (planned)

- Analyze Platform Activity stream and calendar patterns
- Propose calendar items with `source_type: ai_recommendation`
- Partner and time-slot suggestions in Discover and Messages
- Emit activity events when users accept/dismiss recommendations

### APIs

| Function | Module |
|----------|--------|
| — | **No dedicated module yet** |

**Schema stub:** `training_calendar_items.source_type = 'ai_recommendation'` in `20250717000001_training_calendar_phase2.sql`  
**Type:** `packages/types/src/training-calendar.ts`

### Database tables

| Table | Notes |
|-------|-------|
| `training_calendar_items` | Recommendations stored as calendar items |
| No separate recommendation table | By design |

### Events published (planned)

| Activity type | Publisher |
|---------------|-----------|
| `workout_scheduled` | On user accepting AI suggestion (via calendar) |
| Future: `ai_recommendation_accepted`, `ai_recommendation_dismissed` | TBD — extend activity type enum |

### Events consumed (planned)

| Consumer | Usage |
|----------|-------|
| Platform Activity Engine | Historical patterns |
| Training Calendar | Availability and conflicts |
| Search / Discovery | Match compatibility signals |

### UI screens

None yet.

### Future planned extensions

- Calendar tab "Suggested for you" section
- Partner recommendations in Discover and Messages
- Optimal training time suggestions
- **Rule:** Never create a separate recommendation calendar — extend Training Calendar `source_type` only

---

## Search / Discovery

**Owner:** Discovery

### Purpose

Find people, groups, challenges, stories, and training matches across the platform.

### Responsibilities

- Profile search and athlete suggestions
- Lifestyle / compatibility matching and swipes
- Story discovery lanes (popular, nearby, trending)
- Group and challenge discovery
- Community event browse
- Match creation activity events

### APIs

| Function | Module |
|----------|--------|
| `searchProfiles`, `discoverProfiles` | `profiles.ts` |
| `getSuggestedAthletes`, `scoreProfileCompatibility` | `suggestions.ts` |
| Matching swipes and matches | `matching.ts` |
| Story discovery lanes | `story-discovery.ts` |
| Group discovery | `groups.ts` |
| Challenge listing | `challenges.ts` |

### Database tables

| Table | Notes |
|-------|-------|
| `profiles` + search RPC | `20250529000009_search_profiles.sql` |
| `match_swipes`, `matches` | Matching |
| Lifestyle matching columns | `20250708000001_lifestyle_matching.sql` |

### Events published

| Activity type | Publisher |
|---------------|-----------|
| `match_created` | API on mutual swipe |

### Events consumed

| Consumer | Usage |
|----------|-------|
| Achievement Engine | `match_created` rules |
| Reputation Engine (future) | Match quality from reputation scores |
| AI Recommendation Engine (future) | Compatibility signals |

### UI screens

| Route | Purpose |
|-------|---------|
| `app/(tabs)/discover.tsx` | Main discovery hub |
| `app/matching/index.tsx`, `matching/matches.tsx` | Training matches |
| `app/stories/explore.tsx`, `stories/discover.tsx` | Story discovery |
| `app/events/browse.tsx` | Event browse |
| `app/group/[id].tsx` | Group detail |

### Future planned extensions

- AI-powered recommendations (see AI Recommendation Engine)
- Expanded story discovery lanes
- Location-based athlete discovery
- Reputation-weighted match ranking

---

## Admin / Moderation

**Owner:** Safety & Operations

### Purpose

User safety (block, report, ban), content moderation, trainer review, and founder/staff operations.

### Responsibilities

- User blocking and content reporting
- Admin ban and content removal
- Trainer application review
- Founder ops dashboard (staff, health, flags, inbox)
- Staff capability-based access (`has_staff_capability`)
- Beta feedback triage

### APIs

| Function | Module |
|----------|--------|
| `blockUser`, `reportContent`, `reportPost` | `moderation.ts` |
| `getModerationReports`, `adminBanUser`, `adminDeletePost` | `moderation.ts` |
| Founder ops suite | `packages/api/src/founder/*` (not in main barrel) |
| Trainer review | `trainer.ts` |

### Database tables

| Table | Notes |
|-------|-------|
| `blocks`, `reports` | User safety |
| `profiles.is_admin`, `profiles.is_banned` | Admin flags |
| `staff_memberships`, `staff_invites` | Staff access |
| `founder_audit_log`, `feature_flags` | Founder ops (`20250701000001`) |
| `challenge_reports` | Challenge-specific reports |

### Events published

None to `platform_activity_events` — moderation actions are operational, not gamified.

### Events consumed

None.

### UI screens

| Route | Purpose |
|-------|---------|
| `app/admin-moderation.tsx` | Content moderation |
| `app/admin-trainer-review.tsx` | Trainer applications |
| `app/admin-feedback.tsx` | Beta feedback |
| `app/blocked-users.tsx` | Blocked users list |
| `app/founder/*` | Founder ops suite (activity, moderation, analytics, flags, inbox, platform, roadmap, releases) |
| `app/staff/join.tsx` | Staff onboarding |

### Future planned extensions

- Full capability-based RBAC for staff roles
- Automated moderation signals from report volume
- Reputation integration for repeat offenders (internal only)
- Founder roadmap and release management tooling

---

## Analytics

**Owner:** Platform Insights

### Purpose

Three parallel insight systems: client product analytics, the platform activity ledger, and founder ops metrics.

### Responsibilities

- Client-side product event tracking (`product_events`)
- Daily active user tracking
- Founder executive dashboard and community health
- Story engagement analytics
- Future: weekly recaps and ledger aggregates

### APIs

| Function | Module |
|----------|--------|
| `trackProductEvent`, `trackDailyActiveUser` | `analytics.ts` |
| `getProductAnalyticsSummary` | `analytics.ts` |
| `getDedicatedStoryAnalytics` | `story-engagement.ts` |
| Founder dashboards | `packages/api/src/founder/*` (`getExecutiveDashboard`, `getMatchmakingAnalytics`, `getCommunityHealth`, `getPlatformHealth`) |
| Client wrapper | `lib/product-analytics.ts` |

### Database tables

| Table | Notes |
|-------|-------|
| `product_events` | Client product analytics (`20250629000001`) |
| `founder_activity_events`, `founder_metrics_daily` | Founder ops (`20250701000001`) |
| `platform_activity_events` | Participation ledger (shared) |
| `story_engagement_events` | Legacy story metrics |

### Events published

| System | Events |
|--------|--------|
| Product analytics | `product_events` via `trackProductEvent` (separate from platform activity) |
| Platform Activity Engine | Meaningful user actions (see above) |

### Events consumed

| Consumer | Usage |
|----------|-------|
| Founder dashboards | `product_events`, `founder_metrics_daily` |
| Story analytics modal | `story_engagement_events` |
| Future recaps | `getPlatformActivityStream` on ledger |

### UI screens

| Route | Purpose |
|-------|---------|
| `app/admin-analytics.tsx` | Admin analytics |
| `app/founder/analytics/[domain].tsx`, `analytics/users.tsx` | Founder analytics |
| `app/founder/activity.tsx` | Platform activity feed |
| Story analytics modal | On home feed |

### Future planned extensions

- Weekly / monthly user recaps from Platform Activity Engine
- Founder aggregates on `platform_activity_events` (not duplicate tables)
- Matchmaking analytics dashboard (`get_matchmaking_analytics` RPC)
- Funnel analysis from `product_events`
- **Rule:** Do not create per-feature analytics tables — use ledger + product events

---

## Cross-capability dependency map

```
Training Calendar ──────► Platform Activity Engine ──────► Achievement Engine
        │                            │                           │
        │                            └──────────► Reputation Engine
        │
        ├── Events (virtual projection)
        ├── Challenges (virtual projection)
        ├── Stories (commitments, partner CTA)
        ├── Messaging (future: schedule workout)
        └── Training Session Invites

Notifications ◄── all capabilities (downstream alerts)
Search / Discovery ◄── Profiles, Stories, Events, Challenges, Matching
Analytics ◄── product_events + platform_activity_events + founder tables
Admin / Moderation ◄── reports from all user-facing capabilities
```

---

## Adding a new capability

Under the **Architecture Freeze Rule**, new capabilities are the exception — not the default.

Only create a new entry in this registry when:

1. No existing capability can **reasonably** support the feature (documented justification required)
2. The feature has a **distinct bounded responsibility** that extension would violate
3. The team has assigned an **owner** and documented all sections above

When extending an existing capability, update **that capability's section** only — do not add a parallel system. Most future work should be user-facing polish on top of existing capabilities.

---

## Related documents

- [`SYSTEM_ARCHITECTURE.md`](./SYSTEM_ARCHITECTURE.md) — Architecture Freeze Rule, diagrams, migration index
- [`features/PRODUCT_VISION.md`](../features/PRODUCT_VISION.md) — product principles
- [`features/PRODUCT-ROADMAP.md`](../features/PRODUCT-ROADMAP.md) — delivery phases

**Maintainers:** Update capability sections when extending existing systems. New capability entries require documented justification per the Architecture Freeze Rule.
