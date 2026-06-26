-- Event reports for moderation

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS reported_event_id UUID REFERENCES public.events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_reports_event ON public.reports(reported_event_id);
