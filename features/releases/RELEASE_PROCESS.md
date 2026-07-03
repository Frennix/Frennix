# Frennix Release Management Process

**Status:** Official standard operating procedure (SOP)  
**Effective:** 2026-06-28 — adopted after v1.0.0 production regression  
**Owner:** Engineering + Founder  
**Applies to:** All semver releases (`v1.0.1`, `v1.1.0`, `v2.0.0`, …) and milestone ships (P1–P10)

> **This document is the single source of truth for how Frennix ships software.**  
> Every release follows the same seven phases. No phase may be skipped. No production change without explicit Founder approval.

**Product alignment:** All releases must support [`../PRODUCT_VISION.md`](../PRODUCT_VISION.md). Validate scope against the [Vision alignment checklist](../PRODUCT_VISION.md#vision-alignment-checklist) before Phase 1.

---

## Quick reference

| Phase | Checklist | Gate |
|-------|-----------|------|
| 1. Development branch | — | Feature PR merged to `main` only after local testing |
| 2. Internal testing | [`checklists/INTERNAL-TESTING.md`](./checklists/INTERNAL-TESTING.md) | All automated checks green |
| **2.5. Release Readiness Report** | [`templates/RELEASE-READINESS-REPORT-TEMPLATE.md`](./templates/RELEASE-READINESS-REPORT-TEMPLATE.md) | Founder reviews report **before** Human QA |
| 3. Human QA | [`checklists/HUMAN-QA.md`](./checklists/HUMAN-QA.md) | Founder QA sign-off (requires readiness report) |
| 4. Staging deployment | [`checklists/STAGING-DEPLOYMENT.md`](./checklists/STAGING-DEPLOYMENT.md) | Founder staging approval |
| 5. Production deployment | [`checklists/PRODUCTION-DEPLOYMENT.md`](./checklists/PRODUCTION-DEPLOYMENT.md) | Separate approvals: commit → tag → push → deploy |
| 6. Monitoring (24–48h) | [`checklists/POST-RELEASE-MONITORING.md`](./checklists/POST-RELEASE-MONITORING.md) | No P0/P1 regressions |
| 7. Release completion | [`checklists/RELEASE-COMPLETION.md`](./checklists/RELEASE-COMPLETION.md) | Release marked complete |

**Gate validator (required before staging/production deploy):**

```bash
cd apps/mobile
npx tsx scripts/verify-release-gates.ts --release features/releases/RELEASE-vX.Y.Z.md --phase staging
npx tsx scripts/verify-release-gates.ts --release features/releases/RELEASE-vX.Y.Z.md --phase production
```

**Release file per version:** Copy [`templates/RELEASE-vX.Y.Z-TEMPLATE.md`](./templates/RELEASE-vX.Y.Z-TEMPLATE.md) → `features/releases/RELEASE-vX.Y.Z.md`

**Readiness report per version:** Copy [`templates/RELEASE-READINESS-REPORT-TEMPLATE.md`](./templates/RELEASE-READINESS-REPORT-TEMPLATE.md) → `features/releases/RELEASE-vX.Y.Z-READINESS.md` (required before Human QA)

**History & approvals:** [`RELEASE-HISTORY.md`](./RELEASE-HISTORY.md)

---

## Core rules (non-negotiable)

1. **No direct development on `main`.** All work happens on feature branches; merge via PR after review and local testing.
2. **Staging before production.** Every release is verified on staging before production deploy.
3. **Separate Founder approvals.** Commit, tag, push, and deploy are **four distinct approval steps** — never combined.
4. **Migrations before client deploy.** Apply and verify Supabase migrations on staging, then production, before shipping the matching client build.
5. **Rollback plan required.** Every release documents how to revert (feature flag, Vercel promote, or prior tag).
6. **No deploy with incomplete checklists.** Run `verify-release-gates.ts` — exit code 1 blocks deploy.
7. **24–48h monitoring.** A release is not complete until post-deploy monitoring passes.
8. **Release Readiness Report before Human QA.** Engineering delivers `RELEASE-vX.Y.Z-READINESS.md` after Phase 2. Founder must review it and approve Phase 3 explicitly. Human QA does not start on "Not Ready" recommendations.

---

## Phase 1 — Development branch

### Branch policy

| Rule | Detail |
|------|--------|
| Branch from | `main` (always up to date before branching) |
| Naming | `feature/<area>-<short-description>` or `hotfix/vX.Y.Z-<description>` |
| Direct commits to `main` | **Forbidden** (except Founder-approved hotfix cherry-picks documented in release file) |
| PR required | Yes — self-review minimum; founder review for milestone releases |
| Merge criteria | Local testing passed; no known P0 bugs; migrations included if schema changes |

### Local testing (before merge)

- [ ] App builds without errors (`npx expo start` / `npx expo export -p web`)
- [ ] TypeScript compiles (`npx tsc --noEmit` on touched packages)
- [ ] Feature works on at least one platform (iOS simulator, Android emulator, or Web)
- [ ] No new console errors in dev for touched flows
- [ ] Database migrations run locally (`supabase db reset` or `supabase migration up`)
- [ ] No secrets committed (`.env`, keys, tokens)

### Deliverables

- Feature branch merged to `main`
- Release file created: `features/releases/RELEASE-vX.Y.Z.md` (draft status)

---

## Phase 2 — Internal testing

Use [`checklists/INTERNAL-TESTING.md`](./checklists/INTERNAL-TESTING.md).

Engineering runs all automated verification before requesting Human QA:

| Area | Command / action |
|------|------------------|
| Matchmaking / P1 | `npx tsx scripts/verify-matchmaking-qa.ts` |
| Post-login shell | `npx tsx scripts/verify-post-login.ts` (after `build:web`) |
| Migrations | `npx supabase migration list` — local ↔ remote match |
| Messaging | Messaging Realtime verification scripts |
| Release gates | `npx tsx scripts/verify-release-gates.ts --phase internal` |

**Exit criteria:** All applicable scripts PASS; zero FAIL; migrations reviewed; analytics events verified in dev/staging logs; permissions RPCs tested; no build errors.

Record results in the release file **Internal Testing** section.

---

## Phase 2.5 — Release Readiness Report

**Required for every release.** Delivered to the Founder **after Phase 2** and **before Phase 3 (Human QA)**.

### Template

Copy [`templates/RELEASE-READINESS-REPORT-TEMPLATE.md`](./templates/RELEASE-READINESS-REPORT-TEMPLATE.md) → `features/releases/RELEASE-vX.Y.Z-READINESS.md`

### Required sections

| Section | Content |
|---------|---------|
| Tests executed | Every script/command run |
| Tests passed | With counts and notes |
| Tests failed | With blocking vs non-blocking assessment |
| Code coverage | Available metrics or explicit N/A |
| Build status | Web, native, TypeScript |
| Migration status | New files, remote sync, RLS review |
| Performance summary | Bundle size, build time, perf scripts |
| Security concerns | RLS, secrets, route gating |
| Known issues | Carry-forward + newly found |
| Risks | Likelihood, impact, mitigation |
| Recommendation | **Ready for Human QA** or **Not Ready for Human QA** (exactly one) |

### Process

1. Engineering completes Phase 2 automated testing.
2. Engineering fills the readiness report with honest results (including failures and pre-existing debt).
3. Engineering marks **`Release readiness report delivered`** ✅ in the release file and links the report.
4. Founder reviews the report.
5. If recommendation is **Ready for Human QA**, Founder replies e.g. *"Approved — begin Human QA vX.Y.Z"*.
6. If **Not Ready**, return to Phase 2 — do not start manual QA.

> **No Human QA without a readiness report.** The Founder approval for Phase 3 is informed by this document.

---

## Phase 3 — Human QA

Use [`checklists/HUMAN-QA.md`](./checklists/HUMAN-QA.md).

**Prerequisite:** [`RELEASE-vX.Y.Z-READINESS.md`](./RELEASE-vX.Y.Z-READINESS.md) reviewed; recommendation must be **Ready for Human QA**; Founder must explicitly approve Phase 3.

Founder (or designated QA) completes manual testing on **all three platforms**:

| Platform | Environment |
|----------|-------------|
| iPhone | Safari + native app (Expo dev build or TestFlight when available) |
| Android | Chrome + native app |
| Desktop Web | Chrome or Safari |

**Critical flows (every release):**

- Login / Signup
- Feed
- Discover
- Matchmaking *(when in scope)*
- Messaging
- Events
- Notifications
- Profile
- Founder Dashboard *(staff only)*
- Beta Feedback Dashboard *(staff only)*

**Exit criteria:** QA checklist 100% pass; no P0/P1 open; Founder signs **Human QA Approved** in release file.

> **Lesson from v1.0.0:** iPhone Safari post-login must be explicitly tested. Automated route checks are not sufficient.

---

## Phase 4 — Staging deployment

Use [`checklists/STAGING-DEPLOYMENT.md`](./checklists/STAGING-DEPLOYMENT.md).

### Staging environment

| Field | Value |
|-------|-------|
| **URL** | https://staging.frennix.vercel.app |
| **Vercel project** | `frennix-staging` |
| **Database** | Supabase staging project (or production with staging flag — document per release) |

### Staging deploy steps

```bash
cd apps/mobile
npx expo export -p web && node scripts/patch-web-html.js
npx tsx scripts/verify-release-gates.ts --release features/releases/RELEASE-vX.Y.Z.md --phase staging
npx vercel --yes --project frennix-staging
npx supabase db push   # if migrations pending — staging first
```

### Staging verification

- [ ] Authentication (login, logout, session refresh)
- [ ] Database migrations applied (`supabase migration list`)
- [ ] Media uploads (posts, stories, feedback screenshots)
- [ ] Messaging (send, receive, Realtime)
- [ ] Matchmaking *(if in scope)*
- [ ] Founder Dashboard
- [ ] Beta Feedback Dashboard
- [ ] **iPhone Safari post-login** — feed visible, not black screen

**Exit criteria:** Founder signs **Staging Approved** in release file.  
**Do not proceed to production without this approval.**

---

## Phase 5 — Production deployment

Use [`checklists/PRODUCTION-DEPLOYMENT.md`](./checklists/PRODUCTION-DEPLOYMENT.md).

### Approval sequence (never combine)

| Step | Founder approval phrase | Action |
|------|-------------------------|--------|
| 1 | `Approved — commit vX.Y.Z` | Commit code + `dist/` + release docs |
| 2 | `Approved — tag vX.Y.Z` | `git tag -a vX.Y.Z` |
| 3 | `Approved — push vX.Y.Z` | `git push origin main && git push origin vX.Y.Z` |
| 4 | `Approved — deploy vX.Y.Z` | Apply migrations → build → Vercel production |

### Production deploy steps

```bash
cd apps/mobile
# 1. Verify gates
npx tsx scripts/verify-release-gates.ts --release features/releases/RELEASE-vX.Y.Z.md --phase production

# 2. Migrations (before client deploy)
npx supabase db push
npx supabase migration list   # confirm all applied

# 3. Build web
npx expo export -p web && node scripts/patch-web-html.js

# 4. Deploy (only after Founder deploy approval)
npx vercel --prod --yes --project frennix

# 5. Immediate verification
curl -sS -o /dev/null -w "HTTP %{http_code}\n" https://frennix.vercel.app/
# Confirm bundle hash in dist/index.html matches deployed build
# Confirm iPhone Safari login → feed (Founder spot-check)
```

### Immediate post-deploy verification

- [ ] Production HTTP 200
- [ ] Correct bundle hash serving (not prior version)
- [ ] GitHub commit SHA matches deployed commit
- [ ] All migrations applied remotely
- [ ] Supabase REST/RPC smoke test
- [ ] iPhone Safari login → feed (no black screen)
- [ ] GitHub release notes attached to tag

Record deployment ID, commit SHA, and bundle hash in release file.

---

## Phase 6 — Monitoring (24–48 hours)

Use [`checklists/POST-RELEASE-MONITORING.md`](./checklists/POST-RELEASE-MONITORING.md).

| Signal | Where |
|--------|-------|
| Production errors | Sentry |
| Analytics | Founder Dashboard → Analytics |
| Beta Feedback | `/founder/support` |
| Performance | `perf_*` events, Vercel deployment logs |
| Crashes | Sentry + App Store / Play Console (native) |
| User reports | Beta Feedback queue, direct messages |

**Rollback triggers (immediate):**

- P0: login broken, black screen, data loss, security breach
- Sustained error rate spike (>5× baseline for 15+ minutes)
- Founder directive

**Rollback procedure:**

```bash
# Promote last known-good Vercel deployment
npx vercel promote <previous-deployment-url> --yes
# Or redeploy prior dist from Git tag:
git checkout vX.Y.Z-previous -- dist/
npx vercel --prod --yes --project frennix
```

Document rollback in release file and [`RELEASE-HISTORY.md`](./RELEASE-HISTORY.md).

---

## Phase 7 — Release completion

Use [`checklists/RELEASE-COMPLETION.md`](./checklists/RELEASE-COMPLETION.md).

- [ ] Update [`CHANGELOG.md`](../../CHANGELOG.md)
- [ ] Update [`PROJECT-PROGRESS.md`](../PROJECT-PROGRESS.md)
- [ ] Mark release status **Complete** in release file
- [ ] Archive QA checklist (link from release file)
- [ ] Record lessons learned
- [ ] Update [`RELEASE-HISTORY.md`](./RELEASE-HISTORY.md)
- [ ] Founder signs **Release Complete**

---

## File conventions

| File | Purpose |
|------|---------|
| `features/releases/RELEASE_PROCESS.md` | **This document** — official SOP |
| `features/releases/RELEASE-vX.Y.Z.md` | Per-release notes, checklists, approvals |
| `features/releases/RELEASE-vX.Y.Z-READINESS.md` | **Release Readiness Report** — required before Human QA |
| `features/releases/RELEASE-HISTORY.md` | Version history + approval audit trail |
| `features/releases/checklists/*.md` | Reusable phase checklists |
| `features/releases/templates/RELEASE-vX.Y.Z-TEMPLATE.md` | Copy for each new release |
| `features/releases/templates/RELEASE-READINESS-REPORT-TEMPLATE.md` | Copy for each readiness report |
| `CHANGELOG.md` | Public-facing release summary |
| `scripts/verify-release-gates.ts` | Blocks deploy if gates incomplete |

Legacy docs (still valid, superseded by this process for procedure detail):

- [`RELEASE-WORKFLOW.md`](./RELEASE-WORKFLOW.md) — quick command reference
- [`../RELEASE-CHECKLIST.md`](../RELEASE-CHECKLIST.md) — milestone item matrix

---

## Semantic versioning

| Bump | When |
|------|------|
| **Major (X.0.0)** | Breaking changes, platform shifts |
| **Minor (x.Y.0)** | Features, milestones (P1, P2, …) |
| **Patch (x.y.Z)** | Bug fixes, hotfixes (e.g. v1.0.1 Safari layout fix) |

---

## Related incident: v1.0.0 regression (2026-06-28)

| Event | Detail |
|-------|--------|
| **Issue** | Post-login black screen on iPhone Safari |
| **Cause** | Dynamic tab-scene height in `lib/web-tab-scene-layout.ts` |
| **Resolution** | Rolled back to v0.8.0 (`c2cb3f9`); hotfix v1.0.1 planned separately |
| **Process change** | This RELEASE_PROCESS.md adopted; staging gate mandatory |

Full record: [`RELEASE-HISTORY.md`](./RELEASE-HISTORY.md)
