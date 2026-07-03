# Release Readiness Report — vX.Y.Z

**Release:** vX.Y.Z — [Release Title]  
**Report date:** YYYY-MM-DD  
**Prepared by:** Engineering  
**Release file:** [`RELEASE-vX.Y.Z.md`](./RELEASE-vX.Y.Z.md)  
**Branch / commit tested:** `branch-name` @ `commit-sha` (or uncommitted — document)

> **Purpose:** This report is delivered to the Founder **after Phase 2 (Internal Testing)** and **before Phase 3 (Human QA)**.  
> Human QA must not begin until the Founder has reviewed this report and explicitly approved Phase 3.

---

## Executive summary

[2–4 sentences: what ships, what was tested, overall readiness.]

---

## Tests executed

| # | Test / script | Command | Scope |
|---|---------------|---------|-------|
| 1 | | | |
| 2 | | | |

[List every automated check run for this release. Mark N/A with reason for out-of-scope items.]

---

## Tests passed

| Test | Result | Notes |
|------|--------|-------|
| | ✅ | |

---

## Tests failed

| Test | Result | Blocking? | Notes / mitigation |
|------|--------|-----------|-------------------|
| | ❌ | Yes / No | |

[If none: *No automated test failures for in-scope checks.*]

---

## Code coverage

| Area | Coverage | Tool | Notes |
|------|----------|------|-------|
| Unit / integration | N/A or _%_ | | Frennix does not currently enforce a global coverage gate. Document if `jest --coverage` or similar was run. |
| Static verification | _N scripts_ | `scripts/verify-*.ts` | Primary pre-QA signal for this repo. |
| Manual / device | _N checks_ | Matchmaking QA MANUAL rows | Phase 3 scope unless noted. |

---

## Build status

| Build | Status | Artifact / notes |
|-------|--------|------------------|
| Web (`build:web`) | ✅ / ❌ | Bundle hash, size |
| TypeScript (`tsc --noEmit`) | ✅ / ❌ / ⚠️ | Error count; note if pre-existing baseline |
| Native (iOS / Android) | ✅ / ❌ / N/A | |
| Release gate validator | ✅ / ❌ | `verify-release-gates.ts --phase internal` |

---

## Migration status

| Check | Status | Notes |
|-------|--------|-------|
| New migrations in this release | None / List files | |
| `supabase migration list` local ↔ remote | ✅ / ❌ | |
| RLS / RPC review | ✅ / N/A | |
| Rollback SQL documented | ✅ / N/A | |

---

## Performance summary

| Metric | Value | Baseline | Acceptable? |
|--------|-------|----------|-------------|
| Web bundle size | | prior release | |
| Web build time | | | |
| Feed / messaging perf scripts | N/A or ms | | |

[If perf scripts were not run, state why (e.g. requires live user IDs).]

---

## Security concerns

| Concern | Severity | Status |
|---------|----------|--------|
| New RLS / RPC changes | | None / Reviewed |
| Secrets in diff | | Clean |
| Staff / founder route gating | | Verified / N/A |
| Dependency vulnerabilities | | Not scanned / Clean |

[If none: *No new security concerns identified for this release scope.*]

---

## Known issues

| Issue | Severity | In scope? | Ship blocker? |
|-------|----------|-----------|---------------|
| | P0 / P1 / P2 | | Yes / No |

[Carry forward from release file + newly discovered during Phase 2.]

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| | Low / Med / High | | |

---

## Recommendation

**Select exactly one:**

- [ ] **Ready for Human QA** — Automated gates satisfied or failures documented and accepted; proceed to Phase 3 with noted manual focus areas.
- [ ] **Not Ready for Human QA** — Blocking failures remain; do not start Phase 3 until resolved.

**Rationale:**

[Why this recommendation. List mandatory manual QA focus if Ready (e.g. iPhone Safari post-login).]

---

## Founder review (Phase 3 gate)

| Field | Value |
|-------|-------|
| Report reviewed by | |
| Review date | |
| Decision | ⬜ Approved — begin Human QA · ⬜ Rejected — return to Phase 2 |
| Notes | |

---

## Sign-off

| Role | Name | Date |
|------|------|------|
| Engineering (report author) | | |
| Founder (Human QA approval) | | |

**After Founder approval:** Mark `**Release readiness report delivered** | ✅` in [`RELEASE-vX.Y.Z.md`](./RELEASE-vX.Y.Z.md) and begin [`checklists/HUMAN-QA.md`](./checklists/HUMAN-QA.md).
