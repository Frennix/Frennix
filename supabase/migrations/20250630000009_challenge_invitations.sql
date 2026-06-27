-- Challenge invitations: in-app + push notifications for inviting friends to a challenge.

CREATE TABLE IF NOT EXISTS public.challenge_invitations (
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invitee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (challenge_id, invitee_id, inviter_id),
  CHECK (inviter_id != invitee_id)
);

CREATE INDEX IF NOT EXISTS idx_challenge_invitations_invitee
  ON public.challenge_invitations(invitee_id);

CREATE INDEX IF NOT EXISTS idx_challenge_invitations_challenge
  ON public.challenge_invitations(challenge_id);

ALTER TABLE public.challenge_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own challenge invitations" ON public.challenge_invitations
  FOR SELECT USING (inviter_id = auth.uid() OR invitee_id = auth.uid());

CREATE POLICY "Create challenge invitations" ON public.challenge_invitations
  FOR INSERT WITH CHECK (
    inviter_id = auth.uid()
    AND inviter_id != invitee_id
    AND EXISTS (
      SELECT 1
      FROM public.challenges c
      WHERE c.id = challenge_id
        AND c.end_date > now()
    )
    AND NOT public.users_are_blocked(inviter_id, invitee_id)
  );

CREATE POLICY "Invitee can decline challenge invitation" ON public.challenge_invitations
  FOR UPDATE USING (invitee_id = auth.uid())
  WITH CHECK (invitee_id = auth.uid() AND status = 'declined');

CREATE OR REPLACE FUNCTION public.notify_on_challenge_invite()
RETURNS TRIGGER AS $$
DECLARE
  challenge_title TEXT;
  inviter_username TEXT;
BEGIN
  SELECT title INTO challenge_title FROM public.challenges WHERE id = NEW.challenge_id;
  SELECT username INTO inviter_username FROM public.profiles WHERE id = NEW.inviter_id;

  INSERT INTO public.notifications (user_id, type, payload)
  VALUES (
    NEW.invitee_id,
    'challenge_invite',
    jsonb_build_object(
      'challenge_id', NEW.challenge_id,
      'inviter_id', NEW.inviter_id,
      'inviter_username', inviter_username,
      'challenge_title', challenge_title
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_challenge_invite_notify ON public.challenge_invitations;

CREATE TRIGGER on_challenge_invite_notify
  AFTER INSERT ON public.challenge_invitations
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_challenge_invite();

UPDATE public.profiles
SET notification_preferences = COALESCE(notification_preferences, '{}'::jsonb)
  || jsonb_build_object('challenge_invite', true)
WHERE notification_preferences IS NULL
   OR NOT (notification_preferences ? 'challenge_invite');
