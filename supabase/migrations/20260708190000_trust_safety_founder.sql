-- Trust & Safety: mutes, graduated enforcement, report extensions, moderation RPCs, content protection.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS warning_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS moderation_notes TEXT;

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS reported_story_id UUID REFERENCES public.stories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reported_message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS details TEXT,
  ADD COLUMN IF NOT EXISTS content_type TEXT;

CREATE INDEX IF NOT EXISTS idx_reports_status_created
  ON public.reports (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reports_reported_user
  ON public.reports (reported_user_id, created_at DESC)
  WHERE reported_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.user_mutes (
  muter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  muted_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mute_posts BOOLEAN NOT NULL DEFAULT true,
  mute_stories BOOLEAN NOT NULL DEFAULT true,
  mute_notifications BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (muter_id, muted_id),
  CHECK (muter_id != muted_id)
);

CREATE INDEX IF NOT EXISTS idx_user_mutes_muter ON public.user_mutes (muter_id);

ALTER TABLE public.user_mutes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Manage own mutes" ON public.user_mutes
  FOR ALL USING (muter_id = auth.uid()) WITH CHECK (muter_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.moderation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL CHECK (action_type IN (
    'warn', 'suspend', 'ban', 'restore', 'remove_content', 'dismiss_report', 'note'
  )),
  reason TEXT,
  notes TEXT,
  report_id UUID REFERENCES public.reports(id) ON DELETE SET NULL,
  duration_hours INT,
  expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_moderation_actions_target
  ON public.moderation_actions (target_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_moderation_actions_created
  ON public.moderation_actions (created_at DESC);

ALTER TABLE public.moderation_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view moderation actions" ON public.moderation_actions
  FOR SELECT USING (public.has_staff_capability('capability_moderate'));

CREATE TABLE IF NOT EXISTS public.automated_moderation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'spam_detected', 'duplicate_post', 'rate_limited', 'report_burst', 'abuse_prevented'
  )),
  content_type TEXT,
  content_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automated_moderation_logs_created
  ON public.automated_moderation_logs (created_at DESC);

ALTER TABLE public.automated_moderation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view automated moderation logs" ON public.automated_moderation_logs
  FOR SELECT USING (public.has_staff_capability('capability_moderate'));

CREATE OR REPLACE FUNCTION public.is_profile_suspended(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT suspended_until > now() FROM public.profiles WHERE id = p_user_id),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.is_user_muted_for(
  p_muter_id UUID,
  p_muted_id UUID,
  p_channel TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_mutes um
    WHERE um.muter_id = p_muter_id
      AND um.muted_id = p_muted_id
      AND (
        (p_channel = 'posts' AND um.mute_posts)
        OR (p_channel = 'stories' AND um.mute_stories)
        OR (p_channel = 'notifications' AND um.mute_notifications)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.submit_user_report(
  p_reason TEXT,
  p_reported_user_id UUID DEFAULT NULL,
  p_reported_post_id UUID DEFAULT NULL,
  p_reported_comment_id UUID DEFAULT NULL,
  p_reported_challenge_id UUID DEFAULT NULL,
  p_reported_event_id UUID DEFAULT NULL,
  p_reported_group_id UUID DEFAULT NULL,
  p_reported_story_id UUID DEFAULT NULL,
  p_reported_message_id UUID DEFAULT NULL,
  p_details TEXT DEFAULT NULL,
  p_content_type TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reporter_id UUID := auth.uid();
  v_report_id UUID;
  v_recent INT;
BEGIN
  IF v_reporter_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT COUNT(*)::INT INTO v_recent
  FROM public.reports
  WHERE reporter_id = v_reporter_id
    AND created_at > now() - interval '24 hours';

  IF v_recent >= 25 THEN
    INSERT INTO public.automated_moderation_logs (user_id, event_type, metadata)
    VALUES (v_reporter_id, 'rate_limited', jsonb_build_object('context', 'report_submit', 'count_24h', v_recent));
    RAISE EXCEPTION 'Report limit reached. Try again later.';
  END IF;

  IF p_reported_user_id IS NOT NULL AND public.users_are_blocked(v_reporter_id, p_reported_user_id) THEN
    RAISE EXCEPTION 'Cannot report this user';
  END IF;

  INSERT INTO public.reports (
    reporter_id, reported_user_id, reported_post_id, reported_comment_id,
    reported_challenge_id, reported_event_id, reported_group_id,
    reported_story_id, reported_message_id, reason, details, content_type, status
  )
  VALUES (
    v_reporter_id, p_reported_user_id, p_reported_post_id, p_reported_comment_id,
    p_reported_challenge_id, p_reported_event_id, p_reported_group_id,
    p_reported_story_id, p_reported_message_id, p_reason,
    NULLIF(btrim(p_details), ''), p_content_type, 'pending'
  )
  RETURNING id INTO v_report_id;

  RETURN v_report_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_automated_moderation(
  p_user_id UUID,
  p_event_type TEXT,
  p_content_type TEXT DEFAULT NULL,
  p_content_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO public.automated_moderation_logs (user_id, event_type, content_type, content_id, metadata)
  VALUES (p_user_id, p_event_type, p_content_type, p_content_id, p_metadata)
  RETURNING id INTO v_id;

  IF p_event_type IN ('spam_detected', 'report_burst') THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.operations_alerts
      WHERE alert_key = 'spam_activity' AND status = 'active'
        AND triggered_at > now() - interval '1 hour'
    ) THEN
      INSERT INTO public.operations_alerts (alert_key, title, message, severity, metadata)
      VALUES (
        'spam_activity',
        'Spam activity detected',
        format('Automated moderation flagged %s event', p_event_type),
        'high',
        jsonb_build_object('event_type', p_event_type, 'user_id', p_user_id)
      );
    END IF;
  END IF;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_post_abuse(p_author_id UUID, p_content TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recent_posts INT;
  v_dup INT;
BEGIN
  SELECT COUNT(*)::INT INTO v_recent_posts
  FROM public.posts
  WHERE author_id = p_author_id AND created_at > now() - interval '5 minutes';

  IF v_recent_posts >= 8 THEN
    PERFORM public.log_automated_moderation(
      p_author_id, 'rate_limited', 'post', NULL,
      jsonb_build_object('posts_5m', v_recent_posts)
    );
    RAISE EXCEPTION 'Posting too quickly. Please slow down.';
  END IF;

  IF p_content IS NOT NULL AND length(btrim(p_content)) > 0 THEN
    SELECT COUNT(*)::INT INTO v_dup
    FROM public.posts
    WHERE author_id = p_author_id
      AND content = p_content
      AND created_at > now() - interval '24 hours';

    IF v_dup >= 2 THEN
      PERFORM public.log_automated_moderation(
        p_author_id, 'duplicate_post', 'post', NULL,
        jsonb_build_object('duplicate_count', v_dup)
      );
      RAISE EXCEPTION 'Duplicate post detected.';
    END IF;
  END IF;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_moderation_action(
  p_target_user_id UUID,
  p_action_type TEXT,
  p_reason TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_report_id UUID DEFAULT NULL,
  p_duration_hours INT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_action_id UUID;
  v_before JSONB;
  v_after JSONB;
  v_expires TIMESTAMPTZ;
BEGIN
  IF NOT public.has_staff_capability('capability_moderate') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT to_jsonb(p.*) INTO v_before
  FROM public.profiles p WHERE p.id = p_target_user_id;

  v_expires := CASE
    WHEN p_duration_hours IS NOT NULL THEN now() + (p_duration_hours || ' hours')::interval
    ELSE NULL
  END;

  IF p_action_type = 'warn' THEN
    UPDATE public.profiles
    SET warning_count = warning_count + 1,
        moderation_notes = COALESCE(p_notes, moderation_notes)
    WHERE id = p_target_user_id;
  ELSIF p_action_type = 'suspend' THEN
    UPDATE public.profiles
    SET suspended_until = COALESCE(v_expires, now() + interval '72 hours'),
        visibility = 'private',
        moderation_notes = COALESCE(p_notes, moderation_notes)
    WHERE id = p_target_user_id;
  ELSIF p_action_type = 'ban' THEN
    UPDATE public.profiles
    SET is_banned = true, visibility = 'private',
        suspended_until = NULL,
        moderation_notes = COALESCE(p_notes, moderation_notes)
    WHERE id = p_target_user_id;
  ELSIF p_action_type = 'restore' THEN
    UPDATE public.profiles
    SET is_banned = false, suspended_until = NULL, visibility = 'public',
        moderation_notes = COALESCE(p_notes, moderation_notes)
    WHERE id = p_target_user_id;
  ELSIF p_action_type = 'note' THEN
    UPDATE public.profiles
    SET moderation_notes = COALESCE(p_notes, moderation_notes)
    WHERE id = p_target_user_id;
  ELSE
    RAISE EXCEPTION 'Unsupported moderation action: %', p_action_type;
  END IF;

  SELECT to_jsonb(p.*) INTO v_after
  FROM public.profiles p WHERE p.id = p_target_user_id;

  INSERT INTO public.moderation_actions (
    target_user_id, actor_id, action_type, reason, notes, report_id, duration_hours, expires_at
  )
  VALUES (
    p_target_user_id, v_actor_id, p_action_type, p_reason, p_notes, p_report_id,
    p_duration_hours, v_expires
  )
  RETURNING id INTO v_action_id;

  IF p_report_id IS NOT NULL AND p_action_type IN ('warn', 'suspend', 'ban', 'restore') THEN
    UPDATE public.reports
    SET status = 'action_taken',
        reviewed_at = now(),
        reviewed_by = v_actor_id,
        admin_notes = COALESCE(p_notes, admin_notes)
    WHERE id = p_report_id;
  END IF;

  PERFORM public.log_founder_audit(
    'moderation_' || p_action_type,
    'profile',
    p_target_user_id,
    v_before,
    v_after
  );

  RETURN jsonb_build_object('action_id', v_action_id, 'target_user_id', p_target_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_moderation_reports_page(
  p_status TEXT DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_content_type TEXT DEFAULT NULL,
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
  v_offset INT;
  v_items JSONB;
  v_total INT;
BEGIN
  IF NOT public.has_staff_capability('capability_moderate') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_offset := GREATEST(0, (GREATEST(p_page, 1) - 1) * LEAST(GREATEST(p_page_size, 1), 100));

  SELECT COUNT(*)::INT INTO v_total
  FROM public.reports r
  LEFT JOIN public.profiles rp ON rp.id = r.reporter_id
  LEFT JOIN public.profiles ru ON ru.id = r.reported_user_id
  WHERE (p_status IS NULL OR r.status = p_status)
    AND (p_content_type IS NULL OR r.content_type = p_content_type)
    AND (
      p_search IS NULL OR btrim(p_search) = ''
      OR r.reason ILIKE '%' || p_search || '%'
      OR rp.username ILIKE '%' || p_search || '%'
      OR ru.username ILIKE '%' || p_search || '%'
    );

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.created_at DESC), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT
      r.*,
      jsonb_build_object(
        'id', rp.id, 'username', rp.username, 'display_name', rp.display_name, 'avatar_url', rp.avatar_url
      ) AS reporter,
      jsonb_build_object(
        'id', ru.id, 'username', ru.username, 'display_name', ru.display_name, 'avatar_url', ru.avatar_url
      ) AS reported_user
    FROM public.reports r
    LEFT JOIN public.profiles rp ON rp.id = r.reporter_id
    LEFT JOIN public.profiles ru ON ru.id = r.reported_user_id
    WHERE (p_status IS NULL OR r.status = p_status)
      AND (p_content_type IS NULL OR r.content_type = p_content_type)
      AND (
        p_search IS NULL OR btrim(p_search) = ''
        OR r.reason ILIKE '%' || p_search || '%'
        OR rp.username ILIKE '%' || p_search || '%'
        OR ru.username ILIKE '%' || p_search || '%'
      )
    ORDER BY r.created_at DESC
    OFFSET v_offset
    LIMIT LEAST(GREATEST(p_page_size, 1), 100)
  ) t;

  RETURN jsonb_build_object(
    'items', v_items,
    'total', v_total,
    'page', GREATEST(p_page, 1),
    'pageSize', LEAST(GREATEST(p_page_size, 1), 100),
    'hasMore', v_total > v_offset + LEAST(GREATEST(p_page_size, 1), 100)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_moderation_overview()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_staff_capability('capability_moderate') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN jsonb_build_object(
    'pending_reports', (SELECT COUNT(*)::INT FROM public.reports WHERE status = 'pending'),
    'resolved_reports', (SELECT COUNT(*)::INT FROM public.reports WHERE status IN ('reviewed', 'action_taken', 'dismissed')),
    'suspended_users', (SELECT COUNT(*)::INT FROM public.profiles WHERE suspended_until > now()),
    'banned_users', (SELECT COUNT(*)::INT FROM public.profiles WHERE is_banned = true),
    'spam_attempts_24h', (
      SELECT COUNT(*)::INT FROM public.automated_moderation_logs
      WHERE created_at > now() - interval '24 hours'
    ),
    'reports_24h', (SELECT COUNT(*)::INT FROM public.reports WHERE created_at > now() - interval '24 hours'),
    'top_report_reasons', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('reason', reason, 'count', cnt) ORDER BY cnt DESC)
      FROM (
        SELECT reason, COUNT(*)::INT AS cnt
        FROM public.reports
        WHERE created_at > now() - interval '30 days'
        GROUP BY reason
        ORDER BY cnt DESC
        LIMIT 8
      ) s
    ), '[]'::jsonb),
    'recent_actions', COALESCE((
      SELECT jsonb_agg(row_to_json(a) ORDER BY a.created_at DESC)
      FROM (
        SELECT ma.*, p.username AS actor_username, tp.username AS target_username
        FROM public.moderation_actions ma
        LEFT JOIN public.profiles p ON p.id = ma.actor_id
        LEFT JOIN public.profiles tp ON tp.id = ma.target_user_id
        ORDER BY ma.created_at DESC
        LIMIT 10
      ) a
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_moderation_history(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_staff_capability('capability_moderate') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN jsonb_build_object(
    'profile', (
      SELECT row_to_json(p) FROM public.profiles p WHERE p.id = p_user_id
    ),
    'reports_against', COALESCE((
      SELECT jsonb_agg(row_to_json(r) ORDER BY r.created_at DESC)
      FROM (
        SELECT * FROM public.reports
        WHERE reported_user_id = p_user_id
        ORDER BY created_at DESC LIMIT 50
      ) r
    ), '[]'::jsonb),
    'reports_filed', COALESCE((
      SELECT jsonb_agg(row_to_json(r) ORDER BY r.created_at DESC)
      FROM (
        SELECT * FROM public.reports
        WHERE reporter_id = p_user_id
        ORDER BY created_at DESC LIMIT 20
      ) r
    ), '[]'::jsonb),
    'actions', COALESCE((
      SELECT jsonb_agg(row_to_json(a) ORDER BY a.created_at DESC)
      FROM (
        SELECT * FROM public.moderation_actions
        WHERE target_user_id = p_user_id
        ORDER BY created_at DESC LIMIT 50
      ) a
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_growth_dashboard_metrics()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.has_staff_capability('capability_view_executive')
    OR public.has_staff_capability('capability_view_analytics')
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN jsonb_build_object(
    'referral_invites', (SELECT COUNT(*)::INT FROM public.profiles WHERE referral_code IS NOT NULL),
    'referral_conversions', (SELECT COUNT(*)::INT FROM public.referrals),
    'top_challenges', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', c.id, 'title', c.title, 'participants', cnt) ORDER BY cnt DESC)
      FROM (
        SELECT c.id, c.title, COUNT(cp.user_id)::INT AS cnt
        FROM public.challenges c
        JOIN public.challenge_participants cp ON cp.challenge_id = c.id AND cp.status = 'active'
        GROUP BY c.id, c.title
        ORDER BY cnt DESC LIMIT 5
      ) c
    ), '[]'::jsonb),
    'top_events', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', e.id, 'title', e.title, 'attendees', cnt) ORDER BY cnt DESC)
      FROM (
        SELECT e.id, e.title, COUNT(ea.user_id)::INT AS cnt
        FROM public.workout_events e
        JOIN public.event_attendees ea ON ea.event_id = e.id
        GROUP BY e.id, e.title
        ORDER BY cnt DESC LIMIT 5
      ) e
    ), '[]'::jsonb),
    'daily_signups', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('day', day, 'count', cnt) ORDER BY day)
      FROM (
        SELECT date_trunc('day', created_at)::date AS day, COUNT(*)::INT AS cnt
        FROM public.profiles
        WHERE created_at > now() - interval '30 days'
        GROUP BY 1
      ) s
    ), '[]'::jsonb),
    'challenge_completion_rate', (
      SELECT CASE WHEN total > 0 THEN ROUND((completed::NUMERIC / total) * 100, 1) ELSE NULL END
      FROM (
        SELECT
          COUNT(*) FILTER (WHERE cp.status = 'completed')::INT AS completed,
          COUNT(*)::INT AS total
        FROM public.challenge_participants cp
      ) x
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_on_user_report()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.founder_inbox_items (
    kind, title, summary, priority, status, entity_type, entity_id, metadata
  )
  VALUES (
    'user_report',
    'New user report',
    NEW.reason,
    'high',
    'open',
    COALESCE(NEW.content_type, 'report'),
    NEW.id,
    jsonb_build_object(
      'report_id', NEW.id,
      'reported_user_id', NEW.reported_user_id,
      'content_type', NEW.content_type
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_user_report_inbox ON public.reports;
CREATE TRIGGER on_user_report_inbox
  AFTER INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_user_report();

GRANT EXECUTE ON FUNCTION public.submit_user_report TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_moderation_action TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_moderation_reports_page TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_moderation_overview TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_moderation_history TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_growth_dashboard_metrics TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_post_abuse TO authenticated;
