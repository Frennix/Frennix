-- Challenge-scoped posts for challenge feeds

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS challenge_id UUID REFERENCES public.challenges(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_posts_challenge ON public.posts(challenge_id);

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
  );
