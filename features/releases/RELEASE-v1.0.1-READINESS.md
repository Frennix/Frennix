# Release Readiness Report — v1.0.1

**Release:** v1.0.1 — Safari Tab Layout Hotfix  
**Report date:** 2026-06-28  
**Prepared by:** Engineering  
**Release file:** [`RELEASE-v1.0.1.md`](./RELEASE-v1.0.1.md)  
**Branch / commit tested:** `hotfix/v1.0.1-safari-tab-layout` @ `8fce2f4` + uncommitted `lib/web-tab-scene-layout.ts`

---

## Executive summary

v1.0.1 is a single-file hotfix restoring fixed `WEB_TAB_CHROME_PX = 140` in `lib/web-tab-scene-layout.ts` — identical to stable v0.8.0 — to fix the iPhone Safari post-login black screen introduced in v1.0.0. Automated domain checks (matchmaking, messaging, auth, migrations, founder/beta) pass. Web build succeeds and the fix is confirmed in the bundle (`h=140`). iPhone Safari feed visibility was **not** fully confirmed in headless automation; real-device Human QA is required before staging.

---

## Tests executed

| # | Test / script | Command | Scope |
|---|---------------|---------|-------|
| 1 | Web build | `npm run build:web` | Full web export + Safari HTML patch |
| 2 | Post-login shell | `npx tsx scripts/verify-post-login.ts` | Auth routing, providers, Safari crash guards |
| 3 | Safari feed layout | `node scripts/verify-safari-feed-fix.mjs` | Post-login layout (mocked auth) |
| 4 | Auth resume | `npx tsx scripts/verify-auth-resume.ts` | Session bootstrap, TOKEN_REFRESHED |
| 5 | Matchmaking QA | `npx tsx scripts/verify-matchmaking-qa.ts` | Migrations, RPCs, copy, remote sync |
| 6 | Match candidates RPC | `npx tsx scripts/verify-match-candidates-rpc.ts` | RPC shape / composite rows |
| 7 | Matching scoring | `npx tsx scripts/verify-matching-scoring.ts` | Phase A scoring + explainability |
| 8 | Phase 15 / beta feedback | `npx tsx scripts/verify-phase15.ts` | Analytics + beta feedback foundation |
| 9 | Messaging realtime (static) | `node scripts/verify-messaging-realtime.mjs` | Subscribe/unsubscribe safety |
| 10 | Supabase init (live) | `npm run verify:supabase` | Init, getMessages, duplicate sub guard |
| 11 | TypeScript | `npm run typecheck` | Full workspace |
| 12 | Release gate (internal) | `npx tsx scripts/verify-release-gates.ts --phase internal` | Checklist gates |
| 13 | Migrations remote sync | `supabase migration list` | All 63 migrations |
| 14 | Founder / beta static | Manual file + migration token check | Dashboard routes + RPCs |
| 15 | Safari hotfix bundle | Custom static analysis | `h=140` in web bundle |

---

## Tests passed

| Test | Result | Notes |
|------|--------|-------|
| Web build | ✅ | Bundle `index-bf55704b6f570c31ab85d706ca299e73.js` (5.65 MB) |
| Safari hotfix source | ✅ | Matches v0.8.0; removes v1.0.0 dynamic chrome |
| Safari hotfix bundle | ✅ | `useWebTabSceneHeight` → `Math.max(Math.round(t-140), 240)` |
| Auth resume | ✅ | 6/6 |
| Matchmaking QA | ✅ | 38 PASS, 0 FAIL |
| Match candidates RPC | ✅ | 3/3 |
| Matching scoring | ✅ | 12/12 |
| Phase 15 / beta feedback | ✅ | 17/17 |
| Messaging realtime (static) | ✅ | All static checks |
| Supabase init (live) | ✅ | 6/6 including getMessages |
| Migrations remote sync | ✅ | Local = remote through `20250707000001` |
| Founder / beta static | ✅ | 11/11 files + migration tokens |
| Post-login shell | ✅ | 11/15 (see failures — stale script expectations) |
| Release gate (internal) | ⚠️ | Blocked until release file signed — expected |

---

## Tests failed

| Test | Result | Blocking? | Notes / mitigation |
|------|--------|-----------|-------------------|
| TypeScript (`tsc --noEmit`) | ❌ 173 errors | **No** (hotfix) | Pre-existing workspace baseline; none in `lib/web-tab-scene-layout.ts`; web build succeeds |
| Post-login (4 checks) | ❌ | **No** | Stale script: expects removed bisection debug files; false positive on emergency-banner removal comment |
| Safari feed fix (Playwright) | ❌ | **Partial** | `#root` full height (844px), no layout issue; `feed-root-container` null in mocked run — inconclusive |
| ESLint (hotfix file) | ❌ | **No** | ESLint v9 config not present in repo |
| Release gate internal sign-off | ❌ | **No** | Awaiting Phase 2 completion markers in release file |

---

## Code coverage

| Area | Coverage | Tool | Notes |
|------|----------|------|-------|
| Unit / integration | **N/A** | — | No enforced coverage gate in Frennix CI |
| Static verification | **15 scripts/checks** | `scripts/verify-*.ts`, `.mjs` | Primary automated signal |
| Manual / device | **25 checks** | Matchmaking QA MANUAL rows | Deferred to Phase 3 Human QA |

---

## Build status

| Build | Status | Artifact / notes |
|-------|--------|------------------|
| Web (`build:web`) | ✅ | `index-bf55704b6f570c31ab85d706ca299e73.js` — 5,652,698 bytes; Metro bundle ~1.1s |
| TypeScript | ⚠️ | 173 errors (pre-existing); hotfix file clean |
| Native iOS / Android | N/A | Hotfix is web layout only; native uses native tab chrome |
| Release gate validator | ⬜ | Pending internal sign-off in release file |

---

## Migration status

| Check | Status | Notes |
|-------|--------|-------|
| New migrations in v1.0.1 | ✅ None | Hotfix is client-only |
| `supabase migration list` | ✅ | All 63 migrations synced to remote |
| RLS / RPC review | N/A | No schema changes |
| Rollback SQL | N/A | No DB rollback needed; client rollback to v0.8.0 dist |

---

## Performance summary

| Metric | Value | Baseline | Acceptable? |
|--------|-------|----------|-------------|
| Web bundle size | 5.65 MB | v0.8.0 bundle not in local dist | ✅ Yes — hotfix does not materially change bundle |
| Web Metro bundle time | ~1.1s | — | ✅ |
| Feed perf (`measure-feed-perf.ts`) | N/A | — | Not run — requires live credentials |
| Messaging perf (`measure-messaging-perf.ts`) | N/A | — | Not run — requires userId + conversationId |

---

## Security concerns

| Concern | Severity | Status |
|---------|----------|--------|
| New RLS / RPC changes | — | **None** — no migrations |
| Secrets in diff | — | **Clean** — hotfix is layout constants only |
| Staff / founder route gating | Low | **Unchanged** — static checks pass |
| Dependency vulnerabilities | — | **Not scanned** this cycle |

**No new security concerns identified for v1.0.1 scope.**

---

## Known issues

| Issue | Severity | In scope? | Ship blocker? |
|-------|----------|-----------|---------------|
| 173 pre-existing TypeScript errors | P2 | No | No — predates hotfix |
| `verify-post-login.ts` stale expectations | P2 | No | No — tech debt; update post-v1.0.1 |
| iPhone Safari black screen (v1.0.0) | P0 | **Yes** | **Yes until Human QA confirms fix** |
| Playwright not in project deps | P3 | No | No — use Founder device for QA |

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Safari fix insufficient on real iPhone | Low | **High** | Mandatory iPhone Safari post-login in Phase 3 |
| Fixed 140px chrome wrong on unusual viewports | Low | Med | Same offset shipped in v0.8.0 for months |
| Hotfix uncommitted during testing | Med | Low | Commit as separate Founder-approved step |
| Automated feed probe inconclusive | Med | Med | Founder manual verification of feed + all tabs |

---

## Recommendation

- [x] **Ready for Human QA**
- [ ] **Not Ready for Human QA**

**Rationale:** All in-scope automated domain checks pass. The hotfix restores the proven v0.8.0 layout logic and is present in the web bundle. Remaining failures are pre-existing TypeScript debt or stale test scripts — not regressions from this change. **The v1.0.0 black screen cannot be closed without Founder iPhone Safari testing.**

**Mandatory Human QA focus:**

1. **P0** — iPhone Safari: login → tabs → feed visible (not black) → all 5 tabs
2. **P0** — Matchmaking deck + matches list
3. **P1** — Messaging send/receive, notifications list, founder `/founder/support`
4. **P2** — Android + desktop Chrome spot-check

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
| Engineering (report author) | Engineering | 2026-06-28 |
| Founder (Human QA approval) | | |
