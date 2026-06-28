-- M7.3: Secure staff onboarding, expanded roles, audit trail,
-- Community Health + Platform Health dashboards.
-- Depends on: 20250703000001_founder_m73_staff_role_enum_expand.sql

-- ---------------------------------------------------------------------------
-- Role → capability matrix (scalable permission model)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.staff_role_capabilities (
  role public.staff_role NOT NULL,
  capability TEXT NOT NULL,
  PRIMARY KEY (role, capability)
);

INSERT INTO public.staff_role_capabilities (role, capability)
VALUES
  -- Owner: full access
  ('owner', 'capability_access_dashboard'),
  ('owner', 'capability_manage_staff'),
  ('owner', 'capability_manage_flags'),
  ('owner', 'capability_manage_roadmap'),
  ('owner', 'capability_manage_releases'),
  ('owner', 'capability_manage_ambassadors'),
  ('owner', 'capability_moderate'),
  ('owner', 'capability_support'),
  ('owner', 'capability_view_executive'),
  ('owner', 'capability_view_community'),
  ('owner', 'capability_view_platform'),
  ('owner', 'capability_view_analytics'),
  ('owner', 'capability_view_activity'),
  ('owner', 'capability_view_inbox'),
  ('owner', 'capability_view_audit'),
  ('owner', 'capability_assign_owner'),
  -- Founder
  ('founder', 'capability_access_dashboard'),
  ('founder', 'capability_manage_staff'),
  ('founder', 'capability_manage_flags'),
  ('founder', 'capability_manage_roadmap'),
  ('founder', 'capability_manage_releases'),
  ('founder', 'capability_manage_ambassadors'),
  ('founder', 'capability_moderate'),
  ('founder', 'capability_support'),
  ('founder', 'capability_view_executive'),
  ('founder', 'capability_view_community'),
  ('founder', 'capability_view_platform'),
  ('founder', 'capability_view_analytics'),
  ('founder', 'capability_view_activity'),
  ('founder', 'capability_view_inbox'),
  ('founder', 'capability_view_audit'),
  -- Admin
  ('admin', 'capability_access_dashboard'),
  ('admin', 'capability_manage_roadmap'),
  ('admin', 'capability_manage_releases'),
  ('admin', 'capability_manage_ambassadors'),
  ('admin', 'capability_moderate'),
  ('admin', 'capability_support'),
  ('admin', 'capability_view_executive'),
  ('admin', 'capability_view_community'),
  ('admin', 'capability_view_platform'),
  ('admin', 'capability_view_analytics'),
  ('admin', 'capability_view_activity'),
  -- Moderator
  ('moderator', 'capability_access_dashboard'),
  ('moderator', 'capability_moderate'),
  ('moderator', 'capability_view_community'),
  ('moderator', 'capability_view_activity'),
  -- Support
  ('support', 'capability_access_dashboard'),
  ('support', 'capability_support'),
  ('support', 'capability_view_community'),
  ('support', 'capability_view_activity'),
  -- Ambassador Manager
  ('ambassador_manager', 'capability_access_dashboard'),
  ('ambassador_manager', 'capability_manage_ambassadors'),
  ('ambassador_manager', 'capability_view_community'),
  ('ambassador_manager', 'capability_view_analytics'),
  ('ambassador_manager', 'capability_view_activity'),
  -- Content Manager
  ('content_manager', 'capability_access_dashboard'),
  ('content_manager', 'capability_moderate'),
  ('content_manager', 'capability_view_community'),
  ('content_manager', 'capability_view_analytics'),
  ('content_manager', 'capability_view_activity'),
  -- Analyst (read-only)
  ('analyst', 'capability_access_dashboard'),
  ('analyst', 'capability_view_executive'),
  ('analyst', 'capability_view_community'),
  ('analyst', 'capability_view_platform'),
  ('analyst', 'capability_view_analytics'),
  ('analyst', 'capability_view_activity')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Platform bootstrap (one-time owner claim — no per-user SQL)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.platform_bootstrap_config (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  bootstrap_token_hash TEXT,
  claimed_at TIMESTAMPTZ,
  claimed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.platform_bootstrap_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.platform_bootstrap_config ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Extra metrics columns
-- ---------------------------------------------------------------------------

ALTER TABLE public.founder_metrics_daily
  ADD COLUMN IF NOT EXISTS events_today INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS matches_today INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ambassador_activity INT NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------------------
-- Audit helper
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.log_founder_audit(
  p_action TEXT,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_before_state JSONB DEFAULT NULL,
  p_after_state JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.founder_audit_log (actor_id, action, entity_type, entity_id, before_state, after_state)
  VALUES (auth.uid(), p_action, p_entity_type, p_entity_id, p_before_state, p_after_state)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Capability check (table-driven + legacy admin fallback)
-- ---------------------------------------------------------------------------

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

  IF v_role IS NOT NULL THEN
    RETURN EXISTS (
      SELECT 1 FROM public.staff_role_capabilities src
      WHERE src.role = v_role AND src.capability = p_capability
    );
  END IF;

  IF public.is_current_user_admin() THEN
    IF p_capability IN (
      'capability_access_dashboard', 'capability_moderate', 'capability_view_executive',
      'capability_view_community', 'capability_view_platform', 'capability_view_analytics',
      'capability_view_activity', 'capability_support', 'capability_manage_releases',
      'capability_manage_roadmap', 'capability_manage_ambassadors'
    ) THEN
      RETURN true;
    END IF;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_access_founder_dashboard()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_staff_capability('capability_access_dashboard');
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
      AND sm.role IN ('owner', 'founder', 'admin', 'moderator')
  )
  WHERE p.id = NEW.user_id;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Bootstrap RPCs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_platform_bootstrap_status()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config public.platform_bootstrap_config%ROWTYPE;
  v_has_owner BOOLEAN;
BEGIN
  SELECT * INTO v_config FROM public.platform_bootstrap_config WHERE id = 1;

  SELECT EXISTS (
    SELECT 1 FROM public.staff_memberships sm
    WHERE sm.revoked_at IS NULL AND sm.role IN ('owner', 'founder')
  ) INTO v_has_owner;

  RETURN jsonb_build_object(
    'bootstrap_configured', v_config.bootstrap_token_hash IS NOT NULL,
    'claimed', v_config.claimed_at IS NOT NULL,
    'has_owner', v_has_owner,
    'needs_bootstrap', NOT v_has_owner AND v_config.claimed_at IS NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_platform_bootstrap(p_token_hash TEXT)
RETURNS public.staff_role
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config public.platform_bootstrap_config%ROWTYPE;
  v_user UUID := auth.uid();
  v_has_owner BOOLEAN;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.staff_memberships sm
    WHERE sm.revoked_at IS NULL AND sm.role IN ('owner', 'founder')
  ) INTO v_has_owner;

  IF v_has_owner THEN
    RAISE EXCEPTION 'Platform already has an owner';
  END IF;

  SELECT * INTO v_config FROM public.platform_bootstrap_config WHERE id = 1 FOR UPDATE;

  IF v_config.claimed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Bootstrap already claimed';
  END IF;

  IF v_config.bootstrap_token_hash IS NULL OR v_config.bootstrap_token_hash <> p_token_hash THEN
    RAISE EXCEPTION 'Invalid bootstrap token';
  END IF;

  INSERT INTO public.staff_memberships (user_id, role, granted_by)
  VALUES (v_user, 'owner', v_user)
  ON CONFLICT (user_id) DO UPDATE
    SET role = 'owner', granted_by = v_user, granted_at = now(), revoked_at = NULL;

  UPDATE public.platform_bootstrap_config
  SET claimed_at = now(), claimed_by = v_user, updated_at = now()
  WHERE id = 1;

  PERFORM public.log_founder_audit(
    'platform_bootstrap_claimed',
    'staff_membership',
    v_user,
    NULL,
    jsonb_build_object('role', 'owner', 'user_id', v_user)
  );

  RETURN 'owner'::public.staff_role;
END;
$$;

-- Service-role only: set bootstrap token hash (Edge Function / one-time infra)
CREATE OR REPLACE FUNCTION public.set_platform_bootstrap_token(p_token_hash TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;

  UPDATE public.platform_bootstrap_config
  SET bootstrap_token_hash = p_token_hash, updated_at = now()
  WHERE id = 1;
END;
$$;

-- ---------------------------------------------------------------------------
-- Staff management RPCs (with audit)
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
    RAISE EXCEPTION 'Staff management access required';
  END IF;

  IF p_role = 'owner' AND NOT public.has_staff_capability('capability_assign_owner') THEN
    RAISE EXCEPTION 'Only owners can invite owner role';
  END IF;

  IF p_role = 'founder' AND NOT public.has_staff_role('owner') THEN
    RAISE EXCEPTION 'Only owners can invite founder role';
  END IF;

  INSERT INTO public.staff_invites (email, role, token_hash, invited_by, expires_at)
  VALUES (lower(trim(p_email)), p_role, p_token_hash, auth.uid(), p_expires_at)
  RETURNING id INTO v_id;

  PERFORM public.log_founder_audit(
    'staff_invite_created',
    'staff_invite',
    v_id,
    NULL,
    jsonb_build_object('email', lower(trim(p_email)), 'role', p_role, 'expires_at', p_expires_at)
  );

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
  v_before JSONB;
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

  SELECT jsonb_build_object('role', sm.role, 'revoked_at', sm.revoked_at)
  INTO v_before
  FROM public.staff_memberships sm
  WHERE sm.user_id = v_user;

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

  PERFORM public.log_founder_audit(
    'staff_invite_accepted',
    'staff_membership',
    v_user,
    v_before,
    jsonb_build_object('role', v_invite.role, 'invite_id', v_invite.id)
  );

  RETURN v_invite.role;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_staff_membership(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before JSONB;
  v_target_role public.staff_role;
BEGIN
  IF NOT public.has_staff_capability('capability_manage_staff') THEN
    RAISE EXCEPTION 'Staff management access required';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot revoke your own membership';
  END IF;

  SELECT sm.role INTO v_target_role
  FROM public.staff_memberships sm
  WHERE sm.user_id = p_user_id AND sm.revoked_at IS NULL;

  IF v_target_role = 'owner' AND NOT public.has_staff_role('owner') THEN
    RAISE EXCEPTION 'Only owners can revoke owner role';
  END IF;

  SELECT jsonb_build_object('role', sm.role, 'granted_at', sm.granted_at)
  INTO v_before
  FROM public.staff_memberships sm
  WHERE sm.user_id = p_user_id AND sm.revoked_at IS NULL;

  UPDATE public.staff_memberships
  SET revoked_at = now()
  WHERE user_id = p_user_id AND revoked_at IS NULL;

  PERFORM public.log_founder_audit(
    'staff_membership_revoked',
    'staff_membership',
    p_user_id,
    v_before,
    jsonb_build_object('revoked_at', now())
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_staff_invite(p_invite_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.staff_invites%ROWTYPE;
BEGIN
  IF NOT public.has_staff_capability('capability_manage_staff') THEN
    RAISE EXCEPTION 'Staff management access required';
  END IF;

  SELECT * INTO v_invite FROM public.staff_invites WHERE id = p_invite_id AND accepted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found or already accepted';
  END IF;

  DELETE FROM public.staff_invites WHERE id = p_invite_id;

  PERFORM public.log_founder_audit(
    'staff_invite_cancelled',
    'staff_invite',
    p_invite_id,
    row_to_json(v_invite)::jsonb,
    NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.list_staff_members(
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 25,
  p_search TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_page INT := GREATEST(COALESCE(p_page, 1), 1);
  v_page_size INT := LEAST(GREATEST(COALESCE(p_page_size, 25), 5), 100);
  v_offset INT := (v_page - 1) * v_page_size;
  v_total INT;
  v_items JSONB;
BEGIN
  IF NOT public.has_staff_capability('capability_manage_staff') THEN
    RAISE EXCEPTION 'Staff management access required';
  END IF;

  SELECT COUNT(*)::INT INTO v_total
  FROM public.staff_memberships sm
  JOIN public.profiles p ON p.id = sm.user_id
  WHERE sm.revoked_at IS NULL
    AND (
      p_search IS NULL OR p_search = ''
      OR p.username ILIKE '%' || p_search || '%'
      OR COALESCE(p.display_name, '') ILIKE '%' || p_search || '%'
    );

  SELECT COALESCE(jsonb_agg(row_to_json(x)::jsonb), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT
      sm.user_id,
      sm.role,
      sm.granted_at,
      sm.granted_by,
      p.username,
      p.display_name,
      p.avatar_url
    FROM public.staff_memberships sm
    JOIN public.profiles p ON p.id = sm.user_id
    WHERE sm.revoked_at IS NULL
      AND (
        p_search IS NULL OR p_search = ''
        OR p.username ILIKE '%' || p_search || '%'
        OR COALESCE(p.display_name, '') ILIKE '%' || p_search || '%'
      )
    ORDER BY sm.granted_at DESC
    LIMIT v_page_size OFFSET v_offset
  ) x;

  RETURN jsonb_build_object(
    'items', v_items,
    'total', v_total,
    'page', v_page,
    'pageSize', v_page_size,
    'hasMore', (v_offset + v_page_size) < v_total
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.list_staff_invites(
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 25
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_page INT := GREATEST(COALESCE(p_page, 1), 1);
  v_page_size INT := LEAST(GREATEST(COALESCE(p_page_size, 25), 5), 100);
  v_offset INT := (v_page - 1) * v_page_size;
  v_total INT;
  v_items JSONB;
BEGIN
  IF NOT public.has_staff_capability('capability_manage_staff') THEN
    RAISE EXCEPTION 'Staff management access required';
  END IF;

  SELECT COUNT(*)::INT INTO v_total
  FROM public.staff_invites si
  WHERE si.accepted_at IS NULL AND si.expires_at > now();

  SELECT COALESCE(jsonb_agg(row_to_json(x)::jsonb), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT si.id, si.email, si.role, si.expires_at, si.created_at, si.invited_by
    FROM public.staff_invites si
    WHERE si.accepted_at IS NULL AND si.expires_at > now()
    ORDER BY si.created_at DESC
    LIMIT v_page_size OFFSET v_offset
  ) x;

  RETURN jsonb_build_object(
    'items', v_items,
    'total', v_total,
    'page', v_page,
    'pageSize', v_page_size,
    'hasMore', (v_offset + v_page_size) < v_total
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_founder_audit_log(
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 25,
  p_search TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_page INT := GREATEST(COALESCE(p_page, 1), 1);
  v_page_size INT := LEAST(GREATEST(COALESCE(p_page_size, 25), 5), 100);
  v_offset INT := (v_page - 1) * v_page_size;
  v_total INT;
  v_items JSONB;
BEGIN
  IF NOT public.has_staff_capability('capability_view_audit') THEN
    RAISE EXCEPTION 'Audit log access required';
  END IF;

  SELECT COUNT(*)::INT INTO v_total
  FROM public.founder_audit_log al
  WHERE p_search IS NULL OR p_search = ''
    OR al.action ILIKE '%' || p_search || '%'
    OR COALESCE(al.entity_type, '') ILIKE '%' || p_search || '%';

  SELECT COALESCE(jsonb_agg(row_to_json(x)::jsonb), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT al.id, al.actor_id, al.action, al.entity_type, al.entity_id,
           al.before_state, al.after_state, al.created_at,
           p.username AS actor_username, p.display_name AS actor_display_name
    FROM public.founder_audit_log al
    LEFT JOIN public.profiles p ON p.id = al.actor_id
    WHERE p_search IS NULL OR p_search = ''
      OR al.action ILIKE '%' || p_search || '%'
      OR COALESCE(al.entity_type, '') ILIKE '%' || p_search || '%'
    ORDER BY al.created_at DESC
    LIMIT v_page_size OFFSET v_offset
  ) x;

  RETURN jsonb_build_object(
    'items', v_items,
    'total', v_total,
    'page', v_page,
    'pageSize', v_page_size,
    'hasMore', (v_offset + v_page_size) < v_total
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Metrics refresh (callable by cron or on-demand)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.refresh_founder_metrics_daily(
  p_date DATE DEFAULT CURRENT_DATE,
  p_environment TEXT DEFAULT 'production'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_week_start TIMESTAMPTZ := date_trunc('week', p_date::timestamptz);
  v_month_start TIMESTAMPTZ := date_trunc('month', p_date::timestamptz);
  v_cohort_d1 DATE := p_date - 1;
  v_cohort_d7 DATE := p_date - 7;
  v_cohort_d30 DATE := p_date - 30;
  v_ret_d1 NUMERIC;
  v_ret_d7 NUMERIC;
  v_ret_d30 NUMERIC;
BEGIN
  SELECT CASE WHEN COUNT(*) > 0 THEN
    ROUND(100.0 * COUNT(DISTINCT pe.user_id) / COUNT(DISTINCT p.id), 2)
  ELSE 0 END INTO v_ret_d1
  FROM public.profiles p
  LEFT JOIN public.product_events pe ON pe.user_id = p.id
    AND pe.event_name = 'daily_active_user'
    AND pe.created_at::date = p.created_at::date + 1
  WHERE p.created_at::date = v_cohort_d1;

  SELECT CASE WHEN COUNT(*) > 0 THEN
    ROUND(100.0 * COUNT(DISTINCT pe.user_id) / COUNT(DISTINCT p.id), 2)
  ELSE 0 END INTO v_ret_d7
  FROM public.profiles p
  LEFT JOIN public.product_events pe ON pe.user_id = p.id
    AND pe.event_name = 'daily_active_user'
    AND pe.created_at::date BETWEEN p.created_at::date + 1 AND p.created_at::date + 7
  WHERE p.created_at::date = v_cohort_d7;

  SELECT CASE WHEN COUNT(*) > 0 THEN
    ROUND(100.0 * COUNT(DISTINCT pe.user_id) / COUNT(DISTINCT p.id), 2)
  ELSE 0 END INTO v_ret_d30
  FROM public.profiles p
  LEFT JOIN public.product_events pe ON pe.user_id = p.id
    AND pe.event_name = 'daily_active_user'
    AND pe.created_at::date BETWEEN p.created_at::date + 1 AND p.created_at::date + 30
  WHERE p.created_at::date = v_cohort_d30;

  INSERT INTO public.founder_metrics_daily (
    date, environment, total_users, users_online, new_signups,
    dau, wau, mau, returning_users,
    messages_today, workout_posts_today, stories_today,
    new_matches, active_challenges, events_this_week,
    posts_per_day, comments_per_day, reactions_per_day,
    referral_growth, retention_d1, retention_d7, retention_d30,
    events_today, matches_today, ambassador_activity, computed_at
  )
  VALUES (
    p_date,
    p_environment,
    (SELECT COUNT(*)::INT FROM public.profiles),
    (SELECT COUNT(*)::INT FROM public.profiles WHERE is_online = true AND last_seen_at >= now() - interval '3 minutes'),
    (SELECT COUNT(*)::INT FROM public.profiles WHERE created_at::date = p_date),
    (SELECT COUNT(DISTINCT user_id)::INT FROM public.product_events WHERE event_name = 'daily_active_user' AND created_at::date = p_date),
    (SELECT COUNT(DISTINCT user_id)::INT FROM public.product_events WHERE event_name = 'daily_active_user' AND created_at >= v_week_start),
    (SELECT COUNT(DISTINCT user_id)::INT FROM public.product_events WHERE event_name = 'daily_active_user' AND created_at >= v_month_start),
    (SELECT COUNT(DISTINCT user_id)::INT FROM public.product_events WHERE event_name = 'daily_active_user' AND created_at::date = p_date AND user_id IN (
      SELECT id FROM public.profiles WHERE created_at::date < p_date
    )),
    (SELECT COUNT(*)::INT FROM public.messages WHERE created_at::date = p_date),
    (SELECT COUNT(*)::INT FROM public.posts WHERE created_at::date = p_date AND post_type IN ('workout_update', 'photo', 'video')),
    (SELECT COUNT(*)::INT FROM public.posts WHERE created_at::date = p_date AND post_type = 'workout_update'),
    (SELECT COUNT(*)::INT FROM public.matches WHERE status = 'matched' AND created_at::date = p_date),
    (SELECT COUNT(DISTINCT challenge_id)::INT FROM public.challenge_participants WHERE status = 'active'),
    (SELECT COUNT(*)::INT FROM public.events WHERE starts_at >= v_week_start AND starts_at < v_week_start + interval '7 days'),
    (SELECT COUNT(*)::INT FROM public.posts WHERE created_at::date = p_date),
    (SELECT COUNT(*)::INT FROM public.comments WHERE created_at::date = p_date),
    (SELECT COUNT(*)::INT FROM (
      SELECT id FROM public.post_reactions WHERE created_at::date = p_date
      UNION ALL
      SELECT id FROM public.message_reactions WHERE created_at::date = p_date
      UNION ALL
      SELECT id FROM public.story_reactions WHERE created_at::date = p_date
    ) r),
    (SELECT COUNT(*)::INT FROM public.referrals WHERE created_at::date = p_date),
    v_ret_d1, v_ret_d7, v_ret_d30,
    (SELECT COUNT(*)::INT FROM public.events WHERE created_at::date = p_date),
    (SELECT COUNT(*)::INT FROM public.matches WHERE status = 'matched' AND created_at::date = p_date),
    (SELECT COUNT(*)::INT FROM public.founder_activity_events
     WHERE category = 'growth' AND kind = 'ambassador_applied' AND created_at::date = p_date),
    now()
  )
  ON CONFLICT (date, environment) DO UPDATE SET
    total_users = EXCLUDED.total_users,
    users_online = EXCLUDED.users_online,
    new_signups = EXCLUDED.new_signups,
    dau = EXCLUDED.dau,
    wau = EXCLUDED.wau,
    mau = EXCLUDED.mau,
    returning_users = EXCLUDED.returning_users,
    messages_today = EXCLUDED.messages_today,
    workout_posts_today = EXCLUDED.workout_posts_today,
    stories_today = EXCLUDED.stories_today,
    new_matches = EXCLUDED.new_matches,
    active_challenges = EXCLUDED.active_challenges,
    events_this_week = EXCLUDED.events_this_week,
    posts_per_day = EXCLUDED.posts_per_day,
    comments_per_day = EXCLUDED.comments_per_day,
    reactions_per_day = EXCLUDED.reactions_per_day,
    referral_growth = EXCLUDED.referral_growth,
    retention_d1 = EXCLUDED.retention_d1,
    retention_d7 = EXCLUDED.retention_d7,
    retention_d30 = EXCLUDED.retention_d30,
    events_today = EXCLUDED.events_today,
    matches_today = EXCLUDED.matches_today,
    ambassador_activity = EXCLUDED.ambassador_activity,
    computed_at = now();
END;
$$;

-- ---------------------------------------------------------------------------
-- System health probes (basic — extensible for Sentry/Vercel webhooks)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.refresh_system_health_snapshots(
  p_environment TEXT DEFAULT 'production'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start TIMESTAMPTZ;
  v_latency INT;
  v_errors_15m INT;
  v_crashes_24h INT;
  v_messages_5m INT;
  v_push_sent INT;
  v_push_rate NUMERIC;
BEGIN
  v_start := clock_timestamp();
  PERFORM COUNT(*)::INT FROM public.profiles;
  v_latency := EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start)::INT;

  SELECT COUNT(*)::INT INTO v_errors_15m
  FROM public.product_events
  WHERE event_name = 'error' AND created_at >= now() - interval '15 minutes';

  SELECT COUNT(*)::INT INTO v_crashes_24h
  FROM public.founder_activity_events
  WHERE kind = 'crash_reported' AND created_at >= now() - interval '24 hours';

  SELECT COUNT(*)::INT INTO v_messages_5m
  FROM public.messages WHERE created_at >= now() - interval '5 minutes';

  SELECT COUNT(*)::INT INTO v_push_sent
  FROM public.notifications
  WHERE created_at >= now() - interval '24 hours';

  v_push_rate := NULL;

  INSERT INTO public.system_health_snapshots (subsystem, environment, status, latency_ms, error_rate, details)
  VALUES
    ('database', p_environment,
      CASE WHEN v_latency < 500 THEN 'healthy' WHEN v_latency < 2000 THEN 'degraded' ELSE 'down' END,
      v_latency, NULL, jsonb_build_object('probe', 'count_profiles')),
    ('supabase', p_environment, 'healthy', v_latency, NULL, jsonb_build_object('api', 'connected')),
    ('app_errors', p_environment,
      CASE WHEN v_errors_15m = 0 THEN 'healthy' WHEN v_errors_15m < 10 THEN 'degraded' ELSE 'down' END,
      NULL, v_errors_15m, jsonb_build_object('window_minutes', 15)),
    ('crashes', p_environment,
      CASE WHEN v_crashes_24h = 0 THEN 'healthy' WHEN v_crashes_24h < 5 THEN 'degraded' ELSE 'down' END,
      NULL, v_crashes_24h, jsonb_build_object('window_hours', 24, 'placeholder', true)),
    ('api_latency', p_environment,
      CASE WHEN v_latency < 200 THEN 'healthy' WHEN v_latency < 1000 THEN 'degraded' ELSE 'down' END,
      v_latency, NULL, jsonb_build_object('placeholder', true)),
    ('realtime_messaging', p_environment,
      CASE WHEN v_messages_5m > 0 OR v_latency < 1000 THEN 'healthy' ELSE 'unknown' END,
      NULL, NULL, jsonb_build_object('messages_5m', v_messages_5m)),
    ('storage', p_environment, 'unknown', NULL, NULL, jsonb_build_object('placeholder', true)),
    ('notifications', p_environment, 'unknown', NULL, NULL,
      jsonb_build_object('delivery_rate', v_push_rate, 'notifications_24h', v_push_sent, 'placeholder', true)),
    ('deployment', p_environment, 'healthy', NULL, NULL,
      (SELECT jsonb_build_object(
        'version', ar.version,
        'commit', ar.git_commit,
        'deployed_at', ar.deployed_at,
        'status', ar.status
      )
      FROM public.app_releases ar
      WHERE ar.environment = p_environment AND ar.status = 'production'
      ORDER BY ar.deployed_at DESC NULLS LAST LIMIT 1)),
    ('app', p_environment,
      CASE WHEN v_errors_15m = 0 THEN 'healthy' WHEN v_errors_15m < 10 THEN 'degraded' ELSE 'down' END,
      NULL, v_errors_15m, jsonb_build_object('errors_15m', v_errors_15m));
END;
$$;

-- ---------------------------------------------------------------------------
-- Community Health dashboard RPC
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_community_health(
  p_days INT DEFAULT 30,
  p_environment TEXT DEFAULT 'production'
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days INT := LEAST(GREATEST(COALESCE(p_days, 30), 7), 90);
  v_start DATE := CURRENT_DATE - (v_days - 1);
  v_today DATE := CURRENT_DATE;
  v_summary JSONB;
  v_series JSONB;
  v_live RECORD;
BEGIN
  IF NOT public.has_staff_capability('capability_view_community') THEN
    RAISE EXCEPTION 'Community health access required';
  END IF;

  PERFORM public.refresh_founder_metrics_daily(v_today, p_environment);

  SELECT * INTO v_live FROM public.founder_metrics_daily
  WHERE date = v_today AND environment = p_environment;

  v_summary := jsonb_build_object(
    'dau', COALESCE(v_live.dau, 0),
    'wau', COALESCE(v_live.wau, 0),
    'mau', COALESCE(v_live.mau, 0),
    'new_signups', COALESCE(v_live.new_signups, 0),
    'retention_d1', v_live.retention_d1,
    'retention_d7', v_live.retention_d7,
    'retention_d30', v_live.retention_d30,
    'workout_posts', COALESCE(v_live.workout_posts_today, 0),
    'stories', COALESCE(v_live.stories_today, 0),
    'messages', COALESCE(v_live.messages_today, 0),
    'events', COALESCE(v_live.events_today, 0),
    'challenges', COALESCE(v_live.active_challenges, 0),
    'matches', COALESCE(v_live.matches_today, 0),
    'comments', COALESCE(v_live.comments_per_day, 0),
    'reactions', COALESCE(v_live.reactions_per_day, 0),
    'referral_growth', COALESCE(v_live.referral_growth, 0),
    'ambassador_activity', COALESCE(v_live.ambassador_activity, 0)
  );

  SELECT COALESCE(jsonb_agg(row_to_json(m)::jsonb ORDER BY m.date), '[]'::jsonb)
  INTO v_series
  FROM (
    SELECT date, dau, wau, mau, new_signups, messages_today AS messages,
           workout_posts_today AS workout_posts, stories_today AS stories,
           events_today AS events, matches_today AS matches,
           comments_per_day AS comments, reactions_per_day AS reactions,
           referral_growth, ambassador_activity,
           retention_d1, retention_d7, retention_d30
    FROM public.founder_metrics_daily
    WHERE environment = p_environment AND date >= v_start AND date <= v_today
    ORDER BY date
  ) m;

  RETURN jsonb_build_object(
    'environment', p_environment,
    'period_days', v_days,
    'computed_at', now(),
    'summary', v_summary,
    'series', v_series
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Platform Health dashboard RPC
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_platform_health(
  p_environment TEXT DEFAULT 'production'
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subsystems JSONB;
  v_overall TEXT := 'healthy';
  v_worst INT := 0;
  v_status_rank INT;
  r RECORD;
BEGIN
  IF NOT public.has_staff_capability('capability_view_platform') THEN
    RAISE EXCEPTION 'Platform health access required';
  END IF;

  PERFORM public.refresh_system_health_snapshots(p_environment);

  SELECT COALESCE(jsonb_agg(row_to_json(latest)::jsonb ORDER BY latest.sort_order), '[]'::jsonb)
  INTO v_subsystems
  FROM (
    SELECT DISTINCT ON (sh.subsystem)
      sh.subsystem AS key,
      CASE sh.subsystem
        WHEN 'app_errors' THEN 'App Errors'
        WHEN 'crashes' THEN 'Crash Reports'
        WHEN 'api_latency' THEN 'API Latency'
        WHEN 'supabase' THEN 'Supabase Health'
        WHEN 'realtime_messaging' THEN 'Realtime Messaging'
        WHEN 'database' THEN 'Database Health'
        WHEN 'storage' THEN 'Storage Usage'
        WHEN 'notifications' THEN 'Notification Delivery'
        WHEN 'deployment' THEN 'Deployment Status'
        WHEN 'app' THEN 'App Health'
        ELSE initcap(replace(sh.subsystem, '_', ' '))
      END AS label,
      sh.status,
      sh.latency_ms,
      sh.error_rate,
      sh.details,
      COALESCE((sh.details->>'placeholder')::boolean, false) AS placeholder,
      sh.recorded_at,
      CASE sh.subsystem
        WHEN 'app_errors' THEN 1 WHEN 'crashes' THEN 2 WHEN 'api_latency' THEN 3
        WHEN 'supabase' THEN 4 WHEN 'realtime_messaging' THEN 5 WHEN 'database' THEN 6
        WHEN 'storage' THEN 7 WHEN 'notifications' THEN 8 WHEN 'deployment' THEN 9
        ELSE 10
      END AS sort_order
    FROM public.system_health_snapshots sh
    WHERE sh.environment = p_environment
    ORDER BY sh.subsystem, sh.recorded_at DESC
  ) latest;

  FOR r IN SELECT * FROM jsonb_to_recordset(v_subsystems) AS x(status TEXT)
  LOOP
    v_status_rank := CASE r.status
      WHEN 'down' THEN 3 WHEN 'degraded' THEN 2 WHEN 'unknown' THEN 1 ELSE 0
    END;
    IF v_status_rank > v_worst THEN v_worst := v_status_rank; END IF;
  END LOOP;

  v_overall := CASE v_worst
    WHEN 3 THEN 'down' WHEN 2 THEN 'degraded' WHEN 1 THEN 'unknown' ELSE 'healthy'
  END;

  RETURN jsonb_build_object(
    'environment', p_environment,
    'computed_at', now(),
    'overall_status', v_overall,
    'subsystems', v_subsystems
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- RLS updates
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Staff read audit" ON public.founder_audit_log;
CREATE POLICY "Staff read audit" ON public.founder_audit_log
  FOR SELECT USING (public.has_staff_capability('capability_view_audit'));

DROP POLICY IF EXISTS "Staff read metrics" ON public.founder_metrics_daily;
CREATE POLICY "Staff read metrics" ON public.founder_metrics_daily
  FOR SELECT USING (
    public.has_staff_capability('capability_view_executive')
    OR public.has_staff_capability('capability_view_community')
  );

DROP POLICY IF EXISTS "Staff read own membership" ON public.staff_memberships;
DROP POLICY IF EXISTS "Founder manage staff" ON public.staff_memberships;
DROP POLICY IF EXISTS "Staff read memberships" ON public.staff_memberships;

CREATE POLICY "Staff read memberships" ON public.staff_memberships
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.has_staff_capability('capability_manage_staff')
  );

CREATE POLICY "Founder manage staff" ON public.staff_memberships
  FOR ALL USING (public.has_staff_capability('capability_manage_staff'))
  WITH CHECK (public.has_staff_capability('capability_manage_staff'));

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

GRANT EXECUTE ON FUNCTION public.can_access_founder_dashboard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_platform_bootstrap_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_platform_bootstrap(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_staff_membership(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_staff_invite(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_staff_members(INT, INT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_staff_invites(INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_founder_audit_log(INT, INT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_community_health(INT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_platform_health(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_founder_metrics_daily(DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_system_health_snapshots(TEXT) TO authenticated;
