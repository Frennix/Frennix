-- Challenge reports for moderation

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS reported_challenge_id UUID REFERENCES public.challenges(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_reports_challenge ON public.reports(reported_challenge_id);
