# Frennix Release Workflow (Quick Reference)

> **Official process:** [`RELEASE_PROCESS.md`](./RELEASE_PROCESS.md) — the full seven-phase SOP.  
> This file is a command cheat sheet only.

---

## Seven phases (summary)

1. **Development branch** — feature branch → PR → merge (no direct `main` commits)
2. **Internal testing** — [`checklists/INTERNAL-TESTING.md`](./checklists/INTERNAL-TESTING.md)
2.5. **Release Readiness Report** — [`templates/RELEASE-READINESS-REPORT-TEMPLATE.md`](./templates/RELEASE-READINESS-REPORT-TEMPLATE.md) — Founder reviews **before** Human QA
3. **Human QA** — [`checklists/HUMAN-QA.md`](./checklists/HUMAN-QA.md) + [`checklists/CRITICAL-USER-FLOWS.md`](./checklists/CRITICAL-USER-FLOWS.md)
4. **Staging** — [`checklists/STAGING-DEPLOYMENT.md`](./checklists/STAGING-DEPLOYMENT.md) — Founder approval required
5. **Production** — [`checklists/PRODUCTION-DEPLOYMENT.md`](./checklists/PRODUCTION-DEPLOYMENT.md) — separate commit/tag/push/deploy approvals
6. **Monitoring** — [`checklists/POST-RELEASE-MONITORING.md`](./checklists/POST-RELEASE-MONITORING.md) — 24–48h
7. **Completion** — [`checklists/RELEASE-COMPLETION.md`](./checklists/RELEASE-COMPLETION.md)

**Production user bugs:** [`POSTMORTEM-PROCESS.md`](./POSTMORTEM-PROCESS.md) — mandatory before closing bug.

**Bug severity (P0–P3):** [`BUG-SEVERITY.md`](./BUG-SEVERITY.md) — classify every issue **before** fixing. Template: [`templates/BUG-REPORT-TEMPLATE.md`](./templates/BUG-REPORT-TEMPLATE.md). Verify: `npm run verify:bug-severity`.

**Overlay safe area (permanent):** [`OVERLAY-SAFE-AREA.md`](./OVERLAY-SAFE-AREA.md) — 28px margin above iOS safe area on all sheets/modals. Use `BottomOverlayShell`. Verify: `npm run verify:sheet-safe-area`.

---

## Gate validator (run before staging/production deploy)

```bash
cd apps/mobile
npx tsx scripts/verify-release-gates.ts --release features/releases/RELEASE-vX.Y.Z.md --phase staging
npx tsx scripts/verify-release-gates.ts --release features/releases/RELEASE-vX.Y.Z.md --phase production
```

Exit code **1** = deploy blocked.

---

## New release setup

```bash
cp features/releases/templates/RELEASE-vX.Y.Z-TEMPLATE.md features/releases/RELEASE-vX.Y.Z.md
cp features/releases/templates/RELEASE-READINESS-REPORT-TEMPLATE.md features/releases/RELEASE-vX.Y.Z-READINESS.md
# Fill in scope, run Phase 2 tests, complete readiness report, then request Human QA
```

---

## Staging deploy

```bash
cd apps/mobile
npx expo export -p web && node scripts/patch-web-html.js
npx vercel --yes --project frennix-staging
# https://staging.frennix.vercel.app
```

---

## Production deploy (after all approvals)

```bash
cd apps/mobile
npx tsx scripts/verify-release-gates.ts --release features/releases/RELEASE-vX.Y.Z.md --phase production
npx supabase db push
npx expo export -p web && node scripts/patch-web-html.js
npx vercel --prod --yes --project frennix
```

---

## Post-deploy smoke

```bash
curl -sS -o /dev/null -w "HTTP %{http_code}\n" https://frennix.vercel.app/
# Verify bundle hash in index.html
# iPhone Safari: login → feed (no black screen)
```

---

## Rollback

```bash
npx vercel promote <previous-deployment-url> --yes
# Or: git checkout vX.Y.Z-previous -- dist/ && npx vercel --prod --yes --project frennix
```

Document in [`RELEASE-HISTORY.md`](./RELEASE-HISTORY.md).

---

## File map

| File | Purpose |
|------|---------|
| [`RELEASE_PROCESS.md`](./RELEASE_PROCESS.md) | **Official SOP** |
| [`RELEASE-HISTORY.md`](./RELEASE-HISTORY.md) | Version history + approvals |
| [`templates/RELEASE-vX.Y.Z-TEMPLATE.md`](./templates/RELEASE-vX.Y.Z-TEMPLATE.md) | Per-release copy |
| [`../RELEASE-CHECKLIST.md`](../RELEASE-CHECKLIST.md) | Milestone item matrix |
| [`../../CHANGELOG.md`](../../CHANGELOG.md) | Public changelog |

---

## Founder approval phrases

| Step | Phrase |
|------|--------|
| Human QA → staging | `Human QA passed — approved for staging` |
| Staging → production prep | `Approved — staging verified for vX.Y.Z` |
| Commit | `Approved — commit vX.Y.Z` |
| Tag | `Approved — tag vX.Y.Z` |
| Push | `Approved — push vX.Y.Z` |
| Deploy | `Approved — deploy vX.Y.Z` |
| Complete | `Approved — vX.Y.Z complete` |

**Never combine commit, tag, push, or deploy.**
