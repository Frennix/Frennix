# Postmortem — BUG-XXX

**Template:** Copy to `features/releases/postmortems/BUG-XXX-POSTMORTEM.md` when a production user-reported bug is logged.  
**Process:** [`POSTMORTEM-PROCESS.md`](../POSTMORTEM-PROCESS.md)

---

## Summary

| Field | Value |
|-------|-------|
| **Bug ID** | BUG-XXX |
| **Severity** | P0 \| P1 \| P2 \| P3 |
| **Priority** | Fix immediately \| Next patch release \| Next planned release \| Backlog |
| **Version Found** | vX.Y.Z |
| **Version Fixed** | — |
| **Assigned Milestone** | vX.Y.Z |
| **Date reported** | YYYY-MM-DD |
| **Who discovered it** | User / Tester / Founder |
| **Status** | Open \| Fixed \| Verified \| Closed |

### User impact (one sentence)


---

## Root cause



---

## Why automated testing did not catch it



---

## What code was changed

| Area | Files / migrations | Commit / PR |
|------|-------------------|-------------|
| | | |

---

## What QA test was added to prevent recurrence

| Type | Test added | Location |
|------|------------|----------|
| Manual | e.g. CUF flow INT-05 | `CRITICAL-USER-FLOWS.md` |
| Automated | e.g. `verify:post-sharing` | `scripts/verify-*.ts` |

---

## Release version containing the fix

| Field | Value |
|-------|-------|
| **Version Fixed** | vX.Y.Z |
| **Assigned Milestone** | vX.Y.Z |
| **Deploy ID** | |
| **Production verified** | ⬜ Date |

---

## Process improvement

**Did this reveal a release process weakness?** ⬜ Yes · ⬜ No

If yes, document updates **before** closing postmortem:

| Checklist / doc updated | Change made | Date |
|-------------------------|-------------|------|
| | | |

---

## Timeline

| Date | Event |
|------|-------|
| | Bug reported |
| | Bug logged in RELEASE.md |
| | Postmortem opened |
| | Fix merged |
| | Fix deployed to production |
| | QA verified |
| | Process improvements applied |
| | Postmortem closed |

---

## Sign-off

| Role | Name | Date | Approved |
|------|------|------|----------|
| Engineering | | | ⬜ |
| Founder | | | ⬜ |

**Bug may be marked Closed in RELEASE.md only after this postmortem is Closed.**
