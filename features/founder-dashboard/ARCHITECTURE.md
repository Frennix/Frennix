# Founder Dashboard — Technical Architecture

**Status:** Planning — awaiting CP1 approval before production code  
**Companion docs:** [README](./README.md) · [Product Operations](./PRODUCT-OPERATIONS.md)  
**Scale target:** Hundreds → millions of users without founder-tool redesign

---

## 1. System architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           Frennix Client (Expo 52)                           │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ FounderShell│  │ WidgetGrid   │  │ useFeature  │  │ ActivityFeedRealtime│ │
│  │ + Sidebar   │  │ + KPI cards  │  │ Flag()      │  │ (unique RT topics)  │ │
│  └──────┬──────┘  └──────┬───────┘  └──────┬──────┘  └──────────┬──────────┘ │
└─────────┼────────────────┼─────────────────┼─────────────────────┼───────────┘
          │                │                 │                     │
          ▼                ▼                 ▼                     ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                         Supabase Postgres + Realtime                         │
│  staff_memberships │ founder_* tables │ roadmap_* │ feature_flags │ cron     │
│  SECURITY DEFINER RPCs (staff-gated) │ triggers → founder_activity_events    │
└──────────────────────────────────────────────────────────────────────────────┘
          │                              │
          ▼                              ▼
┌─────────────────────┐    ┌───────────────────────────────────────────────────┐
│ Edge Functions      │    │ External (server-side only)                       │
│ • probe_health      │    │ Vercel API · Sentry webhook · Supabase Mgmt API   │
│ • record_deployment │    │ Push delivery stats · Staging deploy webhook      │
│ • sentry_ingest     │    └───────────────────────────────────────────────────┘
│ • staff_invite_send │
└─────────────────────┘
```

### Design rules

1. Client calls **RPCs only** for dashboard data — never raw table scans on large tables.
2. **Writes** to metrics, health, activity (bulk) via triggers, cron, Edge Functions — not client INSERT.
3. **Realtime** only for activity feed + notification center; metrics poll on interval.
4. **Modular widgets** register in `FOUNDER_WIDGETS` map; lazy-load chart modules.
5. Reuse Messages-fix pattern: `allocRealtimeTopic()` for all dashboard Realtime subs.

### Scalable widget contract (all milestones)

Every table, chart, and list built after M7.1 must implement:

| Capability | Implementation |
|------------|----------------|
| **Pagination** | `FounderListParams` + `FounderPaginatedResult<T>`; default page size 25 |
| **Filtering** | `filters` record on list params; server-side RPC |
| **Search** | `search` string; indexed columns only |
| **Export** | `FounderWidget.onExport('csv' \| 'json')`; server RPC for large exports |
| **Real-time** | `refreshMode: 'poll' \| 'realtime' \| 'manual'` per widget |
| **Mobile** | 44px touch targets; drawer nav < 768px; responsive KPI grid |

See `lib/founder/types.ts` and `components/founder/FounderWidget.tsx`.

---

## 2. Staff roles & invites

### 2.1 Roles

```sql
CREATE TYPE public.staff_role AS ENUM (
  'founder',
  'admin',
  'moderator',
  'support'
);
```

| Role | Permissions |
|------|-------------|
| `founder` | Full dashboard, flags write, staff invites, releases, roadmap |
| `admin` | Full dashboard read, moderation, support, releases read/write |
| `moderator` | Reports & moderation module only |
| `support` | Support dashboard, feedback queue |

### 2.2 Tables

```sql
CREATE TABLE public.staff_memberships (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.staff_role NOT NULL,
  granted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

CREATE TABLE public.staff_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  role public.staff_role NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  invited_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 2.3 Invite flow

1. Founder creates invite → `create_staff_invite(email, role)` → email with link `/staff/join?token=...`
2. Recipient signs in → `accept_staff_invite(token)` → row in `staff_memberships`
3. Revoke: `revoke_staff_membership(user_id)`

### 2.4 Legacy compatibility

Trigger on `staff_memberships` INSERT/UPDATE:

```sql
-- Sync profiles.is_admin = true when role IN (founder, admin, moderator)
-- Existing admin screens keep working until migrated to staff role checks
```

Helper functions:

```sql
has_staff_role(role) → boolean
has_staff_capability(capability) → boolean  -- maps role → permission set
get_my_staff_role() → staff_role | null
```

---

## 3. Database schema — operations tables

### 3.1 App releases & environments

```sql
CREATE TABLE public.app_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL,
  milestone_code TEXT,                      -- M1..M10
  git_tag TEXT,
  git_commit TEXT NOT NULL,
  bundle_hash TEXT,
  deployment_id TEXT,
  deployment_url TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'production'
    CHECK (environment IN ('development', 'staging', 'production')),
  status TEXT NOT NULL DEFAULT 'production'
    CHECK (status IN ('draft', 'staging', 'production', 'rolled_back')),
  qa_status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (qa_status IN ('not_started','automated_pass','manual_pass','partial','failed','signed_off')),
  release_notes TEXT,
  features_added TEXT[],
  bugs_fixed TEXT[],
  known_issues TEXT[],
  rollback_commit TEXT,
  deployed_at TIMESTAMPTZ,
  deployed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 3.2 Product roadmap

```sql
CREATE TYPE public.roadmap_status AS ENUM (
  'planned', 'in_progress', 'internal_testing', 'beta', 'released', 'deprecated'
);

CREATE TABLE public.roadmap_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  milestone_code TEXT NOT NULL,
  status public.roadmap_status NOT NULL DEFAULT 'planned',
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low','normal','high','critical')),
  owner_staff_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  feature_flag_key TEXT REFERENCES public.feature_flags(key) ON DELETE SET NULL,
  target_release_version TEXT,
  released_version TEXT,
  deprecated_at TIMESTAMPTZ,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.roadmap_feature_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id UUID NOT NULL REFERENCES public.roadmap_features(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  due_date DATE,
  completed_at TIMESTAMPTZ,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE public.roadmap_feature_releases (
  feature_id UUID REFERENCES public.roadmap_features(id) ON DELETE CASCADE,
  release_id UUID REFERENCES public.app_releases(id) ON DELETE CASCADE,
  PRIMARY KEY (feature_id, release_id)
);
```

### 3.3 Feature flags

```sql
CREATE TABLE public.feature_flags (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  milestone_code TEXT,
  enabled_globally BOOLEAN NOT NULL DEFAULT false,
  default_value JSONB NOT NULL DEFAULT 'false'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.feature_flag_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key TEXT NOT NULL REFERENCES public.feature_flags(key) ON DELETE CASCADE,
  target_type TEXT NOT NULL
    CHECK (target_type IN ('user','cohort','percentage','staff','beta_testers')),
  target_value TEXT NOT NULL,
  enabled BOOLEAN NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.staged_rollouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key TEXT NOT NULL REFERENCES public.feature_flags(key) ON DELETE CASCADE,
  release_id UUID REFERENCES public.app_releases(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  percentage INT NOT NULL CHECK (percentage BETWEEN 0 AND 100),
  cohort_filter JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','active','paused','completed','cancelled')),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 3.4 Activity feed

```sql
CREATE TYPE public.activity_category AS ENUM (
  'user', 'messaging', 'stories', 'posts', 'events', 'challenges',
  'matches', 'notifications', 'deployments', 'errors', 'security',
  'growth', 'health', 'community', 'system'
);

CREATE TYPE public.activity_kind AS ENUM (
  'user_signed_up', 'user_returned', 'profile_completed',
  'message_sent', 'workout_posted', 'story_uploaded', 'story_viewed',
  'post_liked', 'reaction_added', 'comment_added',
  'training_match', 'event_created', 'event_joined', 'event_attended',
  'challenge_joined', 'challenge_completed',
  'notification_sent', 'notification_failed',
  'deployment_completed', 'deployment_failed', 'rollout_advanced',
  'error_detected', 'crash_reported', 'security_alert',
  'health_supabase', 'health_messaging', 'health_notifications',
  'health_database', 'health_app', 'milestone_reached',
  'ambassador_applied', 'referral_converted'
);

CREATE TABLE public.founder_activity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind public.activity_kind NOT NULL,
  category public.activity_category NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  actor_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  severity TEXT NOT NULL DEFAULT 'info'
    CHECK (severity IN ('info','success','warning','error','critical')),
  environment TEXT NOT NULL DEFAULT 'production',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fae_created ON public.founder_activity_events(created_at DESC);
CREATE INDEX idx_fae_category_created ON public.founder_activity_events(category, created_at DESC);
-- Partition by month when > 1M rows (future)
```

### 3.5 Metrics (executive + community)

```sql
CREATE TABLE public.founder_metrics_daily (
  date DATE PRIMARY KEY,
  environment TEXT NOT NULL DEFAULT 'production',
  -- Executive KPIs
  total_users INT NOT NULL DEFAULT 0,
  users_online INT NOT NULL DEFAULT 0,
  new_signups INT NOT NULL DEFAULT 0,
  dau INT NOT NULL DEFAULT 0,
  wau INT NOT NULL DEFAULT 0,
  mau INT NOT NULL DEFAULT 0,
  returning_users INT NOT NULL DEFAULT 0,
  messages_today INT NOT NULL DEFAULT 0,
  workout_posts_today INT NOT NULL DEFAULT 0,
  stories_today INT NOT NULL DEFAULT 0,
  new_matches INT NOT NULL DEFAULT 0,
  active_challenges INT NOT NULL DEFAULT 0,
  events_this_week INT NOT NULL DEFAULT 0,
  push_delivery_rate NUMERIC(5,2),
  active_errors INT NOT NULL DEFAULT 0,
  -- Community health
  engagement_rate NUMERIC(5,4),
  retention_d1 NUMERIC(5,2),
  retention_d7 NUMERIC(5,2),
  retention_d30 NUMERIC(5,2),
  posts_per_day INT NOT NULL DEFAULT 0,
  comments_per_day INT NOT NULL DEFAULT 0,
  reactions_per_day INT NOT NULL DEFAULT 0,
  story_views_per_day INT NOT NULL DEFAULT 0,
  workout_completions INT NOT NULL DEFAULT 0,
  challenge_participation INT NOT NULL DEFAULT 0,
  event_attendance INT NOT NULL DEFAULT 0,
  referral_growth INT NOT NULL DEFAULT 0,
  invite_conversion_rate NUMERIC(5,2),
  notification_open_rate NUMERIC(5,2),
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (date, environment)
);

CREATE TABLE public.founder_trending_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_type TEXT NOT NULL
    CHECK (snapshot_type IN (
      'top_creators','trending_posts','trending_exercises',
      'trending_gyms','trending_cities','top_ambassadors'
    )),
  payload JSONB NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 3.6 System health

```sql
CREATE TABLE public.system_health_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subsystem TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'production',
  status TEXT NOT NULL CHECK (status IN ('healthy','degraded','down','unknown')),
  latency_ms INT,
  error_rate NUMERIC(8,4),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 3.7 Founder Inbox (schema ready — UI in M7.8)

```sql
CREATE TYPE public.inbox_item_type AS ENUM (
  'crash','critical_bug','feature_request','user_report','moderation_alert',
  'support_request','tester_feedback','verification_request','deployment_failure',
  'notification_failure','database_warning','realtime_issue','security_alert',
  'performance_alert','milestone','ambassador_application','partnership_inquiry',
  'daily_summary','weekly_summary','community_highlight'
);

CREATE TYPE public.inbox_priority AS ENUM ('low','normal','high','urgent');

CREATE TABLE public.founder_inbox_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type public.inbox_item_type NOT NULL,
  priority public.inbox_priority NOT NULL DEFAULT 'normal',
  title TEXT NOT NULL,
  body TEXT,
  source_table TEXT,
  source_id UUID,
  activity_event_id UUID REFERENCES public.founder_activity_events(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','assigned','resolved','archived','snoozed')),
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  snoozed_until TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 3.8 Ambassador program (M8 — schema stub in M7)

```sql
CREATE TABLE public.ambassadors (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  tier TEXT NOT NULL DEFAULT 'bronze' CHECK (tier IN ('bronze','silver','gold','platinum')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending','active','paused','revoked')),
  referral_count INT NOT NULL DEFAULT 0,
  engagement_score NUMERIC(10,2) NOT NULL DEFAULT 0,
  applied_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes TEXT
);
```

### 3.9 Admin announcements & staff notifications

```sql
CREATE TABLE public.admin_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  audience TEXT NOT NULL DEFAULT 'all',
  priority TEXT NOT NULL DEFAULT 'normal',
  active BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.staff_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  link_path TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 3.10 Audit log

```sql
CREATE TABLE public.founder_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  before_state JSONB,
  after_state JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 4. Security & RLS

### 4.1 Capability matrix

```text
capability_view_executive      → founder, admin
capability_view_community      → founder, admin
capability_view_platform       → founder, admin
capability_view_analytics      → founder, admin
capability_view_activity       → founder, admin
capability_moderate            → founder, admin, moderator
capability_support             → founder, admin, support
capability_manage_flags        → founder
capability_manage_releases     → founder, admin
capability_manage_roadmap      → founder, admin
capability_manage_staff        → founder
capability_manage_ambassadors  → founder, admin
```

### 4.2 RLS pattern

All `founder_*`, `roadmap_*`, `feature_flags`, `app_releases`, `staff_invites` (read own pending):

```sql
USING (public.has_staff_capability('capability_...'))
```

`founder_activity_events`:

- SELECT: staff with `capability_view_activity`
- INSERT: **deny direct client** — SECURITY DEFINER `log_founder_activity()` only

`founder_inbox_items`:

- SELECT/UPDATE: founder role only (M7.8)

### 4.3 Key RPCs

| RPC | Gate | Purpose |
|-----|------|---------|
| `get_executive_dashboard()` | view_executive | All landing KPIs JSON |
| `get_community_health(days)` | view_community | Community metrics + trends |
| `get_platform_health()` | view_platform | Subsystem status array |
| `get_founder_activity_feed(...)` | view_activity | Paginated + filtered feed |
| `get_user_analytics(days)` | view_analytics | Growth + retention series |
| `get_release_history(limit)` | view_executive | Releases + QA |
| `get_roadmap_board()` | manage_roadmap | Kanban data |
| `evaluate_feature_flag(key)` | authenticated | Client flag resolution |
| `create_staff_invite(...)` | manage_staff | Invite flow |
| `accept_staff_invite(token)` | authenticated | Accept invite |
| `upsert_feature_flag(...)` | manage_flags | Flag CRUD |
| `record_app_release(...)` | manage_releases | Post-deploy (Edge Fn too) |
| `log_founder_activity(...)` | service/triggers | Internal ingest |

---

## 5. Navigation & routes

### 5.1 Settings integration

```text
Settings
├── Founder (founder, admin)
│   └── Founder Dashboard → /founder
├── Operations (moderator)
│   └── Moderation → /founder/moderation
├── Support (support)
│   └── Support Queue → /founder/support
├── Admin (legacy is_admin — migrate to staff)
│   └── … existing links until deprecated
```

### 5.2 Founder shell layout

**Desktop:** Fixed sidebar (240px) + scrollable main + top bar (env badge, refresh, notifications)  
**Mobile:** Bottom nav (Overview, Activity, Menu) + drawer for full nav

### 5.3 Sidebar nav

```text
Overview          /founder
Community Health  /founder/community
Platform Health   /founder/platform
User Analytics    /founder/analytics/users
Live Activity     /founder/activity
Moderation        /founder/moderation
Ambassadors       /founder/ambassadors
Feature Flags     /founder/flags
Releases          /founder/releases
Roadmap           /founder/roadmap
Support           /founder/support
Notifications     /founder/notifications
Inbox             /founder/inbox        (M7.8)
Admin             /founder/admin
```

---

## 6. Widget framework

```typescript
// Conceptual — implemented in M7.1
type FounderWidgetDef = {
  id: string;
  title: string;
  section: 'executive' | 'community' | 'platform' | 'admin';
  colSpan: 1 | 2 | 3 | 4;
  refreshMs: number;
  minStaffCapability: string;
  Component: React.ComponentType<FounderWidgetProps>;
};

// Registry allows plugins:
// FOUNDER_WIDGETS['kpi-total-users'] = { ... }
```

**FounderWidget shell:** dark card, header, skeleton loader, error boundary with retry, "Updated X ago" footer.

---

## 7. Module wireframes

### 7.1 Support Dashboard (`/founder/support`)

- Open feedback items (`beta_feedback`)
- Group by type: bug, feature, general
- SLA indicators (age > 48h highlighted)
- Quick resolve / assign / link to inbox

### 7.2 Reports & Moderation (`/founder/moderation`)

- Merge existing `admin-moderation` into founder shell
- Pending reports count, recent actions, ban list link

### 7.3 Ambassador Management (`/founder/ambassadors`)

- Pending applications queue
- Active ambassadors table (tier, referrals, engagement)
- Top creators cross-link
- Referral funnel chart

### 7.4 Release Management (`/founder/releases`)

- Timeline of `app_releases` by environment
- Diff: commit, bundle, deployment ID
- QA status badges
- Rollback action (founder) → triggers redeploy workflow doc
- Link to roadmap features + CHANGELOG

### 7.5 Notification Center (`/founder/notifications`)

- Staff-specific alerts (not user notifications)
- Unread badge in shell top bar
- Realtime optional for new staff_notifications

---

## 8. Activity feed ingestion

| Event | Trigger / Source |
|-------|------------------|
| User signed up | `profiles` INSERT trigger |
| Message sent | `messages` INSERT trigger (metadata only, no content) |
| Workout posted | `posts` INSERT where workout type |
| Story uploaded | `posts` INSERT story audience |
| Match created | `matches` INSERT |
| Event created/joined | `events` / attendees triggers |
| Challenge joined | `challenge_participants` INSERT |
| Reaction/comment | `post_reactions`, `comments` INSERT (sampled at scale) |
| Notification sent/failed | push dispatch trigger / Edge Fn |
| Deployment | `record_app_release` Edge Fn |
| Crash | Sentry webhook → Edge Fn |
| Health | `probe_health` cron |
| Error | `product_events` where name = 'error' |

---

## 9. Staging environment

| Item | Production | Staging |
|------|------------|---------|
| Vercel project | `frennix` | `frennix-staging` (new) |
| URL | frennix.vercel.app | staging.frennix.vercel.app |
| Supabase | Production project | Branch or separate project |
| Env var | `EXPO_PUBLIC_APP_ENV=production` | `staging` |
| Dashboard badge | Green "Production" | Amber "Staging" |

Deploy staging: `npx vercel --yes --project frennix-staging` from `staging` branch.

---

## 10. Monitoring integration (M7.1)

| Signal | Source | Dashboard surface |
|--------|--------|-------------------|
| Crashes | Sentry (`initSentry` already live) | Platform Health, Inbox, Activity |
| Perf | `product_events` perf events | Platform Health, Executive (load time) |
| Errors | `product_events` + client boundary | Executive "Active Errors" |
| Push delivery | `send-push` Edge Fn metrics | Executive KPI, Community |
| Realtime health | probe subscribes test channel | Platform Health |

---

## 11. Client file structure (M7 implementation)

```text
app/founder/
  _layout.tsx              Staff gate + FounderShell
  index.tsx                Executive Dashboard
  community.tsx
  platform.tsx
  activity.tsx
  analytics/users.tsx
  moderation.tsx
  ambassadors.tsx
  flags.tsx
  releases.tsx
  roadmap.tsx
  support.tsx
  notifications.tsx
  inbox.tsx                M7.8
  admin/index.tsx

components/founder/
  FounderShell.tsx
  FounderSidebar.tsx
  FounderTopBar.tsx
  FounderWidget.tsx
  ExecutiveKpiGrid.tsx
  ActivityFeed.tsx
  ActivityFeedFilters.tsx
  CommunityHealthCharts.tsx
  PlatformHealthGrid.tsx
  widgets/*.tsx

lib/founder/
  useStaffCapability.ts
  useExecutiveDashboard.ts
  useFounderActivityFeed.ts
  useFeatureFlag.ts

packages/api/src/founder/
  dashboard.ts
  staff.ts
  roadmap.ts
  flags.ts
  releases.ts

packages/types/src/founder-dashboard.ts

supabase/migrations/
  20250701000001_founder_ops_foundation.sql
```

---

## 12. Implementation phases & timeline

| Phase | Scope | Est. | Gate |
|-------|-------|------|------|
| **M7.1** | Schema, RLS, staff invites, shell, widget framework, Sentry webhook stub | 2–3 wk | CP1 |
| **M7.2** | Executive Dashboard, activity feed + filters, `log_founder_activity` triggers | 2 wk | CP2 |
| **M7.3** | Community + Platform Health, metrics cron, trending snapshots | 2 wk | CP3 |
| **M7.4** | Roadmap UI, release management, CHANGELOG sync | 1–2 wk | CP4 |
| **M7.5** | Feature flags, staged rollouts, admin announcements | 2 wk | CP5 |
| **M7.6** | Support dashboard, moderation merge, notification center | 1–2 wk | CP6 |
| **M7.7** | User analytics charts, ambassador management (M8 prep) | 2 wk | CP7 |
| **M7.8** | Founder Inbox, daily/weekly summaries, AI insights prep | 2 wk | Ship M7 |

**Total M7:** ~14–18 weeks incremental with review pauses.

---

## 13. v0.8.0 release (separate track)

Messaging Stability (Option A) is **ready** on commit `c2cb3f9`. Release workflow paused until founder explicitly approves commit → tag → push → deploy steps per [RELEASE-WORKFLOW.md](../releases/RELEASE-WORKFLOW.md).

Founder Dashboard implementation does **not** block v0.8.0.

---

## 14. Approval checklist (CP1)

Before M7.1 production code:

- [ ] Module map approved (14 dashboard sections)
- [ ] Executive KPI list approved (17 cards)
- [ ] Community Health metrics approved
- [ ] Invite-based staff roles approved
- [ ] Roadmap + milestone release model approved
- [ ] Feature flag approach approved
- [ ] Founder Inbox scope approved (M7.8)
- [ ] Staging environment plan approved
- [ ] Schema approved
- [ ] Phase M7.1 scope approved

**Reply "Approved — begin M7.1" to start implementation.**
