# Overlay, Modal & Bottom Sheet QA

**Applies to:** Every new **screen overlay**, **modal**, **bottom sheet**, **popup**, **action menu**, or **context menu**.  
**Blocks:** Staging and production deploy for any release that adds or changes overlay UI.  
**Owner:** Founder / QA  
**Safe area rule (permanent):** [`OVERLAY-SAFE-AREA.md`](../OVERLAY-SAFE-AREA.md) — 28px safety margin above iOS safe area; use `BottomOverlayShell` or `useSheetSafeArea`.

**Legend:** ✅ Pass · ❌ Fail · ⬜ Not tested

---

## Required platforms (all four)

Every overlay must be tested on **all** of the following before deploy:

| Platform | Browser | Required |
|----------|---------|----------|
| iPhone | **Safari** | ✅ |
| iPhone | **Chrome** | ✅ |
| Android | **Chrome** | ✅ |
| Desktop | Chrome or Safari | ✅ |

> Native app (Expo / TestFlight) is recommended when in scope, but does **not** replace the four browsers above for web releases.

---

## Universal acceptance criteria

| # | Check | iPhone Safari | iPhone Chrome | Android Chrome | Desktop | Notes |
|---|-------|---------------|---------------|----------------|---------|-------|
| 1 | Opens smoothly (no flash, no layout jump) | ⬜ | ⬜ | ⬜ | ⬜ | |
| 2 | Closes smoothly (backdrop, ✕, swipe/back) | ⬜ | ⬜ | ⬜ | ⬜ | |
| 3 | Entire overlay visible — nothing clipped off-screen | ⬜ | ⬜ | ⬜ | ⬜ | |
| 4 | No overlap with iPhone Home Indicator / safe area | ⬜ | ⬜ | N/A | N/A | 28px margin + `env(safe-area-inset-bottom)` per [`OVERLAY-SAFE-AREA.md`](../OVERLAY-SAFE-AREA.md) |
| 5 | Background page does not scroll while overlay is open | ⬜ | ⬜ | ⬜ | ⬜ | |
| 6 | All primary actions fully tappable (min 44×44 pt) | ⬜ | ⬜ | ⬜ | ⬜ | |
| 7 | Tall content scrolls **inside** the overlay (not off-screen) | ⬜ | ⬜ | ⬜ | ⬜ | |
| 8 | Desktop: centered or anchored correctly; no overflow | N/A | N/A | N/A | ⬜ | |

---

## iPhone Safari — extended checks (mandatory)

Run these **in addition** to the universal criteria on **iPhone Safari**:

| # | Check | Portrait | Landscape | Notes |
|---|-------|----------|-------------|-------|
| S1 | Overlay fully visible | ⬜ | ⬜ | |
| S2 | **Smallest supported iPhone** (e.g. iPhone SE / mini) | ⬜ | ⬜ | Shortest viewport height |
| S3 | Safari bottom toolbar **expanded** | ⬜ | ⬜ | Scroll page to show toolbar |
| S4 | Safari bottom toolbar **collapsed** (minimal UI) | ⬜ | ⬜ | Tap URL bar / scroll up |
| S5 | **On-screen keyboard open** — overlay still fully visible | ⬜ | ⬜ | Focus a text field behind or inside sheet if applicable |
| S6 | **Dynamic Type** (larger accessibility text) — buttons remain readable and tappable | ⬜ | ⬜ | Settings → Display → Text Size (largest comfortable) |
| S7 | Home Indicator clearance — last button row above indicator | ⬜ | ⬜ | No overlap with home bar |

---

## Sign-off

| Overlay / feature | Version | Tester | Date | All four browsers | Safari extended |
|-------------------|---------|--------|------|-------------------|-----------------|
| | | | | ⬜ | ⬜ |

**Approval phrase:** `Overlay QA passed — approved for deploy`

---

## Related

- [`HUMAN-QA.md`](./HUMAN-QA.md) — full release QA
- [`PRODUCTION-DEPLOYMENT.md`](./PRODUCTION-DEPLOYMENT.md) — deploy gates
- `npm run verify:sheet-safe-area` — automated static checks (does not replace manual Safari QA)
