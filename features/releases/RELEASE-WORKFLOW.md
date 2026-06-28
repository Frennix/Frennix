# Frennix Release Workflow

Official versioning begins with **v0.8.0**. Every production release follows this sequence.

## Process

| Step | Action | Gate |
|------|--------|------|
| 1 | Complete development | — |
| 2 | Complete manual QA | — |
| 3 | Generate release notes (plain text for review) | — |
| 4 | **Wait for founder approval** | Required |
| 5 | Commit (code + `dist/` for web + release doc) | Approved |
| 6 | Create Git tag (`vX.Y.Z`) | Approved |
| 7 | Push commit and tag to GitHub | Approved |
| 8 | Deploy to production | Approved |
| 9 | Verify production health | Automated + spot-check |
| 10 | Record release in release history | Post-deploy |

**No step after approval #4 runs automatically.** Each of commit, tag, push, and deploy requires explicit founder sign-off.

## Release artifact checklist

Every release must document:

- Version number
- Release date
- Commit hash
- Git tag
- Deployment URL
- Deployment ID
- Features added
- Bugs fixed
- Known issues
- QA checklist completed
- Rollback plan
- Release notes

## File conventions

| File | Purpose |
|------|---------|
| `features/releases/RELEASE-vX.Y.Z.md` | Detailed release notes + sign-off log |
| `CHANGELOG.md` | Append-only summary (one section per version) |
| `dist/` | Pre-built web export (committed for Vercel deploy) |

## Semantic versioning

- **Major (X)**: Breaking changes, large platform shifts
- **Minor (Y)**: Features, milestones, significant polish
- **Patch (Z)**: Bug fixes, hotfixes

## Deploy commands (web)

```bash
cd apps/mobile
npx expo export -p web && node scripts/patch-web-html.js
# After commit + tag + push:
npx vercel --prod --yes --project frennix
```

## Post-deploy verification

```bash
curl -sS -o /dev/null -w "HTTP %{http_code}\n" https://frennix.vercel.app/
# Confirm dist/index.html bundle hash matches commit
# Confirm GitHub main SHA matches deployed commit
```

Record results in `RELEASE-vX.Y.Z.md` sign-off table and `app_releases` (Founder Dashboard, Milestone 1).

## Milestone releases

Product milestones (M1–M10) are documented in [PRODUCT-OPERATIONS.md](../founder-dashboard/PRODUCT-OPERATIONS.md). Each semver release should set `app_releases.milestone_code` and link roadmap features via `roadmap_feature_releases`.

When Founder Dashboard M7.4 ships, release recording moves from manual markdown to dashboard UI + database — until then, use `features/releases/RELEASE-vX.Y.Z.md` and `CHANGELOG.md`.

## Rollback

1. Redeploy previous known-good Vercel deployment or checkout prior `dist/` from Git tag.
2. Update `app_releases.status` to `rolled_back` when Founder Dashboard is live.
3. No DB rollback unless migration was part of release.
