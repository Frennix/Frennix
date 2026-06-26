-- Group management: owner delete + group reports

CREATE POLICY "Owners delete groups" ON public.groups
  FOR DELETE
  USING (owner_id = auth.uid());

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS reported_group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_reports_group ON public.reports(reported_group_id);
