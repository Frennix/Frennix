# Critical User Flows — vX.Y.Z Verification

**Copy this file for each release:** `features/releases/critical-flows/vX.Y.Z-CUF-VERIFICATION.md`  
**Master checklist:** [`checklists/CRITICAL-USER-FLOWS.md`](../checklists/CRITICAL-USER-FLOWS.md)

---

## Release metadata

| Field | Value |
|-------|-------|
| Version | vX.Y.Z |
| Build tested | |
| Commit SHA | |
| Tester(s) | |
| Verification window | |
| **All critical flows pass** | ⬜ |

---

## Authentication

| ID | Flow | Tester | Date | Device | Browser | Version | Pass/Fail | Notes |
|----|------|--------|------|--------|---------|---------|-----------|-------|
| AUTH-01 | User can sign up | | | | | | ⬜ | |
| AUTH-02 | User can log in | | | | | | ⬜ | |
| AUTH-03 | User can log out | | | | | | ⬜ | |
| AUTH-04 | Password reset works | | | | | | ⬜ | |

## Feed

| ID | Flow | Tester | Date | Device | Browser | Version | Pass/Fail | Notes |
|----|------|--------|------|--------|---------|---------|-----------|-------|
| FEED-01 | Feed loads correctly | | | | | | ⬜ | |
| FEED-02 | Pull-to-refresh works | | | | | | ⬜ | |
| FEED-03 | Infinite scrolling works | | | | | | ⬜ | |

## Posts

| ID | Flow | Tester | Date | Device | Browser | Version | Pass/Fail | Notes |
|----|------|--------|------|--------|---------|---------|-----------|-------|
| POST-01 | Create a workout post | | | | | | ⬜ | |
| POST-02 | Create a photo post | | | | | | ⬜ | |
| POST-03 | Create a video post | | | | | | ⬜ | |
| POST-04 | Edit a post | | | | | | ⬜ | |
| POST-05 | Delete a post | | | | | | ⬜ | |

## Stories

| ID | Flow | Tester | Date | Device | Browser | Version | Pass/Fail | Notes |
|----|------|--------|------|--------|---------|---------|-----------|-------|
| STORY-01 | Create a story | | | | | | ⬜ | |
| STORY-02 | View stories | | | | | | ⬜ | |
| STORY-03 | Story expiration works | | | | | | ⬜ | |

## Interactions

| ID | Flow | Tester | Date | Device | Browser | Version | Pass/Fail | Notes |
|----|------|--------|------|--------|---------|---------|-----------|-------|
| INT-01 | Like a post | | | | | | ⬜ | |
| INT-02 | React to a post | | | | | | ⬜ | |
| INT-03 | Comment on a post | | | | | | ⬜ | |
| INT-04 | Reply to a comment | | | | | | ⬜ | |
| INT-05 | Bottom action sheet fully visible (mobile browsers) | | | | | | ⬜ | |

## Messaging

| ID | Flow | Tester | Date | Device | Browser | Version | Pass/Fail | Notes |
|----|------|--------|------|--------|---------|---------|-----------|-------|
| MSG-01 | Send a message | | | | | | ⬜ | |
| MSG-02 | Receive a message | | | | | | ⬜ | |
| MSG-03 | Send images | | | | | | ⬜ | |
| MSG-04 | Read receipts function correctly | | | | | | ⬜ | |

## Profile

| ID | Flow | Tester | Date | Device | Browser | Version | Pass/Fail | Notes |
|----|------|--------|------|--------|---------|---------|-----------|-------|
| PROF-01 | Update profile | | | | | | ⬜ | |
| PROF-02 | Change profile photo | | | | | | ⬜ | |
| PROF-03 | Edit fitness interests and goals | | | | | | ⬜ | |

## Social

| ID | Flow | Tester | Date | Device | Browser | Version | Pass/Fail | Notes |
|----|------|--------|------|--------|---------|---------|-----------|-------|
| SOC-01 | Follow and unfollow users | | | | | | ⬜ | |
| SOC-02 | User search works | | | | | | ⬜ | |
| SOC-03 | Discover page loads correctly | | | | | | ⬜ | |

## Calendar & events

| ID | Flow | Tester | Date | Device | Browser | Version | Pass/Fail | Notes |
|----|------|--------|------|--------|---------|---------|-----------|-------|
| CAL-01 | Calendar loads | | | | | | ⬜ | |
| CAL-02 | Create a training session | | | | | | ⬜ | |
| CAL-03 | View today's training | | | | | | ⬜ | |
| CAL-04 | Events load correctly | | | | | | ⬜ | |
| CAL-05 | RSVP works | | | | | | ⬜ | |

## Notifications

| ID | Flow | Tester | Date | Device | Browser | Version | Pass/Fail | Notes |
|----|------|--------|------|--------|---------|---------|-----------|-------|
| NOTIF-01 | Notifications appear | | | | | | ⬜ | |
| NOTIF-02 | Notification center loads | | | | | | ⬜ | |
| NOTIF-03 | Notifications can be dismissed or deleted | | | | | | ⬜ | |

## General UI

| ID | Flow | Tester | Date | Device | Browser | Version | Pass/Fail | Notes |
|----|------|--------|------|--------|---------|---------|-----------|-------|
| UI-01 | No console errors during critical flows | | | | | | ⬜ | |
| UI-02 | No uncaught production exceptions | | | | | | ⬜ | |
| UI-03 | All modals respect safe areas on iPhone Safari | | | | | | ⬜ | |
| UI-04 | Buttons fully visible and tappable | | | | | | ⬜ | |

## Failure log

| Flow ID | Bug ID | RELEASE.md | BUG-LIST | Fixed | Re-tested |
|---------|--------|------------|----------|-------|-----------|
| | | ⬜ | ⬜ | ⬜ | ⬜ |

## Sign-off

| Role | Name | Date | All flows ✅ | Approved |
|------|------|------|--------------|----------|
| QA / Founder | | | ⬜ | ⬜ |

**Approval phrase:** `Critical user flows verified — approved for production vX.Y.Z`
