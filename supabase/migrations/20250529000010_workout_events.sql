-- Workout events: extended fields, attendees, notifications

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS workout_type TEXT,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS max_attendees INTEGER,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_status_check;
ALTER TABLE public.events
  ADD CONSTRAINT events_status_check CHECK (status IN ('active', 'cancelled'));

CREATE TABLE IF NOT EXISTS public.event_attendees (
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_attendees_user ON public.event_attendees(user_id);
CREATE INDEX IF NOT EXISTS idx_events_starts_at ON public.events(starts_at DESC);

DROP TRIGGER IF EXISTS events_updated_at ON public.events;
CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.event_attendees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View event attendees" ON public.event_attendees
  FOR SELECT USING (true);

CREATE POLICY "Join events" ON public.event_attendees
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Leave events" ON public.event_attendees
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "Update own events" ON public.events
  FOR UPDATE USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

CREATE OR REPLACE FUNCTION public.notify_on_event_join()
RETURNS TRIGGER AS $$
DECLARE
  event_creator UUID;
  event_title TEXT;
BEGIN
  SELECT created_by, title INTO event_creator, event_title
  FROM public.events
  WHERE id = NEW.event_id;

  IF event_creator IS NOT NULL AND event_creator != NEW.user_id THEN
    INSERT INTO public.notifications (user_id, type, payload)
    VALUES (
      event_creator,
      'event_join',
      jsonb_build_object(
        'event_id', NEW.event_id,
        'user_id', NEW.user_id,
        'event_title', event_title
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_event_join_notify ON public.event_attendees;

CREATE TRIGGER on_event_join_notify
  AFTER INSERT ON public.event_attendees
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_event_join();
