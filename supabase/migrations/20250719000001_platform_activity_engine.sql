-- Platform Activity Engine — standardized activity stream for all Frennix features.
-- Renames ledger columns to activity_type / source_type and expands canonical types.

-- ─── Standardize column names ────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'platform_activity_events'
      AND column_name = 'event_type'
  ) THEN
    ALTER TABLE public.platform_activity_events RENAME COLUMN event_type TO activity_type;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'platform_activity_events'
      AND column_name = 'source_table'
  ) THEN
    ALTER TABLE public.platform_activity_events RENAME COLUMN source_table TO source_type;
  END IF;
END $$;

ALTER TABLE public.platform_activity_events DROP CONSTRAINT IF EXISTS platform_activity_events_event_type_check;
ALTER TABLE public.platform_activity_events DROP CONSTRAINT IF EXISTS platform_activity_events_activity_type_check;

ALTER TABLE public.platform_activity_events ADD CONSTRAINT platform_activity_events_activity_type_check
  CHECK (activity_type IN (
    'workout_completed',
    'workout_scheduled',
    'workout_rescheduled',
    'workout_cancelled',
    'workout_missed',
    'story_posted',
    'story_viewed',
    'story_reacted',
    'story_replied',
    'story_commitment_completed',
    'feed_post_created',
    'feed_post_liked',
    'feed_post_commented',
    'challenge_joined',
    'challenge_completed',
    'event_created',
    'event_joined',
    'event_attended',
    'match_created',
    'training_partner_favorited',
    'message_sent',
    'workout_invite_sent',
    'workout_invite_accepted',
    'workout_invite_declined',
    'workout_invite_maybe_later',
    'achievement_earned',
    'partner_workout_completed',
    'run_club_participation',
    'group_workout_completed',
    'coaching_session_completed',
    'positive_interaction',
    'helped_beginner',
    -- legacy aliases (migrated away over time)
    'calendar_session_completed',
    'calendar_session_missed',
    'calendar_session_rescheduled',
    'event_hosted'
  ));

DROP INDEX IF EXISTS platform_activity_events_dedup_idx;
CREATE UNIQUE INDEX IF NOT EXISTS platform_activity_events_dedup_idx
  ON public.platform_activity_events (user_id, activity_type, source_type, source_id)
  WHERE source_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS platform_activity_events_type_time_idx
  ON public.platform_activity_events (activity_type, occurred_at DESC);

-- Backfill legacy activity type names
UPDATE public.platform_activity_events SET activity_type = 'event_created' WHERE activity_type = 'event_hosted';
UPDATE public.platform_activity_events SET activity_type = 'workout_rescheduled' WHERE activity_type = 'calendar_session_rescheduled';
UPDATE public.platform_activity_events SET activity_type = 'workout_missed' WHERE activity_type = 'calendar_session_missed';
UPDATE public.platform_activity_events SET activity_type = 'workout_completed' WHERE activity_type = 'calendar_session_completed';

-- ─── Reputation weights: rename column if needed ─────────────────────────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'reputation_event_weights'
      AND column_name = 'event_type'
  ) THEN
    ALTER TABLE public.reputation_event_weights RENAME COLUMN event_type TO activity_type;
  END IF;
END $$;

INSERT INTO public.reputation_event_weights (
  activity_type, consistency_weight, reliability_weight, community_weight, partnership_weight, description
)
VALUES
  ('workout_scheduled', 1, 1, 0, 0, 'Scheduled a workout'),
  ('workout_rescheduled', 0, 0, 0, 0, 'Rescheduled a workout'),
  ('workout_cancelled', 0, -1, 0, 0, 'Cancelled a workout'),
  ('workout_missed', 0, -2, 0, -1, 'Missed a scheduled workout'),
  ('story_posted', 1, 0, 2, 0, 'Posted a story'),
  ('story_viewed', 0, 0, 1, 0, 'Viewed a story'),
  ('story_reacted', 0, 0, 2, 1, 'Reacted to a story'),
  ('story_replied', 0, 0, 3, 2, 'Replied to a story'),
  ('feed_post_created', 2, 0, 1, 0, 'Created a feed post'),
  ('feed_post_liked', 0, 0, 1, 0, 'Liked a feed post'),
  ('feed_post_commented', 0, 0, 2, 0, 'Commented on a feed post'),
  ('event_created', 1, 2, 6, 0, 'Created a community event'),
  ('event_joined', 2, 3, 4, 0, 'Joined a community event'),
  ('match_created', 1, 0, 2, 4, 'New training match'),
  ('training_partner_favorited', 0, 0, 2, 3, 'Favorited a training partner'),
  ('message_sent', 0, 0, 1, 2, 'Sent a message'),
  ('workout_invite_sent', 1, 1, 1, 4, 'Sent a workout invite'),
  ('workout_invite_accepted', 2, 3, 1, 5, 'Accepted a workout invite'),
  ('workout_invite_declined', 0, 0, 0, -1, 'Declined a workout invite'),
  ('workout_invite_maybe_later', 0, 0, 0, 0, 'Deferred a workout invite'),
  ('achievement_earned', 2, 1, 2, 1, 'Earned an achievement')
ON CONFLICT (activity_type) DO NOTHING;

-- ─── Central publish function (used by triggers + API) ───────────────────────

CREATE OR REPLACE FUNCTION public.publish_platform_activity(
  p_user_id UUID,
  p_activity_type TEXT,
  p_source_type TEXT DEFAULT NULL,
  p_source_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_occurred_at TIMESTAMPTZ DEFAULT NOW()
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.platform_activity_events (
    user_id, activity_type, source_type, source_id, metadata, occurred_at
  )
  VALUES (
    p_user_id, p_activity_type, p_source_type, p_source_id, p_metadata, p_occurred_at
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.publish_platform_activity TO authenticated;

-- ─── Refresh reputation using activity_type ──────────────────────────────────

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
  LEFT JOIN public.reputation_event_weights w ON w.activity_type = e.activity_type
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

-- ─── Trigger publishers (standardized activity stream) ─────────────────────

CREATE OR REPLACE FUNCTION public.record_activity_calendar_status()
RETURNS TRIGGER AS $$
DECLARE
  v_activity_type TEXT;
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
      PERFORM public.publish_platform_activity(
        NEW.user_id, 'partner_workout_completed', 'training_calendar_items', NEW.id,
        jsonb_build_object('item_type', NEW.item_type, 'title', NEW.title),
        COALESCE(NEW.completed_at, NOW())
      );
      PERFORM public.publish_platform_activity(
        NEW.user_id, 'workout_completed', 'training_calendar_items', NEW.id,
        jsonb_build_object('via', 'partner_workout', 'title', NEW.title),
        COALESCE(NEW.completed_at, NOW())
      );
    ELSIF NEW.item_type = 'event' THEN
      PERFORM public.publish_platform_activity(
        NEW.user_id, 'event_attended', 'training_calendar_items', NEW.id,
        jsonb_build_object('title', NEW.title), COALESCE(NEW.completed_at, NOW())
      );
    ELSIF NEW.item_type = 'challenge' THEN
      PERFORM public.publish_platform_activity(
        NEW.user_id, 'challenge_completed', 'training_calendar_items', NEW.id,
        jsonb_build_object('title', NEW.title), COALESCE(NEW.completed_at, NOW())
      );
    ELSIF NEW.source_type = 'run_club' THEN
      PERFORM public.publish_platform_activity(
        NEW.user_id, 'run_club_participation', 'training_calendar_items', NEW.id,
        jsonb_build_object('title', NEW.title), COALESCE(NEW.completed_at, NOW())
      );
    ELSE
      PERFORM public.publish_platform_activity(
        NEW.user_id, 'workout_completed', 'training_calendar_items', NEW.id,
        jsonb_build_object('item_type', NEW.item_type, 'title', NEW.title, 'via', 'calendar'),
        COALESCE(NEW.completed_at, NOW())
      );
    END IF;
  ELSIF NEW.status = 'missed' THEN
    PERFORM public.publish_platform_activity(
      NEW.user_id, 'workout_missed', 'training_calendar_items', NEW.id,
      jsonb_build_object('title', NEW.title), NOW()
    );
  ELSIF NEW.status = 'rescheduled' THEN
    PERFORM public.publish_platform_activity(
      NEW.user_id, 'workout_rescheduled', 'training_calendar_items', NEW.id,
      jsonb_build_object('title', NEW.title), NOW()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.record_activity_calendar_scheduled()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.publish_platform_activity(
    NEW.user_id, 'workout_scheduled', 'training_calendar_items', NEW.id,
    jsonb_build_object('item_type', NEW.item_type, 'title', NEW.title, 'starts_at', NEW.starts_at),
    NEW.created_at
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS training_calendar_scheduled_activity ON public.training_calendar_items;
CREATE TRIGGER training_calendar_scheduled_activity
  AFTER INSERT ON public.training_calendar_items
  FOR EACH ROW EXECUTE FUNCTION public.record_activity_calendar_scheduled();

CREATE OR REPLACE FUNCTION public.record_activity_event_joined()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.publish_platform_activity(
    NEW.user_id, 'event_joined', 'event_attendees', NEW.event_id,
    jsonb_build_object('event_id', NEW.event_id), NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS event_attendee_activity_record ON public.event_attendees;
CREATE TRIGGER event_attendee_activity_record
  AFTER INSERT ON public.event_attendees
  FOR EACH ROW EXECUTE FUNCTION public.record_activity_event_joined();

CREATE OR REPLACE FUNCTION public.record_activity_event_created()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.publish_platform_activity(
    NEW.created_by, 'event_created', 'events', NEW.id,
    jsonb_build_object('title', NEW.title), NEW.created_at
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS event_hosted_activity_record ON public.events;
CREATE TRIGGER event_hosted_activity_record
  AFTER INSERT ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.record_activity_event_created();

CREATE OR REPLACE FUNCTION public.record_activity_story_commitment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.completed_at IS NULL OR OLD.completed_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  PERFORM public.publish_platform_activity(
    NEW.user_id, 'story_commitment_completed', 'story_workout_commitments', NEW.id,
    jsonb_build_object('story_id', NEW.story_id), NEW.completed_at
  );
  PERFORM public.publish_platform_activity(
    NEW.user_id, 'workout_completed', 'story_workout_commitments', NEW.id,
    jsonb_build_object('via', 'story_commitment'), NEW.completed_at
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.record_activity_challenge_joined()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.publish_platform_activity(
    NEW.user_id, 'challenge_joined', 'challenge_participants', NEW.challenge_id,
    jsonb_build_object('challenge_id', NEW.challenge_id), COALESCE(NEW.joined_at, NOW())
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.record_activity_feed_post()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.publish_platform_activity(
    NEW.author_id, 'feed_post_created', 'posts', NEW.id,
    jsonb_build_object('post_type', NEW.post_type), NEW.created_at
  );

  IF NEW.post_type IN ('workout_update', 'photo', 'video') THEN
    PERFORM public.publish_platform_activity(
      NEW.author_id, 'workout_completed', 'posts', NEW.id,
      jsonb_build_object('post_type', NEW.post_type), NEW.created_at
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.record_activity_post_liked()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.publish_platform_activity(
    NEW.user_id, 'feed_post_liked', 'likes', NEW.id,
    jsonb_build_object('post_id', NEW.post_id), NEW.created_at
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS post_liked_activity_record ON public.likes;
CREATE TRIGGER post_liked_activity_record
  AFTER INSERT ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.record_activity_post_liked();

CREATE OR REPLACE FUNCTION public.record_activity_post_commented()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.publish_platform_activity(
    NEW.author_id, 'feed_post_commented', 'comments', NEW.id,
    jsonb_build_object('post_id', NEW.post_id), NEW.created_at
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS post_commented_activity_record ON public.comments;
CREATE TRIGGER post_commented_activity_record
  AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.record_activity_post_commented();

CREATE OR REPLACE FUNCTION public.record_activity_invite_response()
RETURNS TRIGGER AS $$
DECLARE
  v_activity_type TEXT;
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'accepted' THEN
    v_activity_type := 'workout_invite_accepted';
  ELSIF NEW.status = 'declined' THEN
    v_activity_type := 'workout_invite_declined';
  ELSIF NEW.status = 'maybe_later' THEN
    v_activity_type := 'workout_invite_maybe_later';
  ELSE
    RETURN NEW;
  END IF;

  PERFORM public.publish_platform_activity(
    NEW.invitee_id, v_activity_type, 'training_session_invites', NEW.id,
    jsonb_build_object('calendar_item_id', NEW.calendar_item_id, 'inviter_id', NEW.inviter_id),
    COALESCE(NEW.responded_at, NOW())
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS training_invite_response_activity ON public.training_session_invites;
CREATE TRIGGER training_invite_response_activity
  AFTER UPDATE OF status ON public.training_session_invites
  FOR EACH ROW EXECUTE FUNCTION public.record_activity_invite_response();

CREATE OR REPLACE FUNCTION public.record_activity_invite_sent()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.publish_platform_activity(
    NEW.inviter_id, 'workout_invite_sent', 'training_session_invites', NEW.id,
    jsonb_build_object('calendar_item_id', NEW.calendar_item_id, 'invitee_id', NEW.invitee_id),
    NEW.created_at
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS training_invite_sent_activity ON public.training_session_invites;
CREATE TRIGGER training_invite_sent_activity
  AFTER INSERT ON public.training_session_invites
  FOR EACH ROW EXECUTE FUNCTION public.record_activity_invite_sent();

-- Story views (if table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'story_item_views'
  ) THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.record_activity_story_viewed()
      RETURNS TRIGGER AS $body$
      BEGIN
        IF NEW.viewer_id IS NOT NULL THEN
          PERFORM public.publish_platform_activity(
            NEW.viewer_id, 'story_viewed', 'story_item_views', NEW.story_id,
            jsonb_build_object('story_id', NEW.story_id),
            COALESCE(NEW.viewed_at, NOW())
          );
        END IF;
        RETURN NEW;
      END;
      $body$ LANGUAGE plpgsql SECURITY DEFINER;
    $fn$;

    EXECUTE 'DROP TRIGGER IF EXISTS story_viewed_activity_record ON public.story_item_views';
    EXECUTE 'CREATE TRIGGER story_viewed_activity_record
      AFTER INSERT ON public.story_item_views
      FOR EACH ROW EXECUTE FUNCTION public.record_activity_story_viewed()';
  END IF;
END $$;

COMMENT ON TABLE public.platform_activity_events IS
  'Platform Activity Engine — single append-only stream for achievements, reputation, analytics, recaps, and AI.';
