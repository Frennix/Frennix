-- Push notification preferences and challenge join notifications

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notification_preferences JSONB NOT NULL DEFAULT '{
    "follow": true,
    "like": true,
    "comment": true,
    "comment_reply": true,
    "message": true,
    "event_join": true,
    "challenge_join": true,
    "post_share": true
  }'::jsonb;

-- Notify challenge creator when someone joins
CREATE OR REPLACE FUNCTION public.notify_on_challenge_join()
RETURNS TRIGGER AS $$
DECLARE
  challenge_creator UUID;
  challenge_title TEXT;
BEGIN
  SELECT created_by, title INTO challenge_creator, challenge_title
  FROM public.challenges
  WHERE id = NEW.challenge_id;

  IF challenge_creator IS NOT NULL AND challenge_creator != NEW.user_id THEN
    INSERT INTO public.notifications (user_id, type, payload)
    VALUES (
      challenge_creator,
      'challenge_join',
      jsonb_build_object(
        'challenge_id', NEW.challenge_id,
        'user_id', NEW.user_id,
        'challenge_title', challenge_title
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_challenge_join_notify ON public.challenge_participants;
CREATE TRIGGER on_challenge_join_notify
  AFTER INSERT ON public.challenge_participants
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_challenge_join();
