-- Notify post authors when someone reacts to their post

CREATE OR REPLACE FUNCTION public.notify_on_post_reaction()
RETURNS TRIGGER AS $$
DECLARE
  post_author UUID;
BEGIN
  SELECT author_id INTO post_author FROM public.posts WHERE id = NEW.post_id;
  IF post_author IS NOT NULL AND post_author != NEW.user_id THEN
    INSERT INTO public.notifications (user_id, type, payload)
    VALUES (
      post_author,
      'reaction',
      jsonb_build_object(
        'post_id', NEW.post_id,
        'user_id', NEW.user_id,
        'emoji', NEW.emoji
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_post_reaction_notify ON public.post_reactions;

CREATE TRIGGER on_post_reaction_notify
  AFTER INSERT ON public.post_reactions
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_post_reaction();
