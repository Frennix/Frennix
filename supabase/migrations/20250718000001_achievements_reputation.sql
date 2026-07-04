-- Achievement + Reputation architecture — single activity ledger, no duplicate systems.
-- Achievements read from platform_activity_events + unified workout activity.
-- Reputation scores aggregate in the background (no UI yet).

-- ─── Central activity ledger (achievements + reputation source of truth) ─────

CREATE TABLE IF NOT EXISTS public.platform_activity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'workout_completed',
      'calendar_session_completed',
      'calendar_session_missed',
      'calendar_session_rescheduled',
      'story_commitment_completed',
      'event_attended',
      'event_hosted',
      'challenge_joined',
      'challenge_completed',
      'partner_workout_completed',
      'run_club_participation',
      'group_workout_completed',
      'coaching_session_completed',
      'positive_interaction',
      'helped_beginner',
      'reliability_show_up'
    )
  ),
  source_table TEXT,
  source_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS platform_activity_events_user_type_idx
  ON public.platform_activity_events (user_id, event_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS platform_activity_events_occurred_idx
  ON public.platform_activity_events (occurred_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS platform_activity_events_dedup_idx
  ON public.platform_activity_events (user_id, event_type, source_table, source_id)
  WHERE source_id IS NOT NULL;

-- ─── Achievement catalog ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.achievement_definitions (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '🏅',
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (
    category IN (
      'workout',
      'streak',
      'event',
      'challenge',
      'partner',
      'community',
      'consistency',
      'run_club',
      'coaching'
    )
  ),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_achievements (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  achievement_key TEXT NOT NULL REFERENCES public.achievement_definitions(key) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_event_id UUID REFERENCES public.platform_activity_events(id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, achievement_key)
);

CREATE INDEX IF NOT EXISTS user_achievements_unlocked_idx
  ON public.user_achievements (user_id, unlocked_at DESC);

-- ─── Reputation (recorded now, UI later) ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.reputation_event_weights (
  event_type TEXT PRIMARY KEY,
  consistency_weight INTEGER NOT NULL DEFAULT 0,
  reliability_weight INTEGER NOT NULL DEFAULT 0,
  community_weight INTEGER NOT NULL DEFAULT 0,
  partnership_weight INTEGER NOT NULL DEFAULT 0,
  description TEXT
);

CREATE TABLE IF NOT EXISTS public.user_reputation_scores (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  consistency_score INTEGER NOT NULL DEFAULT 0,
  reliability_score INTEGER NOT NULL DEFAULT 0,
  community_score INTEGER NOT NULL DEFAULT 0,
  partnership_score INTEGER NOT NULL DEFAULT 0,
  total_score INTEGER NOT NULL DEFAULT 0,
  events_recorded_count INTEGER NOT NULL DEFAULT 0,
  last_event_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Seed achievement definitions ────────────────────────────────────────────

INSERT INTO public.achievement_definitions (key, label, emoji, description, category, sort_order)
VALUES
  ('first_workout', 'First workout', '🌟', 'Logged your first workout', 'workout', 10),
  ('workouts_10', '10 workouts', '💪', 'Completed 10 workouts', 'workout', 20),
  ('workouts_25', '25 workouts', '⚡', 'Completed 25 workouts', 'workout', 30),
  ('workouts_100', '100 workouts', '👑', 'Completed 100 workouts', 'workout', 40),
  ('streak_3', '3-day streak', '🔥', '3-day workout streak', 'streak', 50),
  ('streak_7', 'Week warrior', '🔥', '7-day workout streak', 'streak', 60),
  ('streak_30', 'Streak legend', '🔥', '30-day workout streak', 'streak', 70),
  ('first_event', 'First event', '📅', 'Attended your first community event', 'event', 80),
  ('events_5', 'Event regular', '🏅', 'Attended 5 community events', 'event', 90),
  ('events_10', 'Community regular', '🏆', 'Attended 10 community events', 'event', 100),
  ('event_host_3', 'Community leader', '🎤', 'Hosted 3 community events', 'community', 110),
  ('first_challenge', 'Challenge starter', '🎯', 'Joined your first challenge', 'challenge', 120),
  ('challenge_champion', 'Challenge champion', '🏆', 'Completed a challenge', 'challenge', 130),
  ('partner_workouts_5', 'Training duo', '🤝', 'Completed 5 partner workouts', 'partner', 140),
  ('partner_workouts_25', 'Partner pro', '🤝', 'Completed 25 partner workouts', 'partner', 150),
  ('commitment_kept', 'Word kept', '✅', 'Completed a story workout commitment', 'consistency', 160),
  ('consistency_week', 'Consistent week', '📈', 'Completed 4+ workouts in one week', 'consistency', 170),
  ('run_club_first', 'Run club debut', '🏃', 'Joined your first run club session', 'run_club', 180)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.reputation_event_weights (
  event_type, consistency_weight, reliability_weight, community_weight, partnership_weight, description
)
VALUES
  ('workout_completed', 3, 1, 0, 0, 'Logged a workout'),
  ('calendar_session_completed', 4, 3, 0, 1, 'Completed a scheduled session'),
  ('calendar_session_missed', 0, -2, 0, -1, 'Missed a scheduled session'),
  ('calendar_session_rescheduled', 0, 0, 0, 0, 'Rescheduled a session'),
  ('story_commitment_completed', 3, 4, 0, 0, 'Kept a story commitment'),
  ('event_attended', 2, 3, 4, 0, 'Showed up to a community event'),
  ('event_hosted', 1, 2, 6, 0, 'Hosted a community event'),
  ('challenge_joined', 1, 1, 2, 0, 'Joined a challenge'),
  ('challenge_completed', 4, 4, 3, 0, 'Finished a challenge'),
  ('partner_workout_completed', 3, 3, 1, 5, 'Trained with a partner'),
  ('run_club_participation', 2, 3, 4, 2, 'Participated in a run club session'),
  ('group_workout_completed', 2, 2, 3, 2, 'Completed a group workout'),
  ('coaching_session_completed', 3, 4, 2, 3, 'Completed a coaching session'),
  ('positive_interaction', 0, 0, 3, 1, 'Positive community interaction'),
  ('helped_beginner', 1, 2, 5, 2, 'Helped a new member'),
  ('reliability_show_up', 2, 5, 2, 2, 'Showed up as scheduled')
ON CONFLICT (event_type) DO NOTHING;

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.platform_activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievement_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reputation_event_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_reputation_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own activity events"
  ON public.platform_activity_events FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Service records activity events"
  ON public.platform_activity_events FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Anyone reads achievement definitions"
  ON public.achievement_definitions FOR SELECT USING (true);

CREATE POLICY "Users read own achievements"
  ON public.user_achievements FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Anyone reads earned achievements for profiles"
  ON public.user_achievements FOR SELECT
  USING (true);

CREATE POLICY "Users read own reputation"
  ON public.user_reputation_scores FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Anyone reads reputation weights"
  ON public.reputation_event_weights FOR SELECT USING (true);

-- ─── Reputation score refresh (background, no UI) ──────────────────────────

CREATE OR REPLACE FUNCTION public.refresh_user_reputation(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_consistency INTEGER := 0;
  v_reliability INTEGER := 0;
  v_community INTEGER := 0;
  v_partnership INTEGER := 0;
  v_total INTEGER := 0;
  v_count INTEGER := 0;
  v_last TIMESTAMPTZ;
BEGIN
  SELECT
    COALESCE(SUM(w.consistency_weight), 0),
    COALESCE(SUM(w.reliability_weight), 0),
    COALESCE(SUM(w.community_weight), 0),
    COALESCE(SUM(w.partnership_weight), 0),
    COUNT(*),
    MAX(e.occurred_at)
  INTO v_consistency, v_reliability, v_community, v_partnership, v_count, v_last
  FROM public.platform_activity_events e
  LEFT JOIN public.reputation_event_weights w ON w.event_type = e.event_type
  WHERE e.user_id = p_user_id;

  v_total := GREATEST(0, v_consistency) + GREATEST(0, v_reliability)
    + GREATEST(0, v_community) + GREATEST(0, v_partnership);

  INSERT INTO public.user_reputation_scores (
    user_id, consistency_score, reliability_score, community_score,
    partnership_score, total_score, events_recorded_count, last_event_at, updated_at
  )
  VALUES (
    p_user_id, GREATEST(0, v_consistency), GREATEST(0, v_reliability),
    GREATEST(0, v_community), GREATEST(0, v_partnership), v_total, v_count, v_last, NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    consistency_score = EXCLUDED.consistency_score,
    reliability_score = EXCLUDED.reliability_score,
    community_score = EXCLUDED.community_score,
    partnership_score = EXCLUDED.partnership_score,
    total_score = EXCLUDED.total_score,
    events_recorded_count = EXCLUDED.events_recorded_count,
    last_event_at = EXCLUDED.last_event_at,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.on_platform_activity_event_insert()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.refresh_user_reputation(NEW.user_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS platform_activity_reputation_refresh ON public.platform_activity_events;

CREATE TRIGGER platform_activity_reputation_refresh
  AFTER INSERT ON public.platform_activity_events
  FOR EACH ROW EXECUTE FUNCTION public.on_platform_activity_event_insert();

-- ─── Auto-record from source tables (behind the scenes) ──────────────────────

CREATE OR REPLACE FUNCTION public.record_activity_calendar_status()
RETURNS TRIGGER AS $$
DECLARE
  v_event_type TEXT;
  v_partner BOOLEAN;
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'completed' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.training_session_participants p
      WHERE p.calendar_item_id = NEW.id AND p.role = 'partner'
    ) INTO v_partner;

    IF v_partner OR NEW.item_type = 'partner_workout' THEN
      v_event_type := 'partner_workout_completed';
    ELSIF NEW.item_type = 'event' THEN
      v_event_type := 'event_attended';
    ELSIF NEW.item_type = 'challenge' THEN
      v_event_type := 'challenge_completed';
    ELSIF NEW.source_type = 'run_club' THEN
      v_event_type := 'run_club_participation';
    ELSIF NEW.source_type = 'group_workout' THEN
      v_event_type := 'group_workout_completed';
    ELSIF NEW.source_type = 'coaching_session' THEN
      v_event_type := 'coaching_session_completed';
    ELSE
      v_event_type := 'calendar_session_completed';
    END IF;
  ELSIF NEW.status = 'missed' THEN
    v_event_type := 'calendar_session_missed';
  ELSIF NEW.status = 'rescheduled' THEN
    v_event_type := 'calendar_session_rescheduled';
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.platform_activity_events (
    user_id, event_type, source_table, source_id, metadata, occurred_at
  )
  VALUES (
    NEW.user_id,
    v_event_type,
    'training_calendar_items',
    NEW.id,
    jsonb_build_object(
      'item_type', NEW.item_type,
      'title', NEW.title,
      'status', NEW.status
    ),
    COALESCE(NEW.completed_at, NOW())
  )
  ON CONFLICT DO NOTHING;

  IF v_event_type = 'calendar_session_completed' OR v_event_type = 'partner_workout_completed' THEN
    INSERT INTO public.platform_activity_events (
      user_id, event_type, source_table, source_id, metadata, occurred_at
    )
    VALUES (
      NEW.user_id,
      'workout_completed',
      'training_calendar_items',
      NEW.id,
      jsonb_build_object('via', 'calendar'),
      COALESCE(NEW.completed_at, NOW())
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS training_calendar_activity_record ON public.training_calendar_items;

CREATE TRIGGER training_calendar_activity_record
  AFTER UPDATE OF status ON public.training_calendar_items
  FOR EACH ROW EXECUTE FUNCTION public.record_activity_calendar_status();

CREATE OR REPLACE FUNCTION public.record_activity_event_attended()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.platform_activity_events (
    user_id, event_type, source_table, source_id, metadata, occurred_at
  )
  SELECT
    NEW.user_id,
    'event_attended',
    'event_attendees',
    NEW.event_id,
    jsonb_build_object('event_id', NEW.event_id),
    NOW()
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS event_attendee_activity_record ON public.event_attendees;

CREATE TRIGGER event_attendee_activity_record
  AFTER INSERT ON public.event_attendees
  FOR EACH ROW EXECUTE FUNCTION public.record_activity_event_attended();

CREATE OR REPLACE FUNCTION public.record_activity_event_hosted()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.platform_activity_events (
    user_id, event_type, source_table, source_id, metadata, occurred_at
  )
  VALUES (
    NEW.created_by,
    'event_hosted',
    'events',
    NEW.id,
    jsonb_build_object('title', NEW.title),
    NEW.created_at
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS event_hosted_activity_record ON public.events;

CREATE TRIGGER event_hosted_activity_record
  AFTER INSERT ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.record_activity_event_hosted();

CREATE OR REPLACE FUNCTION public.record_activity_story_commitment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.completed_at IS NULL OR OLD.completed_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.platform_activity_events (
    user_id, event_type, source_table, source_id, metadata, occurred_at
  )
  VALUES (
    NEW.user_id,
    'story_commitment_completed',
    'story_workout_commitments',
    NEW.id,
    jsonb_build_object('story_id', NEW.story_id),
    NEW.completed_at
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO public.platform_activity_events (
    user_id, event_type, source_table, source_id, metadata, occurred_at
  )
  VALUES (
    NEW.user_id,
    'workout_completed',
    'story_workout_commitments',
    NEW.id,
    jsonb_build_object('via', 'story_commitment'),
    NEW.completed_at
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS story_commitment_activity_record ON public.story_workout_commitments;

CREATE TRIGGER story_commitment_activity_record
  AFTER UPDATE OF completed_at ON public.story_workout_commitments
  FOR EACH ROW EXECUTE FUNCTION public.record_activity_story_commitment();

CREATE OR REPLACE FUNCTION public.record_activity_challenge_joined()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.platform_activity_events (
    user_id, event_type, source_table, source_id, metadata, occurred_at
  )
  VALUES (
    NEW.user_id,
    'challenge_joined',
    'challenge_participants',
    NEW.challenge_id,
    jsonb_build_object('challenge_id', NEW.challenge_id),
    COALESCE(NEW.joined_at, NOW())
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS challenge_join_activity_record ON public.challenge_participants;

CREATE TRIGGER challenge_join_activity_record
  AFTER INSERT ON public.challenge_participants
  FOR EACH ROW EXECUTE FUNCTION public.record_activity_challenge_joined();

CREATE OR REPLACE FUNCTION public.record_activity_workout_post()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.post_type NOT IN ('workout_update', 'photo', 'video') THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.platform_activity_events (
    user_id, event_type, source_table, source_id, metadata, occurred_at
  )
  VALUES (
    NEW.author_id,
    'workout_completed',
    'posts',
    NEW.id,
    jsonb_build_object('post_type', NEW.post_type),
    NEW.created_at
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS workout_post_activity_record ON public.posts;

CREATE TRIGGER workout_post_activity_record
  AFTER INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.record_activity_workout_post();

-- user_achievements inserts via API (achievement engine) — allow service role / owner read only for now
CREATE POLICY "System inserts user achievements"
  ON public.user_achievements FOR INSERT
  WITH CHECK (user_id = auth.uid());
