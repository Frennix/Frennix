-- Workout Stories 2.0: privacy, train invites, insights, highlights, expanded reactions.

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS story_audience TEXT NOT NULL DEFAULT 'public'
    CHECK (story_audience IN ('public', 'followers', 'friends', 'private'));

COMMENT ON COLUMN public.posts.story_audience IS
  'Who can view this post in Workout Stories: public, followers, friends, private.';

-- Allow any story reaction emoji (quick reactions + future).
ALTER TABLE public.story_reactions DROP CONSTRAINT IF EXISTS story_reactions_emoji_check;

CREATE TABLE IF NOT EXISTS public.story_train_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invitee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id UUID REFERENCES public.posts(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'suggest_day', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  UNIQUE (inviter_id, invitee_id, post_id)
);

CREATE INDEX IF NOT EXISTS story_train_invites_invitee_idx ON public.story_train_invites (invitee_id, status);

CREATE TABLE IF NOT EXISTS public.story_engagement_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id UUID REFERENCES public.posts(id) ON DELETE SET NULL,
  viewer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'view',
      'reaction',
      'reply',
      'challenge',
      'train_invite',
      'profile_visit',
      'follow'
    )
  ),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS story_engagement_events_story_idx
  ON public.story_engagement_events (story_user_id, post_id, event_type);

-- Future: permanent story collections on profile.
CREATE TABLE IF NOT EXISTS public.story_highlights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'custom',
  cover_post_id UUID REFERENCES public.posts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.story_highlight_items (
  highlight_id UUID NOT NULL REFERENCES public.story_highlights(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (highlight_id, post_id)
);

ALTER TABLE public.story_train_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_engagement_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_highlight_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own train invites sent"
  ON public.story_train_invites FOR ALL
  USING (inviter_id = auth.uid())
  WITH CHECK (inviter_id = auth.uid());

CREATE POLICY "Invitees read and respond to train invites"
  ON public.story_train_invites FOR SELECT
  USING (invitee_id = auth.uid() OR inviter_id = auth.uid());

CREATE POLICY "Invitees update train invite responses"
  ON public.story_train_invites FOR UPDATE
  USING (invitee_id = auth.uid())
  WITH CHECK (invitee_id = auth.uid());

CREATE POLICY "Story owners read engagement events"
  ON public.story_engagement_events FOR SELECT
  USING (story_user_id = auth.uid());

CREATE POLICY "Authenticated users insert engagement events"
  ON public.story_engagement_events FOR INSERT
  WITH CHECK (viewer_id = auth.uid());

CREATE POLICY "Users manage own highlights"
  ON public.story_highlights FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users manage own highlight items"
  ON public.story_highlight_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.story_highlights h
      WHERE h.id = highlight_id AND h.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.story_highlights h
      WHERE h.id = highlight_id AND h.user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone reads public highlights"
  ON public.story_highlights FOR SELECT
  USING (true);

CREATE POLICY "Anyone reads highlight items"
  ON public.story_highlight_items FOR SELECT
  USING (true);
