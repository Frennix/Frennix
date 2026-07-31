-- Per-slide story views + tighter viewer RLS (owner self-views blocked at DB layer).

CREATE TABLE IF NOT EXISTS public.story_slide_views (
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  slide_id UUID NOT NULL REFERENCES public.story_slides(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (slide_id, viewer_id)
);

CREATE INDEX IF NOT EXISTS story_slide_views_story_slide_idx
  ON public.story_slide_views (story_id, slide_id, viewed_at DESC);

ALTER TABLE public.story_slide_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Viewers insert own slide views"
  ON public.story_slide_views FOR INSERT
  WITH CHECK (
    viewer_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.stories s
      WHERE s.id = story_id AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Viewers update own slide views"
  ON public.story_slide_views FOR UPDATE
  USING (viewer_id = auth.uid())
  WITH CHECK (viewer_id = auth.uid());

CREATE POLICY "Viewers read own slide views"
  ON public.story_slide_views FOR SELECT
  USING (viewer_id = auth.uid());

CREATE POLICY "Story owners read slide views"
  ON public.story_slide_views FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.stories s
      WHERE s.id = story_id AND s.user_id = auth.uid()
    )
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.story_slide_views;

-- Replace broad ALL policy on story_item_views with explicit viewer policies.
DROP POLICY IF EXISTS "Users manage own story views" ON public.story_item_views;

CREATE POLICY "Viewers insert own story views"
  ON public.story_item_views FOR INSERT
  WITH CHECK (
    viewer_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.stories s
      WHERE s.id = story_id AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Viewers update own story views"
  ON public.story_item_views FOR UPDATE
  USING (viewer_id = auth.uid())
  WITH CHECK (viewer_id = auth.uid());

CREATE POLICY "Viewers read own story views"
  ON public.story_item_views FOR SELECT
  USING (viewer_id = auth.uid());
