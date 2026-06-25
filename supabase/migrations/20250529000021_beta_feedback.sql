-- Beta feedback: bugs, feature requests, experience ratings

CREATE TABLE IF NOT EXISTS public.beta_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('bug', 'feature', 'rating')),
  message TEXT,
  rating INTEGER CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT beta_feedback_message_or_rating CHECK (
    (type = 'rating' AND rating IS NOT NULL)
    OR (type IN ('bug', 'feature') AND message IS NOT NULL AND length(trim(message)) > 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_beta_feedback_type ON public.beta_feedback(type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_status ON public.beta_feedback(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_user ON public.beta_feedback(user_id, created_at DESC);

ALTER TABLE public.beta_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users submit feedback" ON public.beta_feedback
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users view own feedback" ON public.beta_feedback
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins view all feedback" ON public.beta_feedback
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles admin WHERE admin.id = auth.uid() AND admin.is_admin = true)
  );

CREATE POLICY "Admins update feedback" ON public.beta_feedback
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles admin WHERE admin.id = auth.uid() AND admin.is_admin = true)
  );
