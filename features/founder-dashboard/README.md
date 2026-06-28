# Frennix Product Operations System

**Status:** Architecture — no production code until founder approval per milestone  
**Scope:** Founder Dashboard, release management, roadmap, feature flags, Founder Inbox  
**Principle:** Scale from hundreds to millions of users without redesigning founder tools

---

## Document map

| Document | Purpose |
|----------|---------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Technical architecture, schema, security, UI modules |
| [PRODUCT-OPERATIONS.md](./PRODUCT-OPERATIONS.md) | Roadmap, milestone releases, release ↔ feature linkage |
| [../releases/RELEASE-WORKFLOW.md](../releases/RELEASE-WORKFLOW.md) | Human release process (10 steps, founder approval gates) |

---

## Guiding principles

1. **Modular from day one** — Each dashboard section is an independent module with its own widgets, RPCs, and refresh cadence. New sections plug in without refactoring the shell.

2. **Aggregates over scans** — Dashboard never runs `COUNT(*)` on large tables from the client. Nightly + incremental materialized metrics; live counters only where justified (online users, activity feed).

3. **Role-based access** — Invite-based staff roles (Founder, Admin, Moderator, Support) with granular permissions. No manual SQL grants in production.

4. **Flags before deploys** — Major features ship behind feature flags. Disable without redeploy when possible.

5. **Every release is traceable** — Version, commit, tag, deployment ID, QA status, rollback plan, and roadmap feature linkage stored in DB and visible in dashboard.

6. **Ops center, not a report** — Live Activity Feed + Founder Inbox surface what needs attention now; analytics explain trends over time.

7. **Staging mirrors production** — Dedicated staging environment for major releases before public deploy.

8. **Monitor early** — Sentry (crashes) + performance events integrated in Milestone 1 foundation, not deferred.

9. **Scale to millions from day one** — Every page, widget, chart, and table supports **pagination**, **filtering**, **searching**, **exporting**, and **real-time updates** where appropriate. No widget is built as a one-off that requires redesign at scale.

10. **Mobile-first founder UX** — The dashboard must be fully usable on iPhone (touch targets, drawer nav, responsive grids, safe areas). Desktop is primary layout; mobile is equal priority, not an afterthought.

11. **Parallel product development** — Founder Dashboard work must not block core user-facing features (Messaging, Matchmaking, Events, Challenges, Nutrition, Groups, Feed). Dashboard milestones run in parallel with product work.

---

## Founder Dashboard — module map

The Founder Dashboard is the operating system for Frennix. All modules share a common shell, widget framework, and design system.

```
/founder
├── index                    Executive Dashboard (landing — first screen)
├── community                Community Health Dashboard
├── platform                 Platform / System Health Dashboard
├── analytics/users          User Analytics
├── activity                 Live Activity Feed
├── moderation               Reports & Moderation
├── ambassadors              Ambassador Management
├── flags                    Feature Flags
├── releases                 Release Management
├── roadmap                  Product Roadmap
├── admin                    Admin Tools (hub)
├── support                  Support Dashboard
├── notifications            Notification Center (staff)
└── inbox                    Founder Inbox (Milestone 6)
```

### Module summary

| Module | Purpose | Primary roles |
|--------|---------|---------------|
| **Executive Dashboard** | Top KPIs at a glance | Founder, Admin |
| **Community Health** | Growth & engagement of the community | Founder, Admin |
| **Platform Health** | Infra, Realtime, DB, API, crashes | Founder, Admin |
| **User Analytics** | Cohorts, retention, growth charts | Founder, Admin |
| **Live Activity Feed** | Real-time ops center | Founder, Admin |
| **Reports & Moderation** | User reports, content moderation | Founder, Admin, Moderator |
| **Ambassador Management** | Ambassadors, referrals, top creators | Founder, Admin |
| **Feature Flags** | Enable/disable features, staged rollouts | Founder |
| **Release Management** | Deploy history, rollback, QA status | Founder, Admin |
| **Product Roadmap** | Planned → Released feature lifecycle | Founder, Admin |
| **Admin Tools** | Staff invites, announcements, config | Founder |
| **Support Dashboard** | Tickets, feedback queue | Founder, Admin, Support |
| **Notification Center** | Staff alerts, system notifications | All staff |
| **Founder Inbox** | Prioritized action queue | Founder (M6) |

---

## Executive Dashboard (landing page)

**Route:** `/founder` (default after login)

First screen on every visit. Large KPI cards, minimal chrome, instant system pulse.

### KPI cards

| KPI | Icon | Source | Refresh |
|-----|------|--------|---------|
| Total Users | 👥 | `founder_metrics_daily.total_users` | 5 min |
| Online Now | 🟢 | Live `profiles` online window | 30 sec |
| New Users Today | ✨ | Signups today | 1 min |
| Daily Active Users | 📊 | `product_events` / DAU table | 5 min |
| Weekly Active Users | 📈 | WAU aggregate | 5 min |
| Monthly Active Users | 📅 | MAU aggregate | 5 min |
| Messages Today | 💬 | `messages` today count | 1 min |
| Workout Posts Today | 🏋️ | `posts` workout types today | 1 min |
| Stories Today | 📸 | Story posts today | 1 min |
| New Matches | 🤝 | `matches` today | 5 min |
| Active Challenges | 🏆 | Active challenge count | 5 min |
| Events This Week | 📅 | `events` this week | 5 min |
| Push Notification Delivery | 🔔 | Push dispatch success rate | 5 min |
| Current Release Version | 🚀 | `app_releases` latest production | On load |
| System Status | 🟢/🔴 | Composite health score | 1 min |
| Active Errors | ⚠️ | Errors last 15 min | 30 sec |
| Server Health | 🖥️ | Supabase + Vercel probe | 1 min |

### Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Frennix Founder          v0.8.0 · Production · ● Healthy    [Activity →]│
├─────────────────────────────────────────────────────────────────────────┤
│  EXECUTIVE OVERVIEW                                      Updated 30s ago  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │👥 12.4k  │ │🟢 312    │ │✨ 89     │ │📊 1,842  │ │📈 4,201  │       │
│  │Total     │ │Online    │ │New today │ │DAU       │ │WAU       │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │💬 2.1k   │ │🏋️ 142   │ │📸 38     │ │🤝 34     │ │🏆 12     │       │
│  │Messages  │ │Workouts  │ │Stories   │ │Matches   │ │Challenges│       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │📅 8      │ │🔔 98.2%  │ │🚀 0.8.0  │ │🟢 OK     │ │⚠️ 2      │       │
│  │Events/wk │ │Push del. │ │Release   │ │System    │ │Errors    │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│                                                                          │
│  LIVE ACTIVITY (preview)                              [Open feed →]      │
│  🟢 New signup · 💬 Message · 🏋️ Workout · 🚀 Deploy · 🟢 DB healthy   │
└─────────────────────────────────────────────────────────────────────────┘
```

Below KPIs: compact activity preview + quick links to Community Health and Platform Health.

---

## Community Health Dashboard

**Route:** `/founder/community`

Tracks **community** health — distinct from **platform/system** health.

| Metric | Description |
|--------|-------------|
| User Retention | D1 / D7 / D30 cohort retention |
| Engagement Rate | DAU / MAU ratio |
| Posts per Day | All post types |
| Messages per Day | DM volume |
| Comments | Comment count + trend |
| Reactions | Post + message reactions |
| Story Views | `story_views` aggregate |
| Workout Completions | Posts with completion milestones |
| Challenge Participation | Joins + active participants |
| Event Attendance | RSVPs / check-ins |
| Referral Growth | New referrals over time |
| Invite Conversion | Signups / invites sent |
| Ambassador Performance | Per-ambassador referral + engagement |
| Top Creators | By posts, reactions, story views |
| Trending Posts | Velocity score (likes + comments / hour) |
| Trending Exercises | Workout types by volume |
| Trending Gyms | `home_gym` frequency |
| Trending Cities | `city` frequency |
| Notification Open Rate | Push → app open (when tracked) |
| Push Engagement | Delivery, open, dismiss rates |

**Charts:** 7d / 30d / 90d line charts per metric; comparison vs prior period.

**Data:** `founder_community_metrics_daily` (materialized) + on-demand RPCs for trending lists (cached 15 min).

---

## Platform / System Health Dashboard

**Route:** `/founder/platform`

Tracks **infrastructure** — distinct from community health.

| Subsystem | Signals |
|-----------|---------|
| App health | Error rate, crash-free sessions |
| Supabase | API status, project health |
| Realtime messaging | Subscribe success, degraded sessions |
| Presence | Heartbeat success, stale online count |
| Notifications | Push dispatch, delivery failures |
| Database | Connection pool, query latency p50/p95 |
| Storage | Usage GB, upload errors |
| API latency | Edge Function + REST p95 |
| Error rate | Errors / session |
| Crash reports | Sentry count by release |
| Performance | Avg load time, LCP (web) |

**Status model:** `healthy` | `degraded` | `down` | `unknown` with history sparklines (24h).

---

## Live Activity Feed

**Route:** `/founder/activity`

Real-time operations center. Full firehose for Founder/Admin with filters.

### Event types

User · Messaging · Stories · Posts · Events · Challenges · Matches · Notifications · Deployments · Errors · Security · Growth · System health

### Filters

| Filter | Values |
|--------|--------|
| Time | Last 15 min, Today, This week, This month |
| Category | Users, Messaging, Stories, Posts, Events, Challenges, Matches, Notifications, Deployments, Errors, Security, Growth, System health |

### Transport

- **Realtime:** Supabase INSERT on `founder_activity_events` (unique channel topics)
- **Backfill:** Paginated RPC for historical ranges
- **Scale:** At >50k DAU, sample high-volume events (likes) — always log signups, errors, deploys, health

---

## Product Roadmap (built-in)

**Route:** `/founder/roadmap`

Every feature tracked through lifecycle:

| Status | Meaning |
|--------|---------|
| Planned | Scoped, not started |
| In Progress | Active development |
| Internal Testing | Staff-only |
| Beta | Limited user cohort |
| Released | Production, flag on or GA |
| Deprecated | Sunset scheduled |

### Feature record

- Title, description, milestone (M1–M10)
- Status, priority, owner
- Linked feature flag key(s)
- Linked release version(s)
- Milestones (sub-deliverables with dates)
- Release notes (per version)
- Deployment history (FK → `app_releases`)
- QA status (checklist + sign-off)

### Views

- Kanban by status
- Timeline (Gantt-style)
- Milestone grouping (M1 Foundation … M10 AI Coach)

---

## Feature flags

**Route:** `/founder/flags`

Every major feature controllable without redeploy when possible.

### Flag model

```text
feature_flags
  key: "workout_stories_v2"
  enabled_globally: false
  default_value: false
  linked_roadmap_feature_id: UUID

feature_flag_overrides
  target: user | cohort | percentage | staff | beta_testers
  enabled: true/false
  expires_at: optional
```

### Client integration

```typescript
// useFeatureFlag('workout_stories_v2') — React Query, 60s stale
// Evaluated server-side via evaluate_feature_flag(key, user_id)
// Founder/Admin bypass for testing
```

### Major features to flag (initial registry)

| Key | Milestone |
|-----|-----------|
| `founder_dashboard` | M7 |
| `workout_stories_v2` | M3 |
| `training_matchmaking` | M6 |
| `ambassador_program` | M8 |
| `marketplace` | M9 |
| `ai_coach` | M10 |
| `messaging_realtime_v2` | M2 |

---

## Milestone releases (M1–M10)

Product milestones map to engineering releases but are **not identical** to semver. Each milestone has:

- Release notes
- Deployment history (`app_releases.milestone_code`)
- Rollback information
- QA status
- Linked roadmap features

| Code | Name | Scope (product) |
|------|------|-----------------|
| M1 | Foundation | Core app, auth, profiles, feed basics |
| M2 | Messaging | DMs, Realtime, presence, notifications |
| M3 | Stories | Workout Stories 2.0, engagement |
| M4 | Challenges | Challenges, participation, invites |
| M5 | Events | Workout events, RSVP, attendance |
| M6 | Matchmaking | Training partner matching |
| M7 | Founder Dashboard | This operations system |
| M8 | Ambassador Program | Ambassadors, referrals, creators |
| M9 | Marketplace | Products, subscriptions (future) |
| M10 | AI Coach | AI training features (future) |

**Current semver mapping:** v0.8.0 = M2 Messaging Stability patch release.

---

## Founder Inbox (Milestone 6)

**Route:** `/founder/inbox`

Personal command center — items requiring founder attention, auto-surfaced and prioritized.

| Source | Inbox type | Default priority |
|--------|------------|------------------|
| Sentry | Crash report | Urgent |
| beta_feedback (bug) | Critical bug | High |
| beta_feedback (feature) | Feature request | Normal |
| reports | User report | High |
| moderation queue | Moderation alert | Normal |
| staff_invites / verification | Verification request | Normal |
| activity (error) | Realtime / system issue | High |
| activity (deployment) | Deployment failure | Urgent |
| milestones | 100 / 1k / 10k users | Low (celebratory) |
| ambassador applications | New ambassador | Normal |
| partnerships | Partnership inquiry | Normal |
| cron | Daily summary | Normal |
| cron | Weekly summary | Normal |

**Actions:** Resolve · Assign · Archive · Convert to task · Snooze

**Priority:** Urgent > High > Normal > Low

---

## Staff access (invite-based)

| Role | Dashboard | Moderation | Support | Flags | Releases |
|------|:---------:|:----------:|:-------:|:-----:|:--------:|
| Founder | Full | ✓ | ✓ | ✓ | ✓ |
| Admin | Full | ✓ | ✓ | Read | ✓ |
| Moderator | — | ✓ | — | — | — |
| Support | Support module | — | ✓ | — | — |

Invites: `staff_invites` → email/token → `accept_staff_invite()` → `staff_memberships`.

Legacy `profiles.is_admin` synced via trigger for backward compatibility until admin screens migrate.

---

## Environments

| Environment | URL (planned) | Purpose |
|-------------|---------------|---------|
| Development | localhost | Local dev |
| Staging | `staging.frennix.vercel.app` | Pre-release QA, mirrors production |
| Production | `frennix.vercel.app` | Public users |

Staging deploys from `staging` branch or manual promote. Release Management shows all three.

---

## Monitoring (early integration)

| Tool | Integration point | Milestone |
|------|-------------------|-----------|
| Sentry | Already in `initSentry()` — webhook → activity + inbox | M1 |
| `product_events` | Perf + error events | M1 (exists) |
| Health probes | Edge Function cron → `system_health_snapshots` | M1 |
| Vercel API | Deployment status | M1 |
| Supabase Management | Storage, DB metrics | M2 |

---

## Implementation phases (pause for review after each)

| Phase | Deliverables | Review gate |
|-------|--------------|-------------|
| **M7.1 Foundation** | Schema, RLS, staff invites, shell, widget framework | Founder review |
| **M7.2 Executive + Activity** | Landing KPIs, live feed, filters | Founder review |
| **M7.3 Community + Platform** | Health dashboards, metrics cron | Founder review |
| **M7.4 Roadmap + Releases** | Roadmap UI, release management, CHANGELOG sync | Founder review |
| **M7.5 Flags + Admin** | Feature flags, staff admin, announcements | Founder review |
| **M7.6 Support + Moderation** | Support dashboard, moderation merge | Founder review |
| **M7.7 Ambassadors + Analytics** | Ambassador module, user analytics charts | Founder review |
| **M7.8 Inbox + Intelligence** | Founder Inbox, daily/weekly summaries, AI insights prep | Founder review |

**Do not proceed to next phase without founder approval.**

---

## Related documents

- Technical schema, RLS, RPCs, wireframes → [ARCHITECTURE.md](./ARCHITECTURE.md)
- Roadmap ↔ release linkage, M1–M10 detail → [PRODUCT-OPERATIONS.md](./PRODUCT-OPERATIONS.md)
- Human release process → [../releases/RELEASE-WORKFLOW.md](../releases/RELEASE-WORKFLOW.md)
