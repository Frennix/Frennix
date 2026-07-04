# Bug Severity Classification

**Status:** Permanent — required for **every** production issue before work begins  
**Owner:** Engineering + Founder  
**Applies to:** Bug reports, [`RELEASE.md`](./RELEASE.md), bug lists, postmortems, Known Issues (engineering source), and Critical User Flow failures

> **Classify first, fix second.** No bug fix starts until Severity (P0–P3) and required metadata are recorded in the active release log.

---

## Severity levels (P0–P3)

| Severity | Name | Criteria | Response |
|----------|------|----------|----------|
| **P0** | Critical | App crash · login failure · data loss · security issue · production outage | **Fix immediately** — drop everything; hotfix same day |
| **P1** | High | Core feature broken (posting, messaging, matching, events, notifications) · significant user impact | **Next patch release** — target active milestone (e.g. v1.0.3) |
| **P2** | Medium | Feature works but has bugs, UI issues, or degraded performance | **Next planned release** — schedule in upcoming minor/patch |
| **P3** | Low | Cosmetic issues · minor UX improvements · nice-to-have enhancements | **Backlog** — triage when capacity allows |

### P0 examples
- Post-login black screen (cannot use app)
- Database error blocking all workout shares
- Auth token leak or RLS bypass
- Irreversible data deletion bug

### P1 examples
- Cannot send messages
- Match deck empty for all users
- Bottom action sheet clipped (core interaction broken on mobile)
- Notifications never delivered

### P2 examples
- RSVP confirmation UI lags but RSVP saves
- Calendar scroll jank
- Stale avatar after profile photo change until refresh

### P3 examples
- Typo in settings label
- Icon alignment off by 2px
- “Coming soon” copy tweak

---

## Required fields (every bug)

Record **all** of these when logging an issue — before engineering starts:

| Field | Description | Example |
|-------|-------------|---------|
| **Severity** | P0 · P1 · P2 · P3 | P1 |
| **Priority** | Fix policy (derived from severity; may be escalated by Founder) | Next patch release |
| **Version Found** | Production version when bug was observed | v1.0.2 |
| **Version Fixed** | Version containing the fix (`—` until shipped) | v1.0.3 |
| **Status** | Lifecycle state (see below) | In Progress |
| **Assigned Milestone** | Target release or backlog bucket | v1.0.3 |

### Priority values (standard)

| Priority | Maps to | Meaning |
|----------|---------|---------|
| **Fix immediately** | P0 | Hotfix / same-day production deploy |
| **Next patch release** | P1 | Active patch milestone |
| **Next planned release** | P2 | Scheduled minor or patch after current |
| **Backlog** | P3 | No release commitment |

Founder may **escalate** Priority without changing Severity (e.g. P2 → Next patch release for strategic reasons). Document escalation in Notes.

### Status values (standard)

| Status | Meaning |
|--------|---------|
| **Open** | Logged and classified; not yet in progress |
| **In Progress** | Actively being fixed |
| **Fixed** | Fix merged/deployed; awaiting QA |
| **Verified** | QA/production confirmed |
| **Closed** | Postmortem complete (production user bugs); archived |

---

## Where to record

| Artifact | Path | When |
|----------|------|------|
| Active release log | [`RELEASE.md`](./RELEASE.md) → Bug fixes table | Immediately on report |
| Version bug list | `vX.Y.Z-BUG-LIST.md` | Same time as RELEASE.md |
| Postmortem | `postmortems/BUG-XXX-POSTMORTEM.md` | Production user bugs — same day |
| Known Issues (engineering) | RELEASE.md Known Issues + [`whats-new.ts`](./whats-new.ts) | User-facing copy in whats-new; full metadata in RELEASE.md |
| CUF failure log | `critical-flows/vX.Y.Z-CUF-VERIFICATION.md` | On verification failure |

**Template:** [`templates/BUG-REPORT-TEMPLATE.md`](./templates/BUG-REPORT-TEMPLATE.md)

---

## Triage workflow

```
Issue reported
     ↓
Assign BUG-XXX (or ENH-XXX for non-bugs)
     ↓
Classify Severity (P0–P3) + Priority + Version Found + Milestone  ← BEFORE fix
     ↓
Log in RELEASE.md + BUG-LIST (+ postmortem if production user bug)
     ↓
Fix → Version Fixed → Verified → Closed
```

### Escalation rules

| Condition | Action |
|-----------|--------|
| P0 discovered | Notify Founder immediately; begin hotfix branch |
| P1 in active milestone | Blocks other P2/P3 work in same patch until resolved or explicitly deferred |
| Severity misclassified | Update row + postmortem; note in process improvement |

---

## Mapping from legacy labels

| Legacy (RELEASE.md) | Severity | Priority |
|---------------------|----------|----------|
| Critical | **P0** or **P1** | Use criteria above — data/outage → P0; core feature → P1 |
| High | **P1** | Next patch release |
| Medium | **P2** | Next planned release |
| Low | **P3** | Backlog |

---

## Related

- [`POSTMORTEM-PROCESS.md`](./POSTMORTEM-PROCESS.md)
- [`RELEASE_PROCESS.md`](./RELEASE_PROCESS.md)
- [`checklists/CRITICAL-USER-FLOWS.md`](./checklists/CRITICAL-USER-FLOWS.md)
