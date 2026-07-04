# Production Bug Postmortem Process

**Status:** Permanent — required for every **production bug discovered by a user**  
**Owner:** Engineering + Founder  
**Goal:** Fix bugs **and** improve the development process after every production issue.

---

## When a postmortem is required

Create a postmortem when **all** of the following are true:

1. The bug affected **production** (https://frennix.vercel.app or live native builds).
2. The bug was **discovered by a user** — including end users, beta testers, or the Founder observing real production behavior.
3. The issue is tracked as a **bug** (not a planned enhancement or roadmap item).

**Not required for:** internal-only issues found before production, cosmetic polish caught in dev, or enhancements.

**Required before closing the bug:** A bug cannot move to **Closed** in [`RELEASE.md`](./RELEASE.md) or the active `vX.Y.Z-BUG-LIST.md` until its postmortem is **Closed** and any process improvements are applied.

---

## Workflow

```
User reports production bug
        ↓
Classify Severity (P0–P3) + Priority + Version Found + Milestone  ← BEFORE fix
        ↓
Log bug in active RELEASE.md + BUG-LIST (before fixing)
        ↓
Create postmortem file (Status: Open)
        ↓
Fix implemented → postmortem: Fixed (code + release version)
        ↓
QA verified → postmortem: Verified (QA test documented)
        ↓
Process gaps addressed → postmortem: Closed
        ↓
Bug marked Closed in release log
```

### Postmortem status

| Status | Meaning |
|--------|---------|
| **Open** | Bug logged; investigation or fix in progress |
| **Fixed** | Fix shipped or merged; code changes documented |
| **Verified** | Fix confirmed in QA/production; regression test identified |
| **Closed** | Postmortem complete; process/checklist updates applied (if any) |

---

## Required fields (every postmortem)

| Field | Description |
|-------|-------------|
| **Bug ID** | e.g. `BUG-001` |
| **Severity** | P0 · P1 · P2 · P3 — per [`BUG-SEVERITY.md`](./BUG-SEVERITY.md) |
| **Priority** | Fix immediately · Next patch release · Next planned release · Backlog |
| **Version Found** | Production version when bug was observed |
| **Version Fixed** | Release containing the fix |
| **Assigned Milestone** | Target release (e.g. `v1.0.3`) |
| **Date reported** | When the user first reported the issue |
| **Who discovered it** | User, tester name, Founder, etc. |
| **Root cause** | Technical and/or process reason the bug shipped |
| **Why automated testing did not catch it** | Honest gap analysis — scripts, CI, gates |
| **What code was changed** | Files, migrations, commits |
| **What QA test was added** | Manual checklist row, verify script, CUF flow ID |
| **Status** | Open → Fixed → Verified → Closed |

---

## Process improvement (mandatory review)

Every postmortem must answer: **Did this reveal a weakness in our release process?**

If **yes**, update the appropriate artifact **before** closing the postmortem:

| Weakness type | Update |
|---------------|--------|
| Missing manual test | [`checklists/CRITICAL-USER-FLOWS.md`](./checklists/CRITICAL-USER-FLOWS.md) or [`checklists/OVERLAY-MODAL-QA.md`](./checklists/OVERLAY-MODAL-QA.md) or [`checklists/HUMAN-QA.md`](./checklists/HUMAN-QA.md) |
| Missing automated gate | New/updated `scripts/verify-*.ts` + `package.json` script |
| Schema/code drift | [`checklists/PRODUCTION-DEPLOYMENT.md`](./checklists/PRODUCTION-DEPLOYMENT.md), `verify:schema-sync` |
| Deploy ordering | [`RELEASE_PROCESS.md`](./RELEASE_PROCESS.md) core rules |
| Error handling / UX | Stabilization or release checklist row |

Record the update in the postmortem under **Process improvements applied**.

---

## File locations

| Artifact | Path |
|----------|------|
| Template | [`templates/POSTMORTEM-TEMPLATE.md`](./templates/POSTMORTEM-TEMPLATE.md) |
| Per-bug postmortem | `features/releases/postmortems/BUG-XXX-POSTMORTEM.md` |
| Index | [`postmortems/README.md`](./postmortems/README.md) |

**Create postmortem when bug is logged** — not after the fix ships.

---

## Sign-off

| Role | Name | Date | Postmortem Closed |
|------|------|------|-------------------|
| Engineering | | | ⬜ |
| Founder | | | ⬜ |

**Approval phrase:** `Postmortem BUG-XXX closed — process improvements applied`

---

## Related

- [`RELEASE.md`](./RELEASE.md) — active release bug log
- [`RELEASE_PROCESS.md`](./RELEASE_PROCESS.md) — seven-phase SOP
- [`checklists/POST-RELEASE-MONITORING.md`](./checklists/POST-RELEASE-MONITORING.md) — production issue triage
