-- Training Calendar — plan, track, and stay consistent with workouts.

CREATE TABLE IF NOT EXISTS public.training_calendar_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  item_type TEXT NOT NULL CHECK (
    item_type IN (
      'solo_workout',
      'partner_workout',
      'run_walk',
      'gym_session',
      'event',
      'challenge',
      'rest_day'
    )
  ),
  scheduled_date DATE NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  workout_type TEXT,
  location TEXT,
  notes TEXT,
  privacy TEXT NOT NULL DEFAULT 'private'
    CHECK (privacy IN ('private', 'friends', 'public')),
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'completed', 'missed', 'rescheduled')),
  linked_event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  linked_challenge_id UUID REFERENCES public.challenges(id) ON DELETE SET NULL,
  rescheduled_to_id UUID REFERENCES public.training_calendar_items(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS training_calendar_items_user_date_idx
  ON public.training_calendar_items (user_id, scheduled_date);

CREATE INDEX IF NOT EXISTS training_calendar_items_starts_at_idx
  ON public.training_calendar_items (starts_at);

CREATE TABLE IF NOT EXISTS public.training_session_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_item_id UUID NOT NULL REFERENCES public.training_calendar_items(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invitee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'maybe_later')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  UNIQUE (calendar_item_id, invitee_id)
);

CREATE INDEX IF NOT EXISTS training_session_invites_invitee_idx
  ON public.training_session_invites (invitee_id, status);

CREATE TABLE IF NOT EXISTS public.training_session_participants (
  calendar_item_id UUID NOT NULL REFERENCES public.training_calendar_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'partner')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (calendar_item_id, user_id)
);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.training_calendar_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_session_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_session_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own and participating calendar items"
  ON public.training_calendar_items FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.training_session_participants p
      WHERE p.calendar_item_id = id AND p.user_id = auth.uid()
    )
    OR privacy = 'public'
  );

CREATE POLICY "Users create own calendar items"
  ON public.training_calendar_items FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own calendar items"
  ON public.training_calendar_items FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete own calendar items"
  ON public.training_calendar_items FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "Inviters manage session invites"
  ON public.training_session_invites FOR ALL
  USING (inviter_id = auth.uid())
  WITH CHECK (inviter_id = auth.uid());

CREATE POLICY "Invitees read and respond to invites"
  ON public.training_session_invites FOR SELECT
  USING (invitee_id = auth.uid() OR inviter_id = auth.uid());

CREATE POLICY "Invitees update invite responses"
  ON public.training_session_invites FOR UPDATE
  USING (invitee_id = auth.uid())
  WITH CHECK (invitee_id = auth.uid());

CREATE POLICY "Participants read session participants"
  ON public.training_session_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.training_calendar_items i
      WHERE i.id = calendar_item_id
        AND (i.user_id = auth.uid() OR EXISTS (
          SELECT 1 FROM public.training_session_participants p2
          WHERE p2.calendar_item_id = i.id AND p2.user_id = auth.uid()
        ))
    )
  );

CREATE POLICY "Owners manage participants"
  ON public.training_session_participants FOR ALL
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
