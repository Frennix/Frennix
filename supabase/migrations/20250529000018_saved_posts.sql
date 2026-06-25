-- Saved posts (bookmarks)

CREATE TABLE IF NOT EXISTS public.saved_posts (
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_posts_user ON public.saved_posts(user_id, created_at DESC);

ALTER TABLE public.saved_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own saved posts" ON public.saved_posts
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Save post" ON public.saved_posts
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Unsave own post" ON public.saved_posts
  FOR DELETE USING (user_id = auth.uid());

-- Allow reading posts the user has saved
DROP POLICY IF EXISTS "View posts from self, follows, or public groups" ON public.posts;

CREATE POLICY "View posts from self, follows, or public groups" ON public.posts
  FOR SELECT USING (
    author_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.follows WHERE follower_id = auth.uid() AND following_id = posts.author_id)
    OR (group_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.group_members gm
      JOIN public.groups g ON g.id = gm.group_id
      WHERE gm.group_id = posts.group_id AND (g.is_public OR gm.user_id = auth.uid())
    ))
    OR (challenge_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.challenges c WHERE c.id = posts.challenge_id
    ))
    OR (event_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.events e WHERE e.id = posts.event_id
    ))
    OR EXISTS (
      SELECT 1 FROM public.messages m
      JOIN public.conversation_members cm ON cm.conversation_id = m.conversation_id
      WHERE m.post_id = posts.id AND cm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.saved_posts sp
      WHERE sp.post_id = posts.id AND sp.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.posts wrapper
      WHERE wrapper.shared_post_id = posts.id
      AND (
        wrapper.author_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.follows f
          WHERE f.follower_id = auth.uid() AND f.following_id = wrapper.author_id
        )
        OR (wrapper.group_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.group_members gm
          JOIN public.groups g ON g.id = gm.group_id
          WHERE gm.group_id = wrapper.group_id AND (g.is_public OR gm.user_id = auth.uid())
        ))
        OR (wrapper.challenge_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.challenges c WHERE c.id = wrapper.challenge_id
        ))
        OR (wrapper.event_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.events e WHERE e.id = wrapper.event_id
        ))
      )
    )
  );
