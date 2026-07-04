# Production Bug Postmortems

**Process:** [`POSTMORTEM-PROCESS.md`](../POSTMORTEM-PROCESS.md)  
**Template:** [`templates/POSTMORTEM-TEMPLATE.md`](../templates/POSTMORTEM-TEMPLATE.md)

Every production bug discovered by a user requires a postmortem **before** the bug is closed.

**Severity classification:** [`BUG-SEVERITY.md`](../BUG-SEVERITY.md) — every postmortem includes P0–P3 severity and required metadata.

| Bug ID | Sev | Priority | Version Found | Version Fixed | Milestone | Discovered by | Status | Postmortem |
|--------|-----|----------|---------------|---------------|-----------|---------------|--------|------------|
| BUG-001 | **P0** | Immediate | v1.0.1 | v1.0.2 | v1.0.2 | User (production) | Closed | [BUG-001-POSTMORTEM.md](./BUG-001-POSTMORTEM.md) |
| BUG-002 | **P1** | Next patch | v1.0.2 | — | v1.0.3 | Founder | Open | _Create when closing BUG-002_ |

---

## Status legend

| Status | Meaning |
|--------|---------|
| Open | Investigating or fixing |
| Fixed | Code shipped |
| Verified | QA/production confirmed |
| Closed | Postmortem complete; process updates applied |
