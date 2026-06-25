-- Event invitations with in-app + push notification delivery

CREATE TABLE IF NOT EXISTS public.event_invitations (
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invitee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, invitee_id),
  CHECK (inviter_id != invitee_id)
);

CREATE INDEX IF NOT EXISTS idx_event_invitations_invitee ON public.event_invitations(invitee_id);

ALTER TABLE public.event_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own event invitations" ON public.event_invitations
  FOR SELECT USING (inviter_id = auth.uid() OR invitee_id = auth.uid());

CREATE POLICY "Create event invitations" ON public.event_invitations
  FOR INSERT WITH CHECK (inviter_id = auth.uid());

CREATE OR REPLACE FUNCTION public.notify_on_event_invite()
RETURNS TRIGGER AS $$
DECLARE
  event_title TEXT;
BEGIN
  SELECT title INTO event_title FROM public.events WHERE id = NEW.event_id;

  INSERT INTO public.notifications (user_id, type, payload)
  VALUES (
    NEW.invitee_id,
    'event_invite',
    jsonb_build_object(
      'event_id', NEW.event_id,
      'inviter_id', NEW.inviter_id,
      'event_title', event_title
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_event_invite_notify ON public.event_invitations;

CREATE TRIGGER on_event_invite_notify
  AFTER INSERT ON public.event_invitations
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_event_invite();

-- Store push preference for event invitations on profiles
UPDATE public.profiles
SET notification_preferences = COALESCE(notification_preferences, '{}'::jsonb)
  || jsonb_build_object('event_invite', true)
WHERE notification_preferences IS NULL
   OR NOT (notification_preferences ? 'event_invite');
