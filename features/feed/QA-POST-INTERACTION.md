# Post Interaction Sheet — QA Checklist

**Feature:** Feed post tap → bottom interaction sheet (Like, Strong Work, Reply, More)  
**Status:** Feature complete — automated verification passed; device QA checklist ready  
**Production URL:** https://frennix.vercel.app

## Automated verification (run before device QA)

```bash
cd apps/mobile
npx expo export -p web && node scripts/patch-web-html.js
node scripts/verify-post-interaction.mjs
```

## Master checklist

| ID | Test | iPhone Safari | Android Chrome | Desktop | Pass |
|----|------|:-------------:|:--------------:|:-------:|:----:|
| PI-01 | Tap post media opens interaction sheet (not lightbox first) | ⬜ | ⬜ | ⬜ | |
| PI-02 | Feed does **not** scroll while sheet is open | ⬜ | ⬜ | ⬜ | |
| PI-03 | Sheet slides up smoothly on open | ⬜ | ⬜ | ⬜ | |
| PI-04 | Sheet dismisses smoothly (✕, backdrop tap, swipe down) | ⬜ | ⬜ | ⬜ | |
| PI-05 | Post image/video + caption remain visible above sheet | ⬜ | ⬜ | ⬜ | |
| PI-06 | Primary actions: Like, Strong Work (or last reaction), Reply, More | ⬜ | ⬜ | ⬜ | |
| PI-07 | More menu scrolls when >6 secondary actions | ⬜ | ⬜ | ⬜ | |
| PI-08 | Reaction highlight animates before dismiss | ⬜ | ⬜ | N/A | |
| PI-09 | Last-used reaction appears in primary slot on reopen | ⬜ | ⬜ | ⬜ | |
| PI-10 | Light haptic on reactions (native only) | ⬜ | ⬜ | N/A | |
| PI-11 | Medium haptic on Invite to Train / Challenge Accepted (native only) | ⬜ | ⬜ | N/A | |
| PI-12 | VoiceOver / TalkBack reads action labels and hints | ⬜ | ⬜ | ⬜ | |
| PI-13 | Dynamic Type / large text does not clip action labels | ⬜ | ⬜ | ⬜ | |
| PI-14 | No emergency debug banner visible | ⬜ | ⬜ | ⬜ | |
| PI-15 | Feed scroll works normally after sheet closes | ⬜ | ⬜ | ⬜ | |

## Sign-off log

| Date | Tester | Build / deploy | Automated | Device QA | Notes |
|------|--------|----------------|-----------|-----------|-------|
| | | | | | |

## Feature complete criteria

- [x] Automated script PASS against latest production bundle (desktop + iPhone UA + Android UA)
- [ ] All PI-01–PI-09 pass on iPhone Safari (production device)
- [ ] PI-02, PI-03, PI-04 pass on Android Chrome and desktop (device spot-check)
- [ ] Accessibility spot-check PI-12–PI-13 on at least one mobile browser
