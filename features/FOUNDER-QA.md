# Founder QA Checklist

**Purpose:** Verify every production release on a physical iPhone (Safari) before sign-off.  
**URL:** https://frennix.vercel.app  
**How to use:** Hard-refresh Safari before testing. Check each box. Note device, date, and any failures in the release file.

**Release:** _______________  
**Tester:** _______________  
**Date:** _______________  
**Device / Browser:** iPhone ___ / Safari ___  
**Build / commit:** _______________

---

## Authentication

- [ ] **Login** — existing account signs in; lands on Feed
- [ ] **Signup** — new account flow completes (staging only unless approved)
- [ ] **Password reset** — reset email/link works; can set new password
- [ ] **Logout** — session clears; returns to auth screen
- [ ] **Session resume** — close Safari tab, reopen app URL; still signed in

---

## Feed

- [ ] Feed loads without long blank screen
- [ ] Posts display images/video correctly
- [ ] Scroll is smooth (no freeze)
- [ ] Pull-to-refresh works
- [ ] Like a post
- [ ] **Double-tap** post media to like
- [ ] Open post interaction sheet (Like, Strong Work, Reply, More)
- [ ] Open comments from feed
- [ ] Share a post
- [ ] Stories row loads and opens viewer
- [ ] People You May Know carousel loads
- [ ] Tap post author → profile opens

---

## Posting

- [ ] Create text-only workout post
- [ ] Create post with **photo upload**
- [ ] Create post with **video upload**
- [ ] Edit caption / workout types before post
- [ ] Post appears in Feed after publish
- [ ] Post appears on Profile grid

---

## Likes & engagement

- [ ] Like from feed
- [ ] Unlike from feed
- [ ] Strong Work reaction
- [ ] Like count updates correctly

---

## Comments

- [ ] Open post detail
- [ ] Add comment
- [ ] **Reply** to comment (threaded)
- [ ] **Edit** own comment
- [ ] **Delete** own comment
- [ ] Like comment

---

## Stories

- [ ] View own story from Feed
- [ ] View partner story from Feed / Messages favorites
- [ ] Story progress advances; tap to skip
- [ ] Swipe between stories
- [ ] Close story viewer returns to previous screen
- [ ] **Story viewers list** (own story → Viewed By)
- [ ] Create story from post flow (if applicable)

---

## Story Viewer

- [ ] Media loads without long stall
- [ ] Workout overlay readable
- [ ] Quick actions work (message, invite, etc.)
- [ ] No layout clipped by safe area / home indicator

---

## Messaging

- [ ] Messages tab opens quickly (cached feel after first load)
- [ ] Conversation list shows correct previews and unread badges
- [ ] Open conversation → messages load
- [ ] Send text message
- [ ] Send **photo** in chat
- [ ] Receive message (or verify with second account)
- [ ] **Edit mode** — enter, select, exit
- [ ] **Select All** in edit mode
- [ ] **Pin** conversation (⋮ menu)
- [ ] **Archive** conversation
- [ ] **Mute** conversation
- [ ] **Mark Read** / **Mark Unread**
- [ ] **Delete** single conversation + confirm
- [ ] **Undo** delete within snackbar window
- [ ] **Bulk delete** selected conversations
- [ ] Delete message for me
- [ ] Delete own message for everyone (if applicable)
- [ ] Favorite training partners row works

---

## Notifications

- [ ] Bell badge matches unread count
- [ ] Open notifications list
- [ ] Tap notification → correct destination
- [ ] Mark single notification read
- [ ] Mark all read
- [ ] **Delete** notification (swipe or button)
- [ ] **Bulk delete** notifications (Edit → select → Delete)
- [ ] Pull-to-refresh notifications

---

## Calendar

- [ ] Calendar tab opens without long skeleton (after first visit)
- [ ] Month grid shows sessions / activity dots
- [ ] Switch month / week view
- [ ] Tap day → sessions list updates
- [ ] Open training session detail
- [ ] Create session from FAB
- [ ] Respond to session invite
- [ ] Pull-to-refresh calendar

---

## Events

- [ ] Browse community events
- [ ] Open event detail
- [ ] Join / leave event (if applicable)
- [ ] Event posts load on detail screen

---

## Discover

- [ ] People tab loads suggestions
- [ ] Search people
- [ ] Lifestyle filters work
- [ ] Follow from Discover card
- [ ] Groups tab loads
- [ ] Search groups
- [ ] Challenges tab loads
- [ ] Open challenge detail
- [ ] Pull-to-refresh on each tab

---

## Training Partner Matching

- [ ] Open matching from Discover or dedicated entry
- [ ] View matches list
- [ ] Swipe / action on match (per current UX)
- [ ] Message match from matching flow

---

## Trainer Search

- [ ] Open trainer search
- [ ] Search returns results
- [ ] Open trainer profile
- [ ] Contact / message trainer (if applicable)

---

## Profile

- [ ] Own profile tab loads stats and posts
- [ ] Edit **display name** / bio
- [ ] **Photo upload** — change avatar
- [ ] Cover photo displays
- [ ] Post grid tap opens post
- [ ] Achievements / highlights rail
- [ ] View another user's profile from Feed
- [ ] Follow / unfollow from profile

---

## Search

- [ ] Discover people search returns results
- [ ] Group search returns results
- [ ] Results navigate to correct profile/group

---

## Settings & account

- [ ] Open Settings from Profile
- [ ] Notification preferences screen loads
- [ ] Privacy settings load
- [ ] Online status preference respected (no dot when hidden)

---

## Media viewer

- [ ] Open post image full screen / lightbox
- [ ] Pinch zoom (native / web as supported)
- [ ] Video plays in feed and post detail

---

## Online status

- [ ] Green dot shows when online (if enabled)
- [ ] Last seen / active labels reasonable
- [ ] Hidden status respects privacy setting

---

## Cross-cutting

- [ ] Tab switches feel responsive (Feed ↔ Messages ↔ Discover ↔ Calendar ↔ Profile)
- [ ] No white flash on navigation
- [ ] Dark theme consistent across screens
- [ ] Safe area respected (notch, home indicator)
- [ ] Offline: cached Messages still visible with banner (optional test)
- [ ] Error states show friendly message + retry where applicable
- [ ] Empty states show helpful copy + action

---

## Sign-off

| Result | |
|--------|---|
| **PASS** — safe to keep production / approve release | ☐ |
| **FAIL** — block release; log issues in `BUG-TRACKER.md` | ☐ |

**Notes:**

```
( failures, device quirks, screenshots )
```

**Approver signature / date:** _______________
