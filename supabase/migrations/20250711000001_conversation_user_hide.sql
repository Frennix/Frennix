-- Per-user conversation hide (remove from inbox; reappears on newer messages).

CREATE TABLE IF NOT EXISTS public.conversation_user_hides (
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  hidden_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_user_hides_user
  ON public.conversation_user_hides (user_id);

ALTER TABLE public.conversation_user_hides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own conversation hides"
  ON public.conversation_user_hides
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Hide conversations for self"
  ON public.conversation_user_hides
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.conversation_members cm
      WHERE cm.conversation_id = conversation_id
        AND cm.user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.conversation_user_hides IS
  'Per-user conversation hide. Hidden conversations reappear when a newer message arrives.';
