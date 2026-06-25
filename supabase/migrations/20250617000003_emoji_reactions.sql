-- Emoji reactions on posts and chat messages

CREATE TABLE IF NOT EXISTS public.post_reactions (
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL CHECK (emoji IN ('❤️', '😂', '🔥', '👏', '💪')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_reactions_post ON public.post_reactions(post_id);

CREATE TABLE IF NOT EXISTS public.message_reactions (
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL CHECK (emoji IN ('❤️', '😂', '🔥', '👏', '💪')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_message_reactions_message ON public.message_reactions(message_id);

ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View post reactions" ON public.post_reactions
  FOR SELECT USING (true);

CREATE POLICY "Create post reaction" ON public.post_reactions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Update own post reaction" ON public.post_reactions
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Delete own post reaction" ON public.post_reactions
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "View message reactions" ON public.message_reactions
  FOR SELECT USING (true);

CREATE POLICY "Create message reaction" ON public.message_reactions
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.messages m
      JOIN public.conversation_members cm ON cm.conversation_id = m.conversation_id
      WHERE m.id = message_id
        AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Update own message reaction" ON public.message_reactions
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Delete own message reaction" ON public.message_reactions
  FOR DELETE USING (user_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
