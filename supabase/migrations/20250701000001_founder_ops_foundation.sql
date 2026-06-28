-- M7.1 Founder Operations foundation: roles, schema, RLS, staff invites.
-- Does not include metric cron, activity triggers, or dashboard RPCs (M7.2+).

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE public.staff_role AS ENUM ('founder', 'admin', 'moderator', 'support');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.roadmap_status AS ENUM (
    'planned', 'in_progress', 'internal_testing', 'beta', 'released', 'deprecated'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.activity_category AS ENUM (
    'user', 'messaging', 'stories', 'posts', 'events', 'challenges', 'matches',
    'notifications', 'deployments', 'errors', 'security', 'growth', 'health',
    'community', 'system'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
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
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.inbox_item_type AS ENUM (
    'crash', 'critical_bug', 'feature_request', 'user_report', 'moderation_alert',
    'support_request', 'tester_feedback', 'verification_request', 'deployment_failure',
    'notification_failure', 'database_warning', 'realtime_issue', 'security_alert',
    'performance_alert', 'milestone', 'ambassador_application', 'partnership_inquiry',
    'daily_summary', 'weekly_summary', 'community_highlight'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.inbox_priority AS ENUM ('low', 'normal', 'high', 'urgent');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Staff memberships & invites
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.staff_memberships (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.staff_role NOT NULL,
  granted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_staff_memberships_role
  ON public.staff_memberships(role) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS public.staff_invites (
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

CREATE INDEX IF NOT EXISTS idx_staff_invites_email ON public.staff_invites(lower(email));

-- Backfill existing admins into staff_memberships
INSERT INTO public.staff_memberships (user_id, role, granted_at)
SELECT id, 'admin'::public.staff_role, now()
FROM public.profiles
WHERE is_admin = true
ON CONFLICT (user_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Feature flags (before roadmap FK)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.feature_flags (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  milestone_code TEXT,
  enabled_globally BOOLEAN NOT NULL DEFAULT false,
  default_value JSONB NOT NULL DEFAULT 'false'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.feature_flag_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key TEXT NOT NULL REFERENCES public.feature_flags(key) ON DELETE CASCADE,
  target_type TEXT NOT NULL
    CHECK (target_type IN ('user', 'cohort', 'percentage', 'staff', 'beta_testers')),
  target_value TEXT NOT NULL,
  enabled BOOLEAN NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.feature_flags (key, name, description, milestone_code, enabled_globally)
VALUES (
  'founder_dashboard',
  'Founder Dashboard',
  'Staff operations dashboard (M7)',
  'M7',
  false
)
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Releases & roadmap
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.app_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL,
  milestone_code TEXT,
  git_tag TEXT,
  git_commit TEXT NOT NULL,
  bundle_hash TEXT,
  deployment_id TEXT,
  deployment_url TEXT NOT NULL DEFAULT 'https://frennix.vercel.app',
  environment TEXT NOT NULL DEFAULT 'production'
    CHECK (environment IN ('development', 'staging', 'production')),
  status TEXT NOT NULL DEFAULT 'production'
    CHECK (status IN ('draft', 'staging', 'production', 'rolled_back')),
  qa_status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (qa_status IN (
      'not_started', 'automated_pass', 'manual_pass', 'partial', 'failed', 'signed_off'
    )),
  release_notes TEXT,
  features_added TEXT[],
  bugs_fixed TEXT[],
  known_issues TEXT[],
  rollback_commit TEXT,
  deployed_at TIMESTAMPTZ,
  deployed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_releases_deployed ON public.app_releases(deployed_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_releases_env ON public.app_releases(environment, deployed_at DESC);

CREATE TABLE IF NOT EXISTS public.roadmap_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  milestone_code TEXT NOT NULL,
  status public.roadmap_status NOT NULL DEFAULT 'planned',
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  owner_staff_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  feature_flag_key TEXT REFERENCES public.feature_flags(key) ON DELETE SET NULL,
  target_release_version TEXT,
  released_version TEXT,
  deprecated_at TIMESTAMPTZ,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.roadmap_feature_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id UUID NOT NULL REFERENCES public.roadmap_features(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  due_date DATE,
  completed_at TIMESTAMPTZ,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.roadmap_feature_releases (
  feature_id UUID NOT NULL REFERENCES public.roadmap_features(id) ON DELETE CASCADE,
  release_id UUID NOT NULL REFERENCES public.app_releases(id) ON DELETE CASCADE,
  PRIMARY KEY (feature_id, release_id)
);

CREATE TABLE IF NOT EXISTS public.staged_rollouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key TEXT NOT NULL REFERENCES public.feature_flags(key) ON DELETE CASCADE,
  release_id UUID REFERENCES public.app_releases(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  percentage INT NOT NULL CHECK (percentage BETWEEN 0 AND 100),
  cohort_filter JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'active', 'paused', 'completed', 'cancelled')),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Activity, metrics, health
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.founder_activity_events (
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
    CHECK (severity IN ('info', 'success', 'warning', 'error', 'critical')),
  environment TEXT NOT NULL DEFAULT 'production',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fae_created ON public.founder_activity_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fae_category_created
  ON public.founder_activity_events(category, created_at DESC);

CREATE TABLE IF NOT EXISTS public.founder_metrics_daily (
  date DATE NOT NULL,
  environment TEXT NOT NULL DEFAULT 'production',
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
  PRIMARY KEY (date, environment)
);

CREATE TABLE IF NOT EXISTS public.founder_trending_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_type TEXT NOT NULL
    CHECK (snapshot_type IN (
      'top_creators', 'trending_posts', 'trending_exercises',
      'trending_gyms', 'trending_cities', 'top_ambassadors'
    )),
  payload JSONB NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.system_health_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subsystem TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'production',
  status TEXT NOT NULL CHECK (status IN ('healthy', 'degraded', 'down', 'unknown')),
  latency_ms INT,
  error_rate NUMERIC(8,4),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_health_subsystem ON public.system_health_snapshots(subsystem, recorded_at DESC);

CREATE TABLE IF NOT EXISTS public.deployment_health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id UUID REFERENCES public.app_releases(id) ON DELETE CASCADE,
  check_name TEXT NOT NULL,
  passed BOOLEAN NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Inbox, ambassadors, announcements (schema ready; UI later)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.founder_inbox_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type public.inbox_item_type NOT NULL,
  priority public.inbox_priority NOT NULL DEFAULT 'normal',
  title TEXT NOT NULL,
  body TEXT,
  source_table TEXT,
  source_id UUID,
  activity_event_id UUID REFERENCES public.founder_activity_events(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'assigned', 'resolved', 'archived', 'snoozed')),
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  snoozed_until TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inbox_status_priority
  ON public.founder_inbox_items(status, priority, created_at DESC);

CREATE TABLE IF NOT EXISTS public.ambassadors (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  tier TEXT NOT NULL DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active', 'paused', 'revoked')),
  referral_count INT NOT NULL DEFAULT 0,
  engagement_score NUMERIC(10,2) NOT NULL DEFAULT 0,
  applied_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS public.admin_announcements (
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

CREATE TABLE IF NOT EXISTS public.staff_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  link_path TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_notifications_user
  ON public.staff_notifications(staff_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.founder_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  before_state JSONB,
  after_state JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Staff helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_my_staff_role()
RETURNS public.staff_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sm.role
  FROM public.staff_memberships sm
  WHERE sm.user_id = auth.uid()
    AND sm.revoked_at IS NULL
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.has_staff_role(p_role public.staff_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_memberships sm
    WHERE sm.user_id = auth.uid()
      AND sm.role = p_role
      AND sm.revoked_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.has_staff_capability(p_capability TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.staff_role;
BEGIN
  v_role := public.get_my_staff_role();
  IF v_role IS NULL THEN
    IF p_capability IN (
      'capability_moderate', 'capability_view_executive', 'capability_view_community',
      'capability_view_platform', 'capability_view_analytics', 'capability_view_activity',
      'capability_support', 'capability_manage_releases'
    ) AND public.is_current_user_admin() THEN
      RETURN true;
    END IF;
    RETURN false;
  END IF;

  CASE p_capability
    WHEN 'capability_manage_staff' THEN
      RETURN v_role = 'founder';
    WHEN 'capability_manage_flags' THEN
      RETURN v_role = 'founder';
    WHEN 'capability_manage_roadmap' THEN
      RETURN v_role IN ('founder', 'admin');
    WHEN 'capability_manage_releases' THEN
      RETURN v_role IN ('founder', 'admin');
    WHEN 'capability_manage_ambassadors' THEN
      RETURN v_role IN ('founder', 'admin');
    WHEN 'capability_moderate' THEN
      RETURN v_role IN ('founder', 'admin', 'moderator');
    WHEN 'capability_support' THEN
      RETURN v_role IN ('founder', 'admin', 'support');
    WHEN 'capability_view_executive' THEN
      RETURN v_role IN ('founder', 'admin');
    WHEN 'capability_view_community' THEN
      RETURN v_role IN ('founder', 'admin');
    WHEN 'capability_view_platform' THEN
      RETURN v_role IN ('founder', 'admin');
    WHEN 'capability_view_analytics' THEN
      RETURN v_role IN ('founder', 'admin');
    WHEN 'capability_view_activity' THEN
      RETURN v_role IN ('founder', 'admin');
    WHEN 'capability_view_inbox' THEN
      RETURN v_role = 'founder';
    ELSE
      RETURN false;
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_profile_is_admin_from_staff()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles p
  SET is_admin = EXISTS (
    SELECT 1 FROM public.staff_memberships sm
    WHERE sm.user_id = NEW.user_id
      AND sm.revoked_at IS NULL
      AND sm.role IN ('founder', 'admin', 'moderator')
  )
  WHERE p.id = NEW.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_is_admin_on_staff ON public.staff_memberships;
CREATE TRIGGER trg_sync_is_admin_on_staff
  AFTER INSERT OR UPDATE ON public.staff_memberships
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_is_admin_from_staff();

-- ---------------------------------------------------------------------------
-- Staff invite RPCs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_staff_invite(
  p_email TEXT,
  p_role public.staff_role,
  p_token_hash TEXT,
  p_expires_at TIMESTAMPTZ DEFAULT now() + interval '7 days'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF NOT public.has_staff_capability('capability_manage_staff') THEN
    RAISE EXCEPTION 'Founder access required';
  END IF;

  INSERT INTO public.staff_invites (email, role, token_hash, invited_by, expires_at)
  VALUES (lower(trim(p_email)), p_role, p_token_hash, auth.uid(), p_expires_at)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_staff_invite(p_token_hash TEXT)
RETURNS public.staff_role
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.staff_invites%ROWTYPE;
  v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_invite
  FROM public.staff_invites
  WHERE token_hash = p_token_hash
    AND accepted_at IS NULL
    AND expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invite';
  END IF;

  INSERT INTO public.staff_memberships (user_id, role, granted_by)
  VALUES (v_user, v_invite.role, v_invite.invited_by)
  ON CONFLICT (user_id) DO UPDATE
    SET role = EXCLUDED.role,
        granted_by = EXCLUDED.granted_by,
        granted_at = now(),
        revoked_at = NULL;

  UPDATE public.staff_invites
  SET accepted_at = now(), accepted_by = v_user
  WHERE id = v_invite.id;

  RETURN v_invite.role;
END;
$$;

-- Internal activity logger (triggers / edge functions in M7.2)
CREATE OR REPLACE FUNCTION public.log_founder_activity(
  p_kind public.activity_kind,
  p_category public.activity_category,
  p_title TEXT,
  p_summary TEXT DEFAULT NULL,
  p_actor_user_id UUID DEFAULT NULL,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_severity TEXT DEFAULT 'info',
  p_environment TEXT DEFAULT 'production'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.founder_activity_events (
    kind, category, title, summary, actor_user_id,
    entity_type, entity_id, metadata, severity, environment
  )
  VALUES (
    p_kind, p_category, p_title, p_summary, p_actor_user_id,
    p_entity_type, p_entity_id, COALESCE(p_metadata, '{}'::jsonb), p_severity, p_environment
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_staff_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_staff_role(public.staff_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_staff_capability(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_staff_invite(TEXT, public.staff_role, TEXT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_staff_invite(TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.staff_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flag_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roadmap_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roadmap_feature_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roadmap_feature_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staged_rollouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.founder_activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.founder_metrics_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.founder_trending_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_health_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deployment_health_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.founder_inbox_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambassadors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.founder_audit_log ENABLE ROW LEVEL SECURITY;

-- staff_memberships
DROP POLICY IF EXISTS "Staff read own membership" ON public.staff_memberships;
CREATE POLICY "Staff read own membership" ON public.staff_memberships
  FOR SELECT USING (user_id = auth.uid() OR public.has_staff_capability('capability_manage_staff'));

DROP POLICY IF EXISTS "Founder manage staff" ON public.staff_memberships;
CREATE POLICY "Founder manage staff" ON public.staff_memberships
  FOR ALL USING (public.has_staff_capability('capability_manage_staff'))
  WITH CHECK (public.has_staff_capability('capability_manage_staff'));

-- staff_invites
DROP POLICY IF EXISTS "Founder manage invites" ON public.staff_invites;
CREATE POLICY "Founder manage invites" ON public.staff_invites
  FOR ALL USING (public.has_staff_capability('capability_manage_staff'))
  WITH CHECK (public.has_staff_capability('capability_manage_staff'));

-- feature_flags
DROP POLICY IF EXISTS "Staff read flags" ON public.feature_flags;
CREATE POLICY "Staff read flags" ON public.feature_flags
  FOR SELECT USING (public.has_staff_capability('capability_manage_flags') OR public.get_my_staff_role() IS NOT NULL);

DROP POLICY IF EXISTS "Founder write flags" ON public.feature_flags;
CREATE POLICY "Founder write flags" ON public.feature_flags
  FOR ALL USING (public.has_staff_capability('capability_manage_flags'))
  WITH CHECK (public.has_staff_capability('capability_manage_flags'));

-- app_releases
DROP POLICY IF EXISTS "Staff read releases" ON public.app_releases;
CREATE POLICY "Staff read releases" ON public.app_releases
  FOR SELECT USING (public.has_staff_capability('capability_view_executive'));

DROP POLICY IF EXISTS "Staff write releases" ON public.app_releases;
CREATE POLICY "Staff write releases" ON public.app_releases
  FOR INSERT WITH CHECK (public.has_staff_capability('capability_manage_releases'));

DROP POLICY IF EXISTS "Staff update releases" ON public.app_releases;
CREATE POLICY "Staff update releases" ON public.app_releases
  FOR UPDATE USING (public.has_staff_capability('capability_manage_releases'));

-- roadmap
DROP POLICY IF EXISTS "Staff read roadmap" ON public.roadmap_features;
CREATE POLICY "Staff read roadmap" ON public.roadmap_features
  FOR SELECT USING (public.has_staff_capability('capability_manage_roadmap'));

DROP POLICY IF EXISTS "Staff write roadmap" ON public.roadmap_features;
CREATE POLICY "Staff write roadmap" ON public.roadmap_features
  FOR ALL USING (public.has_staff_capability('capability_manage_roadmap'))
  WITH CHECK (public.has_staff_capability('capability_manage_roadmap'));

-- activity (read-only for staff; writes via SECURITY DEFINER)
DROP POLICY IF EXISTS "Staff read activity" ON public.founder_activity_events;
CREATE POLICY "Staff read activity" ON public.founder_activity_events
  FOR SELECT USING (public.has_staff_capability('capability_view_activity'));

-- metrics & health
DROP POLICY IF EXISTS "Staff read metrics" ON public.founder_metrics_daily;
CREATE POLICY "Staff read metrics" ON public.founder_metrics_daily
  FOR SELECT USING (public.has_staff_capability('capability_view_executive'));

DROP POLICY IF EXISTS "Staff read health" ON public.system_health_snapshots;
CREATE POLICY "Staff read health" ON public.system_health_snapshots
  FOR SELECT USING (public.has_staff_capability('capability_view_platform'));

-- inbox (founder only)
DROP POLICY IF EXISTS "Founder inbox" ON public.founder_inbox_items;
CREATE POLICY "Founder inbox" ON public.founder_inbox_items
  FOR ALL USING (public.has_staff_capability('capability_view_inbox'))
  WITH CHECK (public.has_staff_capability('capability_view_inbox'));

-- staff notifications (own rows)
DROP POLICY IF EXISTS "Staff read own notifications" ON public.staff_notifications;
CREATE POLICY "Staff read own notifications" ON public.staff_notifications
  FOR SELECT USING (staff_user_id = auth.uid());

DROP POLICY IF EXISTS "Staff update own notifications" ON public.staff_notifications;
CREATE POLICY "Staff update own notifications" ON public.staff_notifications
  FOR UPDATE USING (staff_user_id = auth.uid());

-- audit log read
DROP POLICY IF EXISTS "Staff read audit" ON public.founder_audit_log;
CREATE POLICY "Staff read audit" ON public.founder_audit_log
  FOR SELECT USING (public.has_staff_capability('capability_manage_staff'));

-- Realtime for activity feed (M7.2)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.founder_activity_events;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;
