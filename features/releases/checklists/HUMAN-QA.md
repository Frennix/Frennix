# Human QA Checklist

**Phase:** 3 of 7  
**Owner:** Founder / QA  
**Blocks:** Staging deployment (Phase 4)

**Prerequisite (Phase 2.5):** Review [`RELEASE-vX.Y.Z-READINESS.md`](../RELEASE-vX.Y.Z-READINESS.md). Human QA begins only when the report recommends **Ready for Human QA** and the Founder replies e.g. *"Approved — begin Human QA vX.Y.Z"*.

Test on **all three platforms** unless release scope explicitly excludes one (document exception in release file).

**Critical User Flows (mandatory):** Before every production deploy, complete [`CRITICAL-USER-FLOWS.md`](./CRITICAL-USER-FLOWS.md) on the staging or production-candidate build. Record Tester, Date, Device, Browser, Version, Pass/Fail, and Notes for **every** flow. Any failure → bug entry in active release log **before** fixing.

**Overlays (mandatory):** Every new modal, bottom sheet, popup, action menu, or full-screen overlay must pass [`OVERLAY-MODAL-QA.md`](./OVERLAY-MODAL-QA.md) on **iPhone Safari**, **iPhone Chrome**, **Android Chrome**, and **Desktop** before staging or production deploy.

**Legend:** ✅ Pass · ❌ Fail · ⬜ Not tested · N/A Not in scope

---

## Platform matrix

| Platform | Browser / build | Tester | Date | Overall |
|----------|-----------------|--------|------|---------|
| iPhone | Safari (required) | | | ⬜ |
| iPhone | Chrome (required) | | | ⬜ |
| iPhone | Native app (Expo / TestFlight) | | | ⬜ |
| Android | Chrome (required) | | | ⬜ |
| Android | Native app | | | ⬜ |
| Desktop Web | Chrome or Safari (required) | | | ⬜ |

---

## Critical user flows

### Authentication

| # | Flow | iPhone Safari | iPhone app | Android | Web | Notes |
|---|------|---------------|------------|---------|-----|-------|
| 1 | Sign up (new account) | ⬜ | ⬜ | ⬜ | ⬜ | |
| 2 | Login (existing account) | ⬜ | ⬜ | ⬜ | ⬜ | |
| 3 | Logout | ⬜ | ⬜ | ⬜ | ⬜ | |
| 4 | Session persists after app restart | ⬜ | ⬜ | ⬜ | ⬜ | |
| 5 | **Post-login screen not black** | ⬜ | ⬜ | ⬜ | ⬜ | **Required** |

### Core tabs

| # | Flow | iPhone Safari | iPhone app | Android | Web | Notes |
|---|------|---------------|------------|---------|-----|-------|
| 6 | Feed — loads posts | ⬜ | ⬜ | ⬜ | ⬜ | |
| 7 | Feed — scroll | ⬜ | ⬜ | ⬜ | ⬜ | |
| 8 | Feed — pull to refresh | ⬜ | ⬜ | ⬜ | ⬜ | |
| 9 | Discover | ⬜ | ⬜ | ⬜ | ⬜ | |
| 10 | Events | ⬜ | ⬜ | ⬜ | ⬜ | |
| 11 | Messages — list | ⬜ | ⬜ | ⬜ | ⬜ | |
| 12 | Messages — send/receive | ⬜ | ⬜ | ⬜ | ⬜ | |
| 13 | Notifications | ⬜ | ⬜ | ⬜ | ⬜ | |
| 14 | Profile — view & edit | ⬜ | ⬜ | ⬜ | ⬜ | |

### Release-specific (check if in scope)

| # | Flow | iPhone Safari | iPhone app | Android | Web | Notes |
|---|------|---------------|------------|---------|-----|-------|
| 15 | Matchmaking — deck | ⬜ | ⬜ | ⬜ | ⬜ | |
| 16 | Matchmaking — connect/skip | ⬜ | ⬜ | ⬜ | ⬜ | |
| 17 | Matchmaking — safety (report/block) | ⬜ | ⬜ | ⬜ | ⬜ | |
| 18 | Media upload (post/story) | ⬜ | ⬜ | ⬜ | ⬜ | |
| 19 | Beta feedback submit | ⬜ | ⬜ | ⬜ | ⬜ | |

### Staff-only (founder / staff accounts)

| # | Flow | iPhone Safari | Web | Notes |
|---|------|---------------|-----|-------|
| 20 | Founder Dashboard overview | ⬜ | ⬜ | |
| 21 | Beta Feedback Dashboard | ⬜ | ⬜ | |
| 22 | Matchmaking analytics | ⬜ | ⬜ | |

---

## Regression checks (every release)

| # | Check | Pass | Notes |
|---|-------|------|-------|
| 23 | No white flash on tab switch (web) | ⬜ | |
| 24 | Tab bar visible and tappable | ⬜ | |
| 25 | Safe area respected (iPhone notch/home indicator) | ⬜ | |
| 26 | No stuck loading spinners | ⬜ | |
| 27 | Back navigation works | ⬜ | |

---

## Overlays, modals & bottom sheets

**Required for any release touching overlay UI.** Full checklist: [`OVERLAY-MODAL-QA.md`](./OVERLAY-MODAL-QA.md)

| # | Check | iPhone Safari | iPhone Chrome | Android Chrome | Desktop | Notes |
|---|-------|---------------|---------------|----------------|---------|-------|
| 28 | New/changed overlay passes four-browser matrix | ⬜ | ⬜ | ⬜ | ⬜ | |
| 29 | iPhone Safari portrait + landscape | ⬜ | — | — | — | |
| 30 | Smallest supported iPhone screen | ⬜ | — | — | — | |
| 31 | Safari toolbar expanded + collapsed | ⬜ | — | — | — | |
| 32 | On-screen keyboard open — overlay visible | ⬜ | — | — | — | |
| 33 | Dynamic Type (large text) — buttons accessible | ⬜ | — | — | — | |
| 34 | No Home Indicator overlap | ⬜ | — | — | — | |

---

## Critical user flows (summary)

Full checklist: [`CRITICAL-USER-FLOWS.md`](./CRITICAL-USER-FLOWS.md) — **43 flows** across Authentication, Feed, Posts, Stories, Interactions, Messaging, Profile, Social, Calendar, Notifications, and General UI.

| # | Gate | Pass | Notes |
|---|------|------|-------|
| 35 | Per-release verification file created | ⬜ | `critical-flows/vX.Y.Z-CUF-VERIFICATION.md` |
| 36 | All critical flows ✅ (staging/candidate) | ⬜ | Blocks production deploy |
| 37 | Failures logged as bugs before fix | ⬜ | RELEASE.md + BUG-LIST |

---

## Open issues

| ID | Severity | Description | Block release? |
|----|----------|-------------|----------------|
| | P0/P1/P2 | | |

**P0/P1 open issues block staging deployment.**

---

## Sign-off

| Role | Name | Date | Approved |
|------|------|------|----------|
| Founder / QA | | | ⬜ |

**Approval phrase:** `Human QA passed — approved for staging`
