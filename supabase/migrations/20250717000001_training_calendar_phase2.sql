-- Training Calendar Phase 2 — unified hub: provenance, activity layer, invites, future sync.

-- ─── Provenance + completion links on native calendar items ─────────────────

ALTER TABLE public.training_calendar_items
  ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'native'
    CHECK (source_type IN (
      'native',
      'story_invite',
      'story_commitment',
      'message_invite',
      'event_mirror',
      'challenge_mirror',
      'group_workout',
      'run_club',
      'coaching_session',
      'nutrition_challenge',
      'ai_recommendation',
      'external_import'
    )),
  ADD COLUMN IF NOT EXISTS source_id UUID,
  ADD COLUMN IF NOT EXISTS completed_post_id UUID REFERENCES public.posts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS completed_story_id UUID REFERENCES public.stories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS recurrence_rule TEXT,
  ADD COLUMN IF NOT EXISTS reminder_minutes_before INTEGER;

CREATE INDEX IF NOT EXISTS training_calendar_items_source_idx
  ON public.training_calendar_items (source_type, source_id)
  WHERE source_id IS NOT NULL;

-- ─── Future external calendar / wearable sync (schema only — no integrations) ─

CREATE TABLE IF NOT EXISTS public.training_calendar_external_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_item_id UUID NOT NULL REFERENCES public.training_calendar_items(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN (
    'google_calendar',
    'apple_calendar',
    'outlook_calendar',
    'garmin_connect',
    'apple_health',
    'google_fit',
    'strava',
    'fitbit'
  )),
  external_id TEXT NOT NULL,
  external_calendar_id TEXT,
  sync_direction TEXT NOT NULL DEFAULT 'export'
    CHECK (sync_direction IN ('import', 'export', 'bidirectional')),
  last_synced_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (calendar_item_id, provider),
  UNIQUE (provider, external_id)
);

CREATE INDEX IF NOT EXISTS training_calendar_external_links_provider_idx
  ON public.training_calendar_external_links (provider, last_synced_at DESC);

ALTER TABLE public.training_calendar_external_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage external calendar links"
  ON public.training_calendar_external_links FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.training_calendar_items i
      WHERE i.id = calendar_item_id AND i.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.training_calendar_items i
      WHERE i.id = calendar_item_id AND i.user_id = auth.uid()
    )
  );

-- ─── Training session invite notifications ───────────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_on_training_session_invite()
RETURNS TRIGGER AS $$
DECLARE
  session_title TEXT;
  inviter_name TEXT;
BEGIN
  SELECT title INTO session_title
  FROM public.training_calendar_items
  WHERE id = NEW.calendar_item_id;

  SELECT display_name INTO inviter_name
  FROM public.profiles
  WHERE id = NEW.inviter_id;

  INSERT INTO public.notifications (user_id, type, payload)
  VALUES (
    NEW.invitee_id,
    'training_session_invite',
    jsonb_build_object(
      'calendar_item_id', NEW.calendar_item_id,
      'invite_id', NEW.id,
      'inviter_id', NEW.inviter_id,
      'inviter_name', COALESCE(inviter_name, 'Someone'),
      'session_title', COALESCE(session_title, 'Training session'),
      'preview', COALESCE(inviter_name, 'Someone') || ' invited you to train.'
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_training_session_invite_notify ON public.training_session_invites;

CREATE TRIGGER on_training_session_invite_notify
  AFTER INSERT ON public.training_session_invites
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_training_session_invite();

CREATE OR REPLACE FUNCTION public.notify_on_training_session_accepted()
RETURNS TRIGGER AS $$
DECLARE
  session_title TEXT;
  invitee_name TEXT;
BEGIN
  IF NEW.status <> 'accepted' OR OLD.status = 'accepted' THEN
    RETURN NEW;
  END IF;

  SELECT title INTO session_title
  FROM public.training_calendar_items
  WHERE id = NEW.calendar_item_id;

  SELECT display_name INTO invitee_name
  FROM public.profiles
  WHERE id = NEW.invitee_id;

  INSERT INTO public.notifications (user_id, type, payload)
  VALUES (
    NEW.inviter_id,
    'training_session_accepted',
    jsonb_build_object(
      'calendar_item_id', NEW.calendar_item_id,
      'invite_id', NEW.id,
      'invitee_id', NEW.invitee_id,
      'invitee_name', COALESCE(invitee_name, 'Your partner'),
      'session_title', COALESCE(session_title, 'Training session'),
      'preview', COALESCE(invitee_name, 'Your partner') || ' accepted your training invite.'
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_training_session_accepted_notify ON public.training_session_invites;

CREATE TRIGGER on_training_session_accepted_notify
  AFTER UPDATE ON public.training_session_invites
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_training_session_accepted();

-- Auto-add accepted partners as session participants
CREATE OR REPLACE FUNCTION public.add_training_session_participant_on_accept()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'accepted' AND (OLD.status IS DISTINCT FROM 'accepted') THEN
    INSERT INTO public.training_session_participants (calendar_item_id, user_id, role)
    VALUES (NEW.calendar_item_id, NEW.invitee_id, 'partner')
    ON CONFLICT (calendar_item_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_training_session_accept_participant ON public.training_session_invites;

CREATE TRIGGER on_training_session_accept_participant
  AFTER UPDATE ON public.training_session_invites
  FOR EACH ROW EXECUTE FUNCTION public.add_training_session_participant_on_accept();

-- ─── Extend notification types ─────────────────────────────────────────────

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'follow', 'message', 'like', 'reaction', 'comment', 'comment_reply',
    'match', 'trainer_connection_request', 'trainer_connection_accepted',
    'group_invite', 'challenge_reminder', 'challenge_join', 'challenge_invite',
    'event_join', 'event_invite', 'post_share', 'story_train_invite',
    'story_reaction', 'story_reply', 'story_mention', 'story_challenge_join',
    'training_session_invite', 'training_session_accepted', 'training_session_reminder'
  ));

-- Mark calendar item completed_at when status becomes completed
CREATE OR REPLACE FUNCTION public.sync_training_calendar_completed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    NEW.completed_at := COALESCE(NEW.completed_at, NOW());
  ELSIF NEW.status <> 'completed' THEN
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS training_calendar_completed_at_sync ON public.training_calendar_items;

CREATE TRIGGER training_calendar_completed_at_sync
  BEFORE UPDATE ON public.training_calendar_items
  FOR EACH ROW EXECUTE FUNCTION public.sync_training_calendar_completed_at();
