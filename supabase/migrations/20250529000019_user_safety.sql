-- User safety: reports, blocks, admin moderation, banned users

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS reported_comment_id UUID REFERENCES public.comments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'reviewed', 'dismissed', 'action_taken')),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS admin_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_comment ON public.reports(reported_comment_id);

-- True when either user has blocked the other
CREATE OR REPLACE FUNCTION public.users_are_blocked(user_a UUID, user_b UUID)
RETURNS BOOLEAN AS $$
  SELECT user_a IS NOT NULL
    AND user_b IS NOT NULL
    AND user_a != user_b
    AND EXISTS (
      SELECT 1 FROM public.blocks
      WHERE (blocker_id = user_a AND blocked_id = user_b)
         OR (blocker_id = user_b AND blocked_id = user_a)
    );
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION public.is_profile_banned(profile_id UUID)
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT is_banned FROM public.profiles WHERE id = profile_id),
    false
  );
$$ LANGUAGE sql STABLE;

-- Unfollow both directions when someone is blocked
CREATE OR REPLACE FUNCTION public.handle_block()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.follows
  WHERE (follower_id = NEW.blocker_id AND following_id = NEW.blocked_id)
     OR (follower_id = NEW.blocked_id AND following_id = NEW.blocker_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_block_created ON public.blocks;
CREATE TRIGGER on_block_created
  AFTER INSERT ON public.blocks
  FOR EACH ROW EXECUTE FUNCTION public.handle_block();

-- Profiles: hide blocked users and banned profiles (except self / admins viewing)
DROP POLICY IF EXISTS "Public profiles are viewable" ON public.profiles;

CREATE POLICY "Public profiles are viewable" ON public.profiles
  FOR SELECT USING (
    id = auth.uid()
    OR (
      NOT public.is_profile_banned(id)
      AND NOT public.users_are_blocked(auth.uid(), id)
      AND (
        visibility = 'public'
        OR (visibility = 'followers' AND EXISTS (
          SELECT 1 FROM public.follows WHERE follower_id = auth.uid() AND following_id = profiles.id
        ))
      )
    )
    OR EXISTS (SELECT 1 FROM public.profiles admin WHERE admin.id = auth.uid() AND admin.is_admin = true)
  );

-- Posts: hide blocked authors and banned authors
DROP POLICY IF EXISTS "View posts from self, follows, or public groups" ON public.posts;

CREATE POLICY "View posts from self, follows, or public groups" ON public.posts
  FOR SELECT USING (
    NOT public.users_are_blocked(auth.uid(), author_id)
    AND NOT public.is_profile_banned(author_id)
    AND (
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
      OR EXISTS (SELECT 1 FROM public.profiles admin WHERE admin.id = auth.uid() AND admin.is_admin = true)
    )
  );

-- Comments: hide blocked authors
DROP POLICY IF EXISTS "View comments" ON public.comments;

CREATE POLICY "View comments" ON public.comments
  FOR SELECT USING (
    NOT public.users_are_blocked(auth.uid(), author_id)
    AND NOT public.is_profile_banned(author_id)
  );

-- Reports: admins can view and update; users see own submissions
DROP POLICY IF EXISTS "Create reports" ON public.reports;

CREATE POLICY "Create reports" ON public.reports
  FOR INSERT WITH CHECK (reporter_id = auth.uid());

CREATE POLICY "View own reports" ON public.reports
  FOR SELECT USING (
    reporter_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles admin WHERE admin.id = auth.uid() AND admin.is_admin = true)
  );

CREATE POLICY "Admins update reports" ON public.reports
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles admin WHERE admin.id = auth.uid() AND admin.is_admin = true)
  );

-- Admin content removal
CREATE POLICY "Admins delete posts" ON public.posts
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles admin WHERE admin.id = auth.uid() AND admin.is_admin = true)
  );

CREATE POLICY "Admins delete comments" ON public.comments
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles admin WHERE admin.id = auth.uid() AND admin.is_admin = true)
  );

CREATE POLICY "Admins ban users" ON public.profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles admin WHERE admin.id = auth.uid() AND admin.is_admin = true)
  );
