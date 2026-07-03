# Human QA Checklist

**Phase:** 3 of 7  
**Owner:** Founder / QA  
**Blocks:** Staging deployment (Phase 4)

**Prerequisite (Phase 2.5):** Review [`RELEASE-vX.Y.Z-READINESS.md`](../RELEASE-vX.Y.Z-READINESS.md). Human QA begins only when the report recommends **Ready for Human QA** and the Founder replies e.g. *"Approved — begin Human QA vX.Y.Z"*.

Test on **all three platforms** unless release scope explicitly excludes one (document exception in release file).

**Legend:** ✅ Pass · ❌ Fail · ⬜ Not tested · N/A Not in scope

---

## Platform matrix

| Platform | Browser / build | Tester | Date | Overall |
|----------|-----------------|--------|------|---------|
| iPhone | Safari (required) | | | ⬜ |
| iPhone | Native app (Expo / TestFlight) | | | ⬜ |
| Android | Chrome | | | ⬜ |
| Android | Native app | | | ⬜ |
| Desktop Web | Chrome or Safari | | | ⬜ |

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
