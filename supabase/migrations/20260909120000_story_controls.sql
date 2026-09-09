-- Story Controls: per-story commenting, expanded privacy, RLS enforcement,
-- view/reply guards, and a private stories media bucket.

-- ─── Columns ────────────────────────────────────────────────────────────────

ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS commenting_enabled BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.stories
  DROP CONSTRAINT IF EXISTS stories_privacy_check;

ALTER TABLE public.stories
  ADD CONSTRAINT stories_privacy_check
  CHECK (privacy IN ('everyone', 'followers', 'friends', 'connections', 'only_me'));

COMMENT ON COLUMN public.stories.privacy IS
  'everyone | connections | only_me for new stories. followers/friends retained for existing rows.';

COMMENT ON COLUMN public.stories.commenting_enabled IS
  'When false, viewers cannot add story replies. Existing replies remain.';

-- Existing rows keep their stored privacy (typically followers) and commenting_enabled = true.

-- ─── Visibility helpers ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.story_users_are_connected(p_owner_id UUID, p_viewer_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.matches m
    WHERE m.status = 'matched'
      AND m.user_a = LEAST(p_owner_id, p_viewer_id)
      AND m.user_b = GREATEST(p_owner_id, p_viewer_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_story(p_story_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_story public.stories%ROWTYPE;
  v_viewer UUID := auth.uid();
BEGIN
  IF v_viewer IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT * INTO v_story
  FROM public.stories
  WHERE id = p_story_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF v_story.user_id = v_viewer THEN
    RETURN TRUE;
  END IF;

  IF v_story.expires_at <= NOW() THEN
    RETURN FALSE;
  END IF;

  IF public.users_are_blocked(v_viewer, v_story.user_id) THEN
    RETURN FALSE;
  END IF;

  IF v_story.privacy = 'everyone' THEN
    RETURN TRUE;
  END IF;

  IF v_story.privacy = 'only_me' THEN
    RETURN FALSE;
  END IF;

  IF v_story.privacy = 'connections' THEN
    RETURN public.story_users_are_connected(v_story.user_id, v_viewer);
  END IF;

  IF v_story.privacy = 'friends' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.follows
      WHERE follower_id = v_viewer AND following_id = v_story.user_id
    ) AND EXISTS (
      SELECT 1 FROM public.follows
      WHERE follower_id = v_story.user_id AND following_id = v_viewer
    );
  END IF;

  IF v_story.privacy = 'followers' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.follows
      WHERE follower_id = v_viewer AND following_id = v_story.user_id
    );
  END IF;

  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_reply_to_story(p_story_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT s.commenting_enabled INTO v_enabled
  FROM public.stories s
  WHERE s.id = p_story_id;

  IF v_enabled IS NULL THEN
    RETURN FALSE;
  END IF;

  IF NOT v_enabled THEN
    RETURN FALSE;
  END IF;

  RETURN public.can_view_story(p_story_id);
END;
$$;

REVOKE ALL ON FUNCTION public.story_users_are_connected(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_view_story(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_reply_to_story(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.story_users_are_connected(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_story(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_reply_to_story(UUID) TO authenticated;

-- ─── Story + slide SELECT ───────────────────────────────────────────────────

DROP POLICY IF EXISTS "Anyone reads non-expired stories" ON public.stories;
CREATE POLICY "Authorized users read visible stories"
  ON public.stories FOR SELECT
  USING (public.can_view_story(id));

DROP POLICY IF EXISTS "Anyone reads slides of visible stories" ON public.story_slides;
CREATE POLICY "Authorized users read visible story slides"
  ON public.story_slides FOR SELECT
  USING (public.can_view_story(story_id));

-- ─── View recording ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Viewers insert own story views" ON public.story_item_views;
CREATE POLICY "Viewers insert own story views"
  ON public.story_item_views FOR INSERT
  WITH CHECK (
    viewer_id = auth.uid()
    AND public.can_view_story(story_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.stories s
      WHERE s.id = story_id AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Viewers insert own slide views" ON public.story_slide_views;
CREATE POLICY "Viewers insert own slide views"
  ON public.story_slide_views FOR INSERT
  WITH CHECK (
    viewer_id = auth.uid()
    AND public.can_view_story(story_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.stories s
      WHERE s.id = story_id AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users manage own story reactions" ON public.story_item_reactions;
CREATE POLICY "Users manage own story reactions"
  ON public.story_item_reactions FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND public.can_view_story(story_id)
  );

-- ─── Story replies (DM messages) ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.enforce_story_reply_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.story_reply_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT public.can_reply_to_story(NEW.story_reply_id) THEN
    RAISE EXCEPTION 'Story replies are not allowed';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_story_reply_access ON public.messages;
CREATE TRIGGER enforce_story_reply_access
  BEFORE INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_story_reply_access();

-- ─── Private stories bucket ─────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('stories', 'stories', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Users upload own story media" ON storage.objects;
CREATE POLICY "Users upload own story media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'stories'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users update own story media" ON storage.objects;
CREATE POLICY "Users update own story media"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'stories'
    AND split_part(name, '/', 1) = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'stories'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users delete own story media" ON storage.objects;
CREATE POLICY "Users delete own story media"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'stories'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

DROP POLICY IF EXISTS "Authorized users read story media" ON storage.objects;
CREATE POLICY "Authorized users read story media"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'stories'
    AND (
      split_part(name, '/', 1) = auth.uid()::text
      OR EXISTS (
        SELECT 1
        FROM public.story_slides ss
        WHERE ss.media_url = 'stories-private:' || name
          AND public.can_view_story(ss.story_id)
      )
    )
  );
