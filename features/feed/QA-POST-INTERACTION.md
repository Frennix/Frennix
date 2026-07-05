# Post Interaction Sheet — QA Checklist

**Feature:** Feed post **⋯** (header) → `PostInteractionSheet` → `BottomActionSheet` (Like, Strong Work, Reply, More)  
**Phase:** A (live) — **＋** removed from reaction bar; caption/media tap still opens sheet (secondary — remove in polish)  
**Status:** Automated verification PASS on production; device QA checklist ready  
**Production URL:** https://frennix.vercel.app  
**Pattern doc:** [`features/releases/FEED-POST-INTERACTION-PATTERN.md`](../releases/FEED-POST-INTERACTION-PATTERN.md)

## Automated verification (run before device QA)

```bash
cd apps/mobile
pnpm build:web
node scripts/verify-post-interaction.mjs --url https://frennix.vercel.app
node scripts/verify-safari-feed-fix.mjs --url https://frennix.vercel.app
npm run verify:sheet-safe-area
```

## Master checklist

| ID | Test | iPhone Safari | Android Chrome | Desktop | Pass |
|----|------|:-------------:|:--------------:|:-------:|:----:|
| PI-01 | Tap **⋯** (`Open post actions`) opens interaction sheet | ✅ auto | ✅ auto | ✅ auto | |
| PI-01b | Caption/media tap opens sheet (secondary — polish to remove) | ✅ auto | ✅ auto | ✅ auto | |
| PI-02 | Feed does **not** scroll while sheet is open (soft lock) | ✅ auto | ✅ auto | ✅ auto | |
| PI-03 | Sheet slides up smoothly on open (spring animation) | ⬜ | ⬜ | ⬜ | |
| PI-04 | Sheet dismisses smoothly (backdrop tap, swipe down) | ✅ auto | ✅ auto | ✅ auto | |
| PI-05 | Post content remains visible above sheet | ✅ auto | ✅ auto | ✅ auto | |
| PI-06 | Primary actions: Like, Strong Work (or last reaction), Reply, More | ✅ auto | ✅ auto | ✅ auto | |
| PI-07 | More menu scrolls when >6 secondary actions | ⬜ | ⬜ | ⬜ | |
| PI-08 | Reaction highlight animates before dismiss | ⬜ | ⬜ | N/A | |
| PI-09 | Last-used reaction appears in primary slot on reopen | ⬜ | ⬜ | ⬜ | |
| PI-10 | Light haptic on reactions (native only) | ⬜ | ⬜ | N/A | |
| PI-11 | Medium haptic on Invite to Train / Challenge Accepted (native only) | ⬜ | ⬜ | N/A | |
| PI-12 | VoiceOver / TalkBack reads action labels and hints | ⬜ | ⬜ | ⬜ | |
| PI-13 | Dynamic Type / large text does not clip action labels | ⬜ | ⬜ | ⬜ | |
| PI-14 | No emergency debug banner visible (unless `?feedDebug=1`) | ✅ auto | ✅ auto | ✅ auto | |
| PI-15 | Feed scroll + tap work normally after sheet closes | ✅ auto | ✅ auto | ✅ auto | |
| PI-16 | **＋** not shown on reaction bar (Phase A) | ⬜ | ⬜ | ⬜ | |

## Sign-off log

| Date | Tester | Build / deploy | Automated | Device QA | Notes |
|------|--------|----------------|-----------|-----------|-------|
| 2026-06-25 | Cursor agent | `dpl_621wH7iaXxJY4fa46Qr9AeQT615R` / commit `a0f9671` | PASS | Pending | Pre–Phase A |
| 2026-07-05 | Cursor agent | `dpl_3aKaPXDnxoccvELGGRwbfDxaptgZ` / bundle `index-b58c16d…` | PASS (iPhone Safari UA) | Pending Founder device | Phase A + BUG-004 fix |

## Feature complete criteria

- [x] Automated script PASS against production (desktop + iPhone UA + Android UA)
- [x] Post-dismiss feed scroll + tap restored (BUG-004 automated PASS)
- [ ] All PI-01–PI-09 pass on **physical iPhone Safari** (production device)
- [ ] PI-03, PI-16 pass on physical iPhone Safari
- [ ] Accessibility spot-check PI-12–PI-13 on at least one mobile browser
- [ ] Founder sign-off closes BUG-002 and BUG-004
