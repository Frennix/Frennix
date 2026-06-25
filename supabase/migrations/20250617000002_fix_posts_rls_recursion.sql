-- Fix infinite recursion (42P17) in posts SELECT policy.
-- The policy queried public.posts from within its own RLS checks.

CREATE OR REPLACE FUNCTION public.is_post_visible_via_shared_wrapper(
  viewer_id UUID,
  shared_post_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.posts wrapper
    WHERE wrapper.shared_post_id = shared_post_id
      AND (
        wrapper.author_id = viewer_id
        OR EXISTS (
          SELECT 1
          FROM public.follows f
          WHERE f.follower_id = viewer_id
            AND f.following_id = wrapper.author_id
        )
        OR (
          wrapper.group_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.group_members gm
            JOIN public.groups g ON g.id = gm.group_id
            WHERE gm.group_id = wrapper.group_id
              AND (g.is_public OR gm.user_id = viewer_id)
          )
        )
        OR (
          wrapper.challenge_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.challenges c WHERE c.id = wrapper.challenge_id
          )
        )
        OR (
          wrapper.event_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.events e WHERE e.id = wrapper.event_id
          )
        )
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_post_visible_via_shared_wrapper(UUID, UUID) TO authenticated, anon;

DROP POLICY IF EXISTS "View posts from self, follows, or public groups" ON public.posts;

CREATE POLICY "View posts from self, follows, or public groups" ON public.posts
  FOR SELECT USING (
    NOT public.users_are_blocked(auth.uid(), author_id)
    AND NOT public.is_profile_banned(author_id)
    AND (
      author_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.follows
        WHERE follower_id = auth.uid()
          AND following_id = posts.author_id
      )
      OR (
        group_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.group_members gm
          JOIN public.groups g ON g.id = gm.group_id
          WHERE gm.group_id = posts.group_id
            AND (g.is_public OR gm.user_id = auth.uid())
        )
      )
      OR (
        challenge_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.challenges c WHERE c.id = posts.challenge_id
        )
      )
      OR (
        event_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.events e WHERE e.id = posts.event_id
        )
      )
      OR EXISTS (
        SELECT 1
        FROM public.messages m
        JOIN public.conversation_members cm ON cm.conversation_id = m.conversation_id
        WHERE m.post_id = posts.id
          AND cm.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.saved_posts sp
        WHERE sp.post_id = posts.id
          AND sp.user_id = auth.uid()
      )
      OR public.is_post_visible_via_shared_wrapper(auth.uid(), posts.id)
      OR public.is_current_user_admin()
    )
  );

DROP POLICY IF EXISTS "Admins delete posts" ON public.posts;

CREATE POLICY "Admins delete posts" ON public.posts
  FOR DELETE USING (public.is_current_user_admin());
