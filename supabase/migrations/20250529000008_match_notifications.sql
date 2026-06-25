-- Notify both users when a match becomes active

CREATE OR REPLACE FUNCTION public.notify_on_match()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'matched' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'matched') THEN
    INSERT INTO public.notifications (user_id, type, payload)
    VALUES (
      NEW.user_a,
      'match',
      jsonb_build_object('matched_user_id', NEW.user_b, 'match_id', NEW.id)
    );

    INSERT INTO public.notifications (user_id, type, payload)
    VALUES (
      NEW.user_b,
      'match',
      jsonb_build_object('matched_user_id', NEW.user_a, 'match_id', NEW.id)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_match_notify ON public.matches;

CREATE TRIGGER on_match_notify
  AFTER INSERT OR UPDATE OF status ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_match();
