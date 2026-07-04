-- Story Phase 3: polls, story reply references, realtime viewers, highlight story links

-- ─── Story polls ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.story_polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (story_id)
);

CREATE TABLE IF NOT EXISTS public.story_poll_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES public.story_polls(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS story_poll_options_poll_idx
  ON public.story_poll_options (poll_id, sort_order);

CREATE TABLE IF NOT EXISTS public.story_poll_votes (
  poll_id UUID NOT NULL REFERENCES public.story_polls(id) ON DELETE CASCADE,
  option_id UUID NOT NULL REFERENCES public.story_poll_options(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (poll_id, user_id)
);

ALTER TABLE public.story_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_poll_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads polls on visible stories"
  ON public.story_polls FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.stories s
      WHERE s.id = story_id
        AND (s.expires_at > NOW() OR s.user_id = auth.uid())
    )
  );

CREATE POLICY "Story owners create polls"
  ON public.story_polls FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.stories s
      WHERE s.id = story_id AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone reads poll options"
  ON public.story_poll_options FOR SELECT
  USING (true);

CREATE POLICY "Story owners insert poll options"
  ON public.story_poll_options FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.story_polls p
      JOIN public.stories s ON s.id = p.story_id
      WHERE p.id = poll_id AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Users manage own poll votes"
  ON public.story_poll_votes FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Anyone reads poll votes"
  ON public.story_poll_votes FOR SELECT
  USING (true);

-- ─── Instagram-style story reply in DMs ──────────────────────────────────────

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS story_reply_id UUID REFERENCES public.stories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS messages_story_reply_idx
  ON public.messages (story_reply_id)
  WHERE story_reply_id IS NOT NULL;

-- Highlights: support dedicated stories without a feed post
ALTER TABLE public.story_highlight_items DROP CONSTRAINT IF EXISTS story_highlight_items_pkey;

ALTER TABLE public.story_highlight_items
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();

UPDATE public.story_highlight_items
SET id = gen_random_uuid()
WHERE id IS NULL;

ALTER TABLE public.story_highlight_items
  ALTER COLUMN id SET NOT NULL;

ALTER TABLE public.story_highlight_items
  ALTER COLUMN post_id DROP NOT NULL;

ALTER TABLE public.story_highlight_items
  ADD CONSTRAINT story_highlight_items_pkey PRIMARY KEY (id);

CREATE UNIQUE INDEX IF NOT EXISTS story_highlight_items_post_unique
  ON public.story_highlight_items (highlight_id, post_id)
  WHERE post_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS story_highlight_items_story_unique
  ON public.story_highlight_items (highlight_id, story_id)
  WHERE story_id IS NOT NULL;

-- ─── Realtime: live viewer list for story owners ───────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'story_item_views'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.story_item_views;
  END IF;
END $$;
