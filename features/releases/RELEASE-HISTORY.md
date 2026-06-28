# Frennix Release History

Official audit trail of semver releases, approvals, deployments, and outcomes.  
**Process:** [`RELEASE_PROCESS.md`](./RELEASE_PROCESS.md)

---

## Version index

| Version | Date | Commit | Status | Milestone | Notes |
|---------|------|--------|--------|-----------|-------|
| v0.8.0 | 2026-06-28 | `c2cb3f9` | **Production (stable)** | Messaging stability | Current production after v1.0.0 rollback |
| v1.0.0 | 2026-06-28 | `ccfb65b` | **Rolled back** | P1 Matchmaking | iPhone Safari black screen — see incident below |
| v1.0.1 | — | — | **Planned hotfix** | P1 | Safari tab-scene layout fix — not deployed |

---

## v0.8.0 — Messaging Stability

| Field | Value |
|-------|-------|
| **Release date** | 2026-06-28 |
| **Commit** | `c2cb3f947b1ad7205690a84f3f2b4bc343b13a9a` |
| **Tag** | `v0.8.0` |
| **Production URL** | https://frennix.vercel.app |
| **Bundle** | `index-623f4d405879707a92a881e88293ab6e.js` |
| **Status** | Production (restored 2026-06-28 after v1.0.0 rollback) |

### Approvals

| Step | Approved | Date |
|------|----------|------|
| Commit | Pre-process | 2026-06 |
| Tag | Pre-process | 2026-06 |
| Deploy | Pre-process | 2026-06 |
| Rollback restore | Founder verified iPhone | 2026-06-28 |

### Notes

Last known-good production before P1 v1.0.0 ship. Restored via redeploy of `c2cb3f9` dist after v1.0.0 regression.

---

## v1.0.0 — P1 Matchmaking (rolled back)

| Field | Value |
|-------|-------|
| **Release date** | 2026-06-28 |
| **Commit** | `ccfb65be4046145963cc2a64256e15fd41873510` |
| **Tag** | `v1.0.0` |
| **GitHub Release** | https://github.com/Frennix/Frennix/releases/tag/v1.0.0 |
| **Deployment ID** | `dpl_BjjZNdL9Qzh5dxw6deUMVSaX1knS` |
| **Bundle** | `index-99411bd081bb076672a97ea08b018458.js` |
| **Status** | **Rolled back** |

### Approvals (completed)

| Step | Phrase | Date |
|------|--------|------|
| Commit | `Approved — commit P1` | 2026-06-28 |
| Tag | `Approved — tag v1.0.0` | 2026-06-28 |
| Push | `Approved — push v1.0.0` | 2026-06-28 |
| Deploy | `Approved — deploy v1.0.0` | 2026-06-28 |

### Incident — post-login black screen (iPhone Safari)

| Field | Detail |
|-------|--------|
| **Reported** | 2026-06-28 |
| **Symptom** | Completely black screen after login on iPhone |
| **Root cause** | `lib/web-tab-scene-layout.ts` — dynamic tab chrome calculation (`BottomTabBarHeightContext` + `useSafeAreaInsets`) mis-sized feed container on iPhone Safari |
| **Classification** | Safari/iPhone rendering regression |
| **Resolution** | Rollback to v0.8.0 (`dpl_A3FhTGfWUcPZnZG9TKLcTP2M58Xo`) |
| **Founder verified** | iPhone rollback confirmed stable |

### Process gaps identified

| Gap | Remediation |
|-----|-------------|
| No staging deploy before production | **Mandatory staging gate** — [`RELEASE_PROCESS.md`](./RELEASE_PROCESS.md) Phase 4 |
| iPhone Safari post-login not in QA gate | **Required row** in Human QA checklist |
| Commit/tag/push/deploy combined risk | **Separate approvals** enforced in production checklist |
| No release gate validator | **`scripts/verify-release-gates.ts`** added |

### Lessons learned

1. Automated HTTP smoke tests do not catch Safari flex-layout regressions — iPhone Safari manual login → feed is mandatory.
2. Dynamic layout calculations (`useSafeAreaInsets`, tab bar context) need device QA before replacing fixed conservative constants.
3. Rollback plan (prior deployment ID + prior dist commit) must be filled **before** production deploy.
4. Migrations can ship separately from client — v1.0.0 migrations remained applied after rollback without issue.

---

## v1.0.1 — Safari tab layout hotfix (planned)

| Field | Value |
|-------|-------|
| **Type** | Patch / hotfix |
| **Branch** | `hotfix/v1.0.1-safari-tab-layout` |
| **Fix** | Restore `WEB_TAB_CHROME_PX = 140` in `lib/web-tab-scene-layout.ts` |
| **Status** | Not deployed — awaiting separate hotfix QA + approval |

### Required before deploy

- [ ] Full RELEASE_PROCESS.md phases 2–4 (internal testing, human QA, staging)
- [ ] iPhone Safari login → feed verified on staging
- [ ] Separate Founder approvals: commit → tag → push → deploy

---

## Adding a new release

1. Copy [`templates/RELEASE-vX.Y.Z-TEMPLATE.md`](./templates/RELEASE-vX.Y.Z-TEMPLATE.md) → `RELEASE-vX.Y.Z.md`
2. Follow [`RELEASE_PROCESS.md`](./RELEASE_PROCESS.md)
3. Add row to version index above on deploy
4. Update on completion or rollback
