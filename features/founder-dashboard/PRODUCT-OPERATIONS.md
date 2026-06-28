# Frennix Product Operations — Roadmap & Milestone Releases

**Status:** Planning  
**Links:** **[Official Product Roadmap (P1–P10)](../PRODUCT-ROADMAP.md)** · [Founder Dashboard README](./README.md) · [Technical Architecture](./ARCHITECTURE.md) · [Release Workflow](../releases/RELEASE-WORKFLOW.md)

> **Canonical roadmap:** User-facing priorities and milestone gates are defined in [`features/PRODUCT-ROADMAP.md`](../PRODUCT-ROADMAP.md). This document covers founder-ops mechanics (semver, flags, inbox) that complement that roadmap.

---

## Product milestones (M1–M10)

These are **product milestones** — long-lived capability areas. Semver releases (v0.8.0, v0.9.0) ship within milestones.

| Code | Name | Description | Status (Jun 2026) |
|------|------|-------------|-------------------|
| **M1** | Foundation | Auth, profiles, feed, onboarding, referrals | Released |
| **M2** | Messaging | DMs, Realtime, presence, read receipts, push | Released (v0.8.0 stability) |
| **M3** | Stories | Workout Stories 2.0, views, reactions, highlights | Released |
| **M4** | Challenges | Create, join, invite, participate | Released |
| **M5** | Events | Workout events, RSVP, attendance | Released |
| **M6** | Matchmaking | Training partner discovery, swipes, matches | Released (beta) |
| **M7** | Founder Dashboard | Operations system (this document) | **In Progress** |
| **M8** | Ambassador Program | Ambassadors, creator tiers, referral rewards | Planned |
| **M9** | Marketplace | Products, subscriptions, payments | Planned |
| **M10** | AI Coach | AI training guidance, plans, insights | Planned |

---

## Semver ↔ milestone mapping

| Version | Milestone | Theme |
|---------|-----------|-------|
| v0.8.0 | M2 | Messaging Stability (Option A — Realtime fix only) |
| v0.9.0 | M1+M2 polish | UI polish, safe-area, Safari (planned next) |
| v1.0.0 | M1–M6 | Public launch readiness (target TBD) |
| v1.1.0 | M7 | Founder Dashboard v1 |
| v1.2.0 | M8 | Ambassador Program |

Stored in `app_releases.milestone_code` and `roadmap_features.milestone_code`.

---

## Roadmap feature lifecycle

```
Planned → In Progress → Internal Testing → Beta → Released → Deprecated
```

### Feature record (database: `roadmap_features`)

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | PK |
| `key` | TEXT UNIQUE | e.g. `messaging-realtime-v2` |
| `title` | TEXT | Display name |
| `description` | TEXT | Markdown |
| `milestone_code` | TEXT | M1–M10 |
| `status` | ENUM | Lifecycle status |
| `priority` | ENUM | low, normal, high, critical |
| `owner_staff_id` | UUID | Optional assignee |
| `feature_flag_key` | TEXT | FK → `feature_flags.key` |
| `target_release_version` | TEXT | e.g. `0.9.0` |
| `released_version` | TEXT | When status = Released |
| `deprecated_at` | TIMESTAMPTZ | When status = Deprecated |
| `sort_order` | INT | Roadmap board ordering |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

### Sub-milestones (`roadmap_feature_milestones`)

| Field | Notes |
|-------|-------|
| `feature_id` | FK |
| `title` | e.g. "RLS policies", "iOS QA" |
| `due_date` | Optional |
| `completed_at` | Nullable |
| `sort_order` | |

### Release linkage (`roadmap_feature_releases`)

Many-to-many: features ↔ `app_releases`.

---

## Initial roadmap seed (M7 Founder Dashboard)

| Key | Title | Status | Milestone |
|-----|-------|--------|-----------|
| `fd-executive-dashboard` | Executive Dashboard KPIs | In Progress | M7 |
| `fd-community-health` | Community Health Dashboard | Planned | M7 |
| `fd-platform-health` | Platform Health Dashboard | Planned | M7 |
| `fd-activity-feed` | Live Activity Feed | In Progress | M7 |
| `fd-staff-invites` | Invite-based staff roles | Planned | M7 |
| `fd-feature-flags` | Feature flag management | Planned | M7 |
| `fd-release-mgmt` | Release management UI | Planned | M7 |
| `fd-roadmap-ui` | Built-in product roadmap | Planned | M7 |
| `fd-founder-inbox` | Founder Inbox | Planned | M7 |
| `fd-ambassador-mgmt` | Ambassador management | Planned | M8 |
| `fd-ai-insights` | AI-generated insights | Planned | M10 |

---

## Milestone release package

Each semver release documents:

```yaml
version: "0.8.0"
milestone_code: "M2"
title: "Messaging Stability"
commit: c2cb3f9
tag: v0.8.0
deployment_id: dpl_...
deployment_url: https://frennix.vercel.app
environment: production
features_added: [...]
bugs_fixed: [...]
known_issues: [...]
qa_status: passed | partial | failed
rollback_commit: 5f412e2
roadmap_features: [messaging-realtime-v2]
```

Stored in `app_releases` + `features/releases/RELEASE-vX.Y.Z.md` + `CHANGELOG.md`.

---

## Feature flag registry (major features)

Flags allow disabling without redeploy. Client evaluates via RPC; cache 60s.

| Flag key | Milestone | Default | Notes |
|----------|-----------|---------|-------|
| `founder_dashboard` | M7 | false | Staff-only rollout |
| `messaging_realtime_v2` | M2 | true | v0.8.0 fix |
| `workout_stories_v2` | M3 | true | GA |
| `post_interaction_sheet` | M1 | true | GA |
| `training_matchmaking` | M6 | true | Beta cohort optional |
| `trainer_matching` | M6 | true | |
| `ambassador_program` | M8 | false | Not launched |
| `marketplace` | M9 | false | Not launched |
| `ai_coach` | M10 | false | Not launched |
| `staging_banner` | M7 | false | Show staging env indicator |

---

## Staged rollouts

For Beta → Released transitions:

1. Create `staged_rollout` linked to flag + release
2. Start at 5% → 25% → 50% → 100% with health gates
3. Auto-pause if error rate or crash rate exceeds threshold (M7.5+)
4. Record in activity feed: `🚀 Rollout advanced to 25%`

---

## QA status model

| Status | Meaning |
|--------|---------|
| `not_started` | QA not begun |
| `automated_pass` | Scripts green |
| `manual_pass` | Device QA complete |
| `partial` | Some platforms pending |
| `failed` | Blockers found |
| `signed_off` | Founder approved deploy |

Linked to `app_releases.qa_status` and roadmap feature records.

---

## Founder Inbox item sources (M7.8)

| Trigger | Auto-create inbox item |
|---------|------------------------|
| Sentry crash (new issue) | Yes, urgent |
| beta_feedback type=bug + keywords | Yes, high |
| reports status=pending > 24h | Yes, normal |
| deployment health check failed | Yes, urgent |
| notification dispatch failure spike | Yes, high |
| Realtime degraded > 5% sessions | Yes, high |
| Daily cron 8am PT | Daily summary |
| Weekly cron Monday 8am PT | Weekly summary |
| User count milestone | Yes, low |

---

## Scalability notes

| Scale | Adaptation |
|-------|------------|
| < 10k users | Full activity firehose, 5-min metric cron |
| 10k–100k | Sample like/reaction activity events; 15-min trending cache |
| 100k–1M | Partition `founder_activity_events` by month; read replicas for analytics |
| 1M+ | Dedicated analytics warehouse export (BigQuery/Snowflake); dashboard reads from summary tables only |

Schema designed for partitioning and archival from day one (`created_at` indexes, monthly partitions optional at 100k+).

---

## Review checkpoints

| Checkpoint | Deliverable | Founder action |
|------------|-------------|----------------|
| CP1 | M7.1 schema + RLS + shell | Approve → implement |
| CP2 | Executive + Activity Feed | Review → approve next |
| CP3 | Community + Platform Health | Review → approve next |
| CP4 | Roadmap + Release Management | Review → approve next |
| CP5 | Flags + Admin + Support | Review → approve next |
| CP6 | Ambassadors + Analytics | Review → approve next |
| CP7 | Founder Inbox + summaries | Review → ship M7 |

**No production code until CP1 approved.**
