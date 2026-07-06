# UX Polish Sprint — App Store Readiness

**Status:** Active  
**Started:** July 6, 2026  
**Goal:** Make every screen feel smooth, premium, and intuitive before feature sprints  
**Gate:** Founder sign-off required before Feed 2.0  
**Product roadmap:** [`ROADMAP.md`](../ROADMAP.md) · **QA:** [`FOUNDER-QA.md`](FOUNDER-QA.md)

> Review every screen as if preparing for App Store submission. No major new features unless required for usability or stability.

---

## Sprint scope

1. App responsiveness and perceived performance  
2. Spacing, alignment, typography, icons, animations, transitions  
3. Eliminate unnecessary loading delays and layout shifts  
4. Loading, empty, success, and error states  
5. Consistent pull-to-refresh  
6. Feed polish (modern social platform bar)  
7. Discover, Calendar, Events, Messaging, Notifications, Profile, Posting consistency  
8. Buttons, menus, dialogs, navigation consistency  
9. Remove anything unfinished or unpolished  

---

## Screen audit checklist

| Screen | Spacing | Loading | Empty | Error | PTR | Animations | Status |
|--------|---------|---------|-------|-------|-----|------------|--------|
| Feed | | | | | | | 🔄 |
| Discover | | | | | | | ⬜ |
| Calendar | | | | | | | ⬜ |
| Events | | | | | | | ⬜ |
| Messages | | | | | | | ⬜ |
| Notifications | | | | | | | 🔄 |
| Profile | | | | | | | ⬜ |
| Post detail | | | | | | | ⬜ |
| Posting | | | | | | | ⬜ |
| Story viewer | | | | | | | ⬜ |
| Settings | | | | | | | ⬜ |
| Auth | | | | | | | ⬜ |

---

## Improvements made

*(Updated as work lands)*

### Performance & perceived speed

| Item | Change |
|------|--------|
| *(from Performance Sprint — shipped)* | Lazy tabs, calendar cache, story bundle query, discover FlatList tuning |

### UI / UX

| Item | Screen | Change |
|------|--------|--------|
| | | |

---

## Remaining recommendations

| ID | Area | Recommendation | Priority |
|----|------|----------------|----------|
| R-01 | Feed web | Virtualize web ScrollView | High |
| R-02 | Comments | Paginate + FlatList on post detail | High |
| R-03 | All tabs | Skeleton only on true cold load audit | Medium |
| R-04 | Feed | Double-tap heart animation | Medium |
| R-05 | Global | Success snackbar pattern beyond undo | Medium |

---

## Areas still needing refinement

*(Post-sprint Founder QA notes)*

---

## Deliverable (end of sprint)

- [ ] Performance improvements list  
- [ ] UI improvements list  
- [ ] Remaining recommendations  
- [ ] Before/after notes (screenshots where helpful)  
- [ ] Founder QA pass on iPhone Safari  

---

## Changelog

| Date | Change |
|------|--------|
| 2026-07-06 | Sprint kickoff; doc created after Performance Sprint merge |
