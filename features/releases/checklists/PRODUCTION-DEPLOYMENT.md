# Production Deployment Checklist

**Phase:** 5 of 7  
**Owner:** Engineering  
**Approver:** Founder (separate approval for each step)

> **Never combine commit, tag, push, or deploy into a single step.**

---

## Pre-deploy gates

| # | Check | Pass | Notes |
|---|-------|------|-------|
| 1 | Staging checklist complete + Founder staging approval | ⬜ | Phase 4 |
| 1b | **Critical User Flows** verified on staging/candidate build | ⬜ | [`CRITICAL-USER-FLOWS.md`](./CRITICAL-USER-FLOWS.md) — all flows ✅ |
| 2 | `verify-release-gates.ts --phase production` exit 0 | ⬜ | |
| 2b | `npm run verify:critical-user-flows` exit 0 | ⬜ | Checklist wired in release docs |
| 3 | Rollback plan documented in release file | ⬜ | |
| 4 | Release notes drafted for GitHub Release | ⬜ | |

---

## Step 1 — Commit (requires Founder approval)

| # | Check | Pass | Notes |
|---|-------|------|-------|
| 5 | Founder approval: `Approved — commit vX.Y.Z` | ⬜ | Record date + phrase |
| 6 | Code + `dist/` + release docs committed | ⬜ | |
| 7 | Commit SHA recorded | ⬜ | |

---

## Step 2 — Tag (requires Founder approval)

| # | Check | Pass | Notes |
|---|-------|------|-------|
| 8 | Founder approval: `Approved — tag vX.Y.Z` | ⬜ | |
| 9 | Annotated tag `vX.Y.Z` on approved commit | ⬜ | |
| 10 | Tag message includes milestone summary | ⬜ | |

---

## Step 3 — Push (requires Founder approval)

| # | Check | Pass | Notes |
|---|-------|------|-------|
| 11 | Founder approval: `Approved — push vX.Y.Z` | ⬜ | |
| 12 | Commit on GitHub `main` | ⬜ | |
| 13 | Tag on GitHub | ⬜ | |
| 14 | GitHub Release created with notes | ⬜ | |
| 15 | CI / Vercel checks green on commit | ⬜ | |

---

## Step 4 — Deploy (requires Founder approval)

| # | Check | Pass | Notes |
|---|-------|------|-------|
| 16 | Founder approval: `Approved — deploy vX.Y.Z` | ⬜ | |
| 16a | **Critical User Flows** sign-off linked in release file | ⬜ | `critical-flows/vX.Y.Z-CUF-VERIFICATION.md` — **blocks deploy if any ❌** |
| 16b | Overlay/modal QA complete if release touches sheets/menus | ⬜ | [`OVERLAY-MODAL-QA.md`](./OVERLAY-MODAL-QA.md) |
| 16c | `npm run verify:schema-sync` exit 0 | ⬜ | Catches legacy triggers / schema drift |
| 17 | Migrations applied to production **before** client deploy | ⬜ | `npx supabase db push` |
| 18 | `supabase migration list` — all synced | ⬜ | |
| 19 | Web build fresh (`expo export -p web`) | ⬜ | |
| 20 | Production deploy (`vercel --prod`) | ⬜ | |
| 21 | Deployment ID recorded | ⬜ | |

---

## Immediate post-deploy verification (within 15 minutes)

| # | Check | Pass | Notes |
|---|-------|------|-------|
| 22 | https://frennix.vercel.app HTTP 200 | ⬜ | |
| 23 | Correct bundle hash serving (not prior version) | ⬜ | |
| 24 | GitHub commit SHA matches production | ⬜ | |
| 25 | Supabase REST/RPC smoke test | ⬜ | |
| 26 | Login → feed on iPhone Safari | ⬜ | **No black screen** |
| 27 | Login → feed on Desktop Web | ⬜ | |
| 28 | No spike in Sentry errors | ⬜ | |
| 29 | **Critical User Flows** re-verified on production (spot-check minimum: AUTH-02, FEED-01, POST-01, INT-05) | ⬜ | Full checklist within 24h |

---

## Production deployment record

| Field | Value |
|-------|-------|
| Version | vX.Y.Z |
| Commit SHA | |
| Git tag | |
| Deployment ID | |
| Production URL | https://frennix.vercel.app |
| Bundle hash | |
| Deploy date | |
| Deployed by | |
| Critical flows verification | [`critical-flows/vX.Y.Z-CUF-VERIFICATION.md`](../critical-flows/vX.Y.Z-CUF-VERIFICATION.md) |

---

## Rollback plan (fill before deploy)

| Trigger | Action |
|---------|--------|
| P0 regression | `npx vercel promote <prior-deployment-url> --yes` |
| Feature flag available | Disable flag in Supabase |
| Full revert | Redeploy prior tag's `dist/` |

Prior known-good deployment: _______________

---

## Approval record

| Step | Founder approval phrase | Date | Approved |
|------|-------------------------|------|----------|
| Commit | `Approved — commit vX.Y.Z` | | ⬜ |
| Tag | `Approved — tag vX.Y.Z` | | ⬜ |
| Push | `Approved — push vX.Y.Z` | | ⬜ |
| Deploy | `Approved — deploy vX.Y.Z` | | ⬜ |
