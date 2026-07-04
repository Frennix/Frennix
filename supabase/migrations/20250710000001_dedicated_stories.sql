-- Dedicated Stories system — separate from feed posts.
-- Stories expire after 24h; expired rows are archived privately for Memories (highlights later).

-- ─── Core story tables ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  privacy TEXT NOT NULL DEFAULT 'followers'
    CHECK (privacy IN ('everyone', 'followers', 'friends')),
  post_id UUID REFERENCES public.posts(id) ON DELETE SET NULL,
  workout_tag TEXT,
  location_name TEXT,
  location_type TEXT CHECK (location_type IN ('gym', 'park', 'city', 'trail', 'route', 'other')),
  challenge_id UUID REFERENCES public.challenges(id) ON DELETE SET NULL,
  challenge_prompt TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);

CREATE INDEX IF NOT EXISTS stories_user_active_idx
  ON public.stories (user_id, expires_at DESC);

CREATE INDEX IF NOT EXISTS stories_expires_at_idx
  ON public.stories (expires_at);

COMMENT ON TABLE public.stories IS
  'Ephemeral story collections (24h). Optional post_id when also shared to feed.';

CREATE TABLE IF NOT EXISTS public.story_slides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  media_url TEXT,
  media_type TEXT NOT NULL CHECK (media_type IN ('photo', 'video', 'text', 'workout')),
  caption TEXT,
  workout_type TEXT,
  workout_data JSONB NOT NULL DEFAULT '{}',
  sort_order INT NOT NULL DEFAULT 0,
  slide_meta JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS story_slides_story_idx
  ON public.story_slides (story_id, sort_order);

-- ─── Engagement (story_id based) ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.story_item_views (
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_viewed_slide_id UUID REFERENCES public.story_slides(id) ON DELETE SET NULL,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (story_id, viewer_id)
);

CREATE INDEX IF NOT EXISTS story_item_views_story_idx
  ON public.story_item_views (story_id, viewed_at DESC);

CREATE TABLE IF NOT EXISTS public.story_item_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  slide_id UUID REFERENCES public.story_slides(id) ON DELETE SET NULL,
  reaction TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (story_id, user_id)
);

CREATE INDEX IF NOT EXISTS story_item_reactions_story_idx
  ON public.story_item_reactions (story_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.story_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  slide_id UUID REFERENCES public.story_slides(id) ON DELETE CASCADE,
  mentioned_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS story_mentions_user_idx
  ON public.story_mentions (mentioned_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.story_challenge_joins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (story_id, user_id)
);

-- ─── Private Memories (expired stories saved for owner) ────────────────────────

CREATE TABLE IF NOT EXISTS public.story_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  original_story_id UUID NOT NULL,
  story_snapshot JSONB NOT NULL,
  memory_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS story_memories_user_date_idx
  ON public.story_memories (user_id, memory_date DESC);

COMMENT ON TABLE public.story_memories IS
  'Private archive of expired stories for owner-only Memories feature.';

-- Future Highlights: link collections to dedicated stories (UI not built yet).
ALTER TABLE public.story_highlights
  ADD COLUMN IF NOT EXISTS cover_story_id UUID REFERENCES public.stories(id) ON DELETE SET NULL;

ALTER TABLE public.story_highlight_items
  ADD COLUMN IF NOT EXISTS story_id UUID REFERENCES public.stories(id) ON DELETE SET NULL;

-- Extend engagement events for story_id tracking.
ALTER TABLE public.story_engagement_events
  ADD COLUMN IF NOT EXISTS story_id UUID REFERENCES public.stories(id) ON DELETE SET NULL;

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_item_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_item_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_challenge_joins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads non-expired stories"
  ON public.stories FOR SELECT
  USING (expires_at > NOW() OR user_id = auth.uid());

CREATE POLICY "Users create own stories"
  ON public.stories FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own stories"
  ON public.stories FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete own stories"
  ON public.stories FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "Anyone reads slides of visible stories"
  ON public.story_slides FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.stories s
      WHERE s.id = story_id
        AND (s.expires_at > NOW() OR s.user_id = auth.uid())
    )
  );

CREATE POLICY "Users insert slides on own stories"
  ON public.story_slides FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.stories s
      WHERE s.id = story_id AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Users manage own story views"
  ON public.story_item_views FOR ALL
  USING (viewer_id = auth.uid())
  WITH CHECK (viewer_id = auth.uid());

CREATE POLICY "Story owners read views"
  ON public.story_item_views FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.stories s
      WHERE s.id = story_id AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Users manage own story reactions"
  ON public.story_item_reactions FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Story owners read reactions"
  ON public.story_item_reactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.stories s
      WHERE s.id = story_id AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone reads story mentions"
  ON public.story_mentions FOR SELECT
  USING (true);

CREATE POLICY "Users insert mentions on own stories"
  ON public.story_mentions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.stories s
      WHERE s.id = story_id AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Users manage own challenge joins"
  ON public.story_challenge_joins FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Story owners read challenge joins"
  ON public.story_challenge_joins FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.stories s
      WHERE s.id = story_id AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Users read own memories"
  ON public.story_memories FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "System inserts memories for owner"
  ON public.story_memories FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- ─── Archive expired stories into Memories ───────────────────────────────────

CREATE OR REPLACE FUNCTION public.archive_expired_stories()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.story_memories (user_id, original_story_id, story_snapshot, memory_date)
  SELECT
    s.user_id,
    s.id,
    jsonb_build_object(
      'story', to_jsonb(s),
      'slides', COALESCE(
        (
          SELECT jsonb_agg(to_jsonb(sl) ORDER BY sl.sort_order)
          FROM public.story_slides sl
          WHERE sl.story_id = s.id
        ),
        '[]'::jsonb
      )
    ),
    (s.created_at AT TIME ZONE 'UTC')::date
  FROM public.stories s
  WHERE s.expires_at <= NOW()
    AND NOT EXISTS (
      SELECT 1 FROM public.story_memories m
      WHERE m.original_story_id = s.id
    );

  DELETE FROM public.stories
  WHERE expires_at <= NOW();
END;
$$;

-- ─── Story notification types (extend check constraint) ──────────────────────

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'follow', 'message', 'like', 'reaction', 'comment', 'comment_reply',
    'match', 'trainer_connection_request', 'trainer_connection_accepted',
    'group_invite', 'challenge_reminder', 'challenge_join', 'challenge_invite',
    'event_join', 'event_invite', 'post_share', 'story_train_invite',
    'story_reaction', 'story_reply', 'story_mention', 'story_challenge_join'
  ));
