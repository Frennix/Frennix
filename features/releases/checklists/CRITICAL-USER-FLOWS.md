# Critical User Flows Verification

**Status:** Permanent — required for **every** Frennix production deployment  
**Phase:** 3 (Human QA) + **mandatory pre-production gate** (Phase 5)  
**Owner:** Founder / QA  
**Blocks:** Production deploy and release completion if any flow fails

> Run the **full** checklist before every production deployment — **regardless of which feature changed**. A patch that only touches messaging still verifies authentication, feed, posts, stories, and every other flow below.

**Per-release record:** Copy [`templates/CRITICAL-USER-FLOWS-VERIFICATION-TEMPLATE.md`](../templates/CRITICAL-USER-FLOWS-VERIFICATION-TEMPLATE.md) → `features/releases/critical-flows/vX.Y.Z-CUF-VERIFICATION.md` and fill every row before deploy.

**Legend:** ✅ Pass · ❌ Fail · ⬜ Not tested · N/A Not applicable (document why)

---

## Release requirements (non-negotiable)

1. **Every flow below must pass** on the build targeted for production (staging URL or final production candidate).
2. **Production deployment cannot be marked complete** until all applicable flows are ✅ on production.
3. **Any failure** → create a bug row in the **active release** [`RELEASE.md`](../RELEASE.md) and [`vX.Y.Z-BUG-LIST.md`](../v1.0.3-BUG-LIST.md) **before** fixing. Include flow ID, device, and browser in the bug description.
4. **Record for every flow:** Tester · Date · Device · Browser · Version tested · Pass/Fail · Notes.

### Recommended test matrix (minimum)

| Priority | Device | Browser |
|----------|--------|---------|
| **Required** | iPhone (any) | Safari |
| **Required** | iPhone (any) | Chrome |
| **Required** | Android | Chrome |
| **Required** | Desktop | Chrome or Safari |

Use the smallest supported iPhone for safe-area / bottom sheet flows. See also [`OVERLAY-MODAL-QA.md`](./OVERLAY-MODAL-QA.md).

---

## Release metadata

| Field | Value |
|-------|-------|
| Version | vX.Y.Z |
| Build tested | staging / production candidate URL |
| Commit SHA | |
| Tester(s) | |
| Verification window | YYYY-MM-DD → YYYY-MM-DD |
| **All critical flows pass** | ⬜ |

---

## Authentication

| ID | Flow | Tester | Date | Device | Browser | Version | Pass/Fail | Notes |
|----|------|--------|------|--------|---------|---------|-----------|-------|
| AUTH-01 | User can sign up | | | | | | ⬜ | |
| AUTH-02 | User can log in | | | | | | ⬜ | |
| AUTH-03 | User can log out | | | | | | ⬜ | |
| AUTH-04 | Password reset works | | | | | | ⬜ | |

---

## Feed

| ID | Flow | Tester | Date | Device | Browser | Version | Pass/Fail | Notes |
|----|------|--------|------|--------|---------|---------|-----------|-------|
| FEED-01 | Feed loads correctly | | | | | | ⬜ | |
| FEED-02 | Pull-to-refresh works | | | | | | ⬜ | |
| FEED-03 | Infinite scrolling works | | | | | | ⬜ | |

---

## Posts

| ID | Flow | Tester | Date | Device | Browser | Version | Pass/Fail | Notes |
|----|------|--------|------|--------|---------|---------|-----------|-------|
| POST-01 | Create a workout post | | | | | | ⬜ | |
| POST-02 | Create a photo post | | | | | | ⬜ | |
| POST-03 | Create a video post | | | | | | ⬜ | |
| POST-04 | Edit a post | | | | | | ⬜ | |
| POST-05 | Delete a post | | | | | | ⬜ | |

---

## Stories

| ID | Flow | Tester | Date | Device | Browser | Version | Pass/Fail | Notes |
|----|------|--------|------|--------|---------|---------|-----------|-------|
| STORY-01 | Create a story | | | | | | ⬜ | |
| STORY-02 | View stories | | | | | | ⬜ | |
| STORY-03 | Story expiration works | | | | | | ⬜ | |

---

## Interactions

| ID | Flow | Tester | Date | Device | Browser | Version | Pass/Fail | Notes |
|----|------|--------|------|--------|---------|---------|-----------|-------|
| INT-01 | Like a post | | | | | | ⬜ | |
| INT-02 | React to a post | | | | | | ⬜ | |
| INT-03 | Comment on a post | | | | | | ⬜ | |
| INT-04 | Reply to a comment | | | | | | ⬜ | |
| INT-05 | Bottom action sheet fully visible on all supported mobile browsers | | | | | | ⬜ | See [`OVERLAY-MODAL-QA.md`](./OVERLAY-MODAL-QA.md) |

---

## Messaging

| ID | Flow | Tester | Date | Device | Browser | Version | Pass/Fail | Notes |
|----|------|--------|------|--------|---------|---------|-----------|-------|
| MSG-01 | Send a message | | | | | | ⬜ | |
| MSG-02 | Receive a message | | | | | | ⬜ | |
| MSG-03 | Send images | | | | | | ⬜ | |
| MSG-04 | Read receipts function correctly | | | | | | ⬜ | |

---

## Profile

| ID | Flow | Tester | Date | Device | Browser | Version | Pass/Fail | Notes |
|----|------|--------|------|--------|---------|---------|-----------|-------|
| PROF-01 | Update profile | | | | | | ⬜ | |
| PROF-02 | Change profile photo | | | | | | ⬜ | |
| PROF-03 | Edit fitness interests and goals | | | | | | ⬜ | |

---

## Social

| ID | Flow | Tester | Date | Device | Browser | Version | Pass/Fail | Notes |
|----|------|--------|------|--------|---------|---------|-----------|-------|
| SOC-01 | Follow and unfollow users | | | | | | ⬜ | |
| SOC-02 | User search works | | | | | | ⬜ | |
| SOC-03 | Discover page loads correctly | | | | | | ⬜ | |

---

## Calendar & events

| ID | Flow | Tester | Date | Device | Browser | Version | Pass/Fail | Notes |
|----|------|--------|------|--------|---------|---------|-----------|-------|
| CAL-01 | Calendar loads | | | | | | ⬜ | |
| CAL-02 | Create a training session | | | | | | ⬜ | |
| CAL-03 | View today's training | | | | | | ⬜ | |
| CAL-04 | Events load correctly | | | | | | ⬜ | |
| CAL-05 | RSVP works | | | | | | ⬜ | |

---

## Notifications

| ID | Flow | Tester | Date | Device | Browser | Version | Pass/Fail | Notes |
|----|------|--------|------|--------|---------|---------|-----------|-------|
| NOTIF-01 | Notifications appear | | | | | | ⬜ | |
| NOTIF-02 | Notification center loads | | | | | | ⬜ | |
| NOTIF-03 | Notifications can be dismissed or deleted | | | | | | ⬜ | |

---

## General UI

| ID | Flow | Tester | Date | Device | Browser | Version | Pass/Fail | Notes |
|----|------|--------|------|--------|---------|---------|-----------|-------|
| UI-01 | No console errors during critical flows | | | | | | ⬜ | |
| UI-02 | No uncaught production exceptions | | | | | | ⬜ | Check Sentry if available |
| UI-03 | All modals respect safe areas on iPhone Safari | | | | | | ⬜ | [`OVERLAY-MODAL-QA.md`](./OVERLAY-MODAL-QA.md) |
| UI-04 | Buttons fully visible and tappable on supported devices | | | | | | ⬜ | incl. Dynamic Type spot-check |

---

## Failure log (auto-create bugs)

| Flow ID | Bug ID | Added to RELEASE.md | Added to BUG-LIST | Fixed | Re-tested |
|---------|--------|---------------------|-------------------|-------|-----------|
| | | ⬜ | ⬜ | ⬜ | ⬜ |

---

## Sign-off

| Role | Name | Date | All flows ✅ | Approved |
|------|------|------|--------------|----------|
| QA / Founder | | | ⬜ | ⬜ |

**Approval phrase:** `Critical user flows verified — approved for production vX.Y.Z`

**Production deploy blocked until** this sign-off is ✅ and linked from the release file.

---

## Related checklists

- [`HUMAN-QA.md`](./HUMAN-QA.md) — platform matrix
- [`OVERLAY-MODAL-QA.md`](./OVERLAY-MODAL-QA.md) — modals & bottom sheets
- [`STAGING-DEPLOYMENT.md`](./STAGING-DEPLOYMENT.md)
- [`PRODUCTION-DEPLOYMENT.md`](./PRODUCTION-DEPLOYMENT.md)
- [`RELEASE-COMPLETION.md`](./RELEASE-COMPLETION.md)
