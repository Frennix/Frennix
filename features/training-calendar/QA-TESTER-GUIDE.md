# Training Calendar — QA Tester Guide

**Status:** Pre-release QA (do not merge to `main` until founder sign-off)  
**Build branch:** `hotfix/v1.0.1-safari-tab-layout`  
**Last updated:** 2026-07-04

---

## How to access the test build

### Option A — Vercel preview (recommended for web / iPhone Safari)

| Field | Value |
|-------|--------|
| **Branch** | `hotfix/v1.0.1-safari-tab-layout` |
| **Commit** | `de164e6` (+ any QA fix commits after this doc) |
| **Preview URL** | https://frennix-gk1p4t3v1-frennix-s-projects.vercel.app |
| **Alternate preview** | https://mobile-c96810x63-frennix-s-projects.vercel.app |

**Note:** Preview URLs may require **Vercel team SSO** login on first visit. After authenticating, the app loads normally.

**Production is NOT updated:** https://frennix.vercel.app still shows the old **Events** tab until you approve release.

### Option B — Local dev (recommended for native Expo)

```bash
cd apps/mobile
npx expo start --tunnel
```

Scan the QR code on your phone. Uses the same Supabase backend as production.

---

## Where to find the Training Calendar

1. **Sign in** to Frennix.
2. Look at the **bottom tab bar** (left → right):

   **Feed · Discover · Calendar · Post · Messages · Profile**

3. Tap the **third tab** — labeled **“Calendar”** (calendar/events icon).

4. You should see:
   - Header: **“Training Calendar”**
   - Subtitle: *Your hub for workouts, events, and challenges*
   - **+ Add** button (top right)
   - Workout **streak** badge
   - **Community events** link
   - **Month / Week** toggle
   - Calendar grid or week list

### Navigation paths

| Action | Path |
|--------|------|
| Open Calendar | Bottom tab → **Calendar** (`/(tabs)/events`) |
| Create session | Calendar → **+ Add** → `/training-calendar/create` |
| Session detail | Calendar → tap session card → `/training-calendar/[id]` |
| Edit session | Session detail → **Edit session** → `/training-calendar/edit/[id]` |
| Community events | Calendar → **Community events** → `/events/browse` |
| Partner invite (Messages) | Messages → Favorite partner → **🤝 Invite to Workout** → create form |
| Partner invite (Story) | Feed → open story → **🤝 Invite to Workout** → create form |
| Notifications | Bell icon → tap training session notification → session detail |

---

## Infrastructure confirmation (engineering)

| Check | Result |
|-------|--------|
| Automated verify script | `npm run verify:training-calendar` → **44/44 PASS** |
| Supabase migrations synced | **76/76** local = remote |
| Calendar tables | `training_calendar_items`, `training_session_invites`, `training_session_participants` ✓ |
| Platform activity engine | `platform_activity_events` + triggers ✓ |
| RLS fix | `20250720000001_training_calendar_rls_fix` ✓ |
| End-to-end wiring | Calendar tab → API → Supabase → notifications → profile streak |

### Calendar-specific migrations applied

- `20250716000001_training_calendar.sql`
- `20250717000001_training_calendar_phase2.sql`
- `20250718000001_achievements_reputation.sql`
- `20250719000001_platform_activity_engine.sql`
- `20250720000001_training_calendar_rls_fix.sql`

---

## Important testing notes

### Status buttons (Completed / Missed / Rescheduled)

These appear only when **all** of the following are true:

- You are the **session owner**
- Session status is **scheduled**
- Session **end time is in the past**

**Tip for testing:** Create a session with start/end time **1–2 hours ago**, then open it to see **“How did it go?”**

### Partner workout invites

Invites are sent when you **save a session** that includes an `invitee`. Paths that pre-fill a partner:

1. **Messages** → Favorite Training Partner → **🤝 Invite to Workout**
2. **Feed** → Story viewer → **🤝 Invite to Workout**

Selecting **Partner workout** type on a blank create form **without** a partner does **not** send an invite.

### Second account for invite testing

Use **Account A** (inviter) and **Account B** (invitee) for accept / decline / maybe later / notification tests.

---

## Training Calendar — step-by-step checklist

Record **Pass / Fail / Notes** for each item.

### 1. Open the Calendar

- [ ] Third bottom tab is labeled **Calendar** (not “Events”)
- [ ] **Training Calendar** header visible
- [ ] **+ Add** button works
- [ ] Streak badge visible
- [ ] **Community events** link opens browse screen
- [ ] Pull-to-refresh works without error
- [ ] No crash or black screen after login

### 2. Create a workout session

- [ ] Tap **+ Add**
- [ ] Enter title, session type, date, start/end time
- [ ] Optional: location, notes, workout type, privacy
- [ ] Tap **Add to calendar**
- [ ] Returns to Calendar tab
- [ ] Session appears on correct day (month grid dot + day list)

### 3. Edit a workout session

- [ ] Open session from calendar
- [ ] Tap **Edit session**
- [ ] Change title, time, or location → save
- [ ] Changes reflect on Calendar tab after refresh

### 4. Delete a workout session

- [ ] Open session → **Delete session**
- [ ] Confirm deletion
- [ ] Session removed from calendar

### 5. Invite a training partner

**Account A:**

- [ ] Messages → Favorite Training Partner → **🤝 Invite to Workout**
- [ ] Create form opens with partner pre-filled (partner workout type)
- [ ] Set date/time → **Add to calendar**
- [ ] Account B receives notification (or sees invite on Calendar tab)

**Alternate path:**

- [ ] Feed → Account B’s story → **🤝 Invite to Workout** → save session

### 6. Accept an invite

**Account B:**

- [ ] **Invites rail** on Calendar tab shows pending invite
- [ ] Tap **Accept** (on rail or session detail)
- [ ] Invite clears from pending rail
- [ ] Session visible on Account B’s calendar

### 7. Decline an invite

- [ ] Account A sends new invite to Account B
- [ ] Account B taps **Decline**
- [ ] Invite removed; session not on B’s calendar

### 8. Maybe Later

- [ ] Account A sends new invite
- [ ] Account B taps **Maybe later**
- [ ] Invite remains respondable from session detail or rail

### 9. Notification deep links

**Account B** (with pending invite):

- [ ] Open **Notifications** (bell icon)
- [ ] Tap `training_session_invite` notification
- [ ] Lands on **correct session detail** (`/training-calendar/[id]`)
- [ ] (If testable) `training_session_accepted` opens session for inviter
- [ ] (If testable) `training_session_reminder` opens session

### 10. Mark workout as Completed

- [ ] Create session with **end time in the past**
- [ ] Open session → **How did it go?** → **Completed**
- [ ] Share sheet may appear (optional — tap Done)
- [ ] Status shows completed on calendar
- [ ] Green activity dot on that day (if applicable)

### 11. Mark workout as Missed

- [ ] New past scheduled session → **Missed**
- [ ] Status updates on calendar

### 12. Mark workout as Rescheduled

- [ ] New past scheduled session → **Rescheduled**
- [ ] Create form opens with date pre-filled
- [ ] Save new session; original marked rescheduled

### 13. Verify streaks update correctly

- [ ] Note streak on Calendar tab before completing workout
- [ ] Mark a session **Completed** (today or recent)
- [ ] Pull to refresh Calendar — streak updates
- [ ] Open **Profile** tab — streak matches Calendar

### 14. Verify upcoming sessions display correctly

- [ ] Create session **tomorrow** — visible when navigating to tomorrow
- [ ] Create session **next week** — visible in month/week views
- [ ] Virtual items (joined events / active challenges) appear if applicable

### 15. Verify weekly view

- [ ] Toggle to **Week**
- [ ] Navigate prev/next week
- [ ] Sessions listed per day
- [ ] Tap session opens detail

### 16. Verify monthly view

- [ ] Toggle to **Month**
- [ ] Navigate prev/next month
- [ ] Activity dots on days with sessions
- [ ] Select day — sessions listed below grid
- [ ] Tap session card opens detail

---

## Regression checklist (existing features)

Confirm these still work while testing Calendar. **Pass / Fail / Notes** each section.

### Feed

- [ ] Home feed loads posts
- [ ] Like, comment, save work
- [ ] Stories rail visible and tappable
- [ ] Create post flow works

### Stories

- [ ] View workout stories from feed
- [ ] Story reactions / reply work
- [ ] Create story flow opens
- [ ] Story quick actions (message, profile, invite) work

### Messaging

- [ ] Conversation list loads
- [ ] Open chat, send/receive messages
- [ ] Pin, mute, favorite conversation preferences work

### Favorite Training Partners

- [ ] Favorites section visible on Messages tab
- [ ] Quick actions: message, profile, story, workout invite, event invite
- [ ] Max 5 favorites enforced (if testable)

### Events

- [ ] Calendar → **Community events** → browse loads
- [ ] Open event detail, join/leave works
- [ ] Joined events appear on Calendar (virtual projection)

### Matchmaking

- [ ] Discover → matching flow loads
- [ ] Swipe / matches screen accessible
- [ ] Match notification opens chat or matches

### Notifications

- [ ] Notification inbox loads
- [ ] Message, event, challenge notifications still deep-link correctly
- [ ] Mark as read works

### Profile

- [ ] Own profile loads with stats
- [ ] Edit profile works
- [ ] Achievements display (if any unlocked)
- [ ] Followers / following lists work

### Workout posting

- [ ] Create post (workout type) from **Post** tab or feed
- [ ] Post appears on feed and profile

### Story creation

- [ ] Create story from feed
- [ ] Publish succeeds; story appears in rail

### Performance

- [ ] No crashes during Calendar flows
- [ ] No prolonged freezes (>3s) on tab switch
- [ ] Calendar month navigation feels responsive
- [ ] iPhone Safari: no black screen after login
- [ ] Scrolling feed and calendar is smooth

---

## Sign-off

When all critical Calendar items pass:

> **Reply:** *“Training Calendar verified — approved to merge to main and deploy to production.”*

Until then: **no merge to `main`**, **no production deploy**.

### After approval (engineering only)

1. Merge `hotfix/v1.0.1-safari-tab-layout` → `main`
2. `npx supabase db push` (confirm still synced)
3. `npm run build:web` + commit `dist/` if needed
4. `vercel deploy --prod`
5. Verify https://frennix.vercel.app shows **Calendar** tab

---

## Development principles (reminder)

- Extend existing architecture before creating new systems
- Polish, performance, and reliability over more infrastructure
- Finish features completely before starting the next priority
- Every feature should help users stay **consistent** with their fitness journey
