# Staging Deployment Checklist

**Phase:** 4 of 7  
**Owner:** Engineering  
**Approver:** Founder  
**Blocks:** Production deployment (Phase 5)

**Staging URL:** https://staging.frennix.vercel.app  
**Vercel project:** `frennix-staging`

---

## Pre-deploy gates

| # | Check | Pass | Notes |
|---|-------|------|-------|
| 1 | Internal testing checklist complete | ⬜ | Phase 2 |
| 2 | Human QA checklist complete | ⬜ | Phase 3 |
| 2a | **Critical User Flows** checklist started on staging | ⬜ | [`CRITICAL-USER-FLOWS.md`](./CRITICAL-USER-FLOWS.md) |
| 2b | Overlay/modal QA complete *(if release touches sheets/menus)* | ⬜ | [`OVERLAY-MODAL-QA.md`](./OVERLAY-MODAL-QA.md) |
| 3 | `verify-release-gates.ts --phase staging` exit 0 | ⬜ | |
| 4 | Release file status = `staging-ready` | ⬜ | |

---

## Deploy steps

| # | Step | Pass | Command / detail |
|---|------|------|------------------|
| 5 | Web build succeeds | ⬜ | `npx expo export -p web && node scripts/patch-web-html.js` |
| 6 | Migrations applied to staging DB | ⬜ | `npx supabase db push` |
| 7 | Deploy to staging | ⬜ | `npx vercel --yes --project frennix-staging` |
| 8 | Staging HTTP 200 | ⬜ | `curl staging URL` |
| 9 | Correct bundle hash on staging | ⬜ | Record hash in release file |

---

## Staging verification

| # | Area | Pass | Notes |
|---|------|------|-------|
| 10 | Authentication — login / logout | ⬜ | |
| 11 | Authentication — session refresh | ⬜ | |
| 12 | Database migrations verified | ⬜ | `supabase migration list` |
| 13 | Media uploads (post, story, feedback screenshot) | ⬜ | |
| 14 | Messaging — send, receive, Realtime | ⬜ | |
| 15 | Matchmaking *(if in scope)* | ⬜ | Deck, connect, safety |
| 16 | Founder Dashboard | ⬜ | Staff account |
| 17 | Beta Feedback Dashboard | ⬜ | Staff account |
| 18 | **iPhone Safari — login → feed (no black screen)** | ⬜ | **Required** |
| 18b | **Overlay QA** *(if in scope)* | ⬜ | [`OVERLAY-MODAL-QA.md`](./OVERLAY-MODAL-QA.md) |
| 18c | **Critical User Flows** — full checklist on staging | ⬜ | [`CRITICAL-USER-FLOWS.md`](./CRITICAL-USER-FLOWS.md) — all ✅ before production |
| 19 | Android Chrome — core flows | ⬜ | |
| 20 | Desktop Web — core flows | ⬜ | |
| 21 | Analytics events reaching Supabase | ⬜ | Spot-check `product_events` |
| 22 | No failed API requests in network tab | ⬜ | |

---

## Staging deployment record

| Field | Value |
|-------|-------|
| Deployment ID | |
| Commit SHA | |
| Bundle hash | |
| Deploy date | |
| Deployed by | |

---

## Sign-off

| Role | Name | Date | Approved |
|------|------|------|----------|
| Engineering | | | ⬜ |
| Founder | | | ⬜ |

**Approval phrase:** `Approved — staging verified for vX.Y.Z`

**Do not request production deploy approval until Founder signs staging.**
