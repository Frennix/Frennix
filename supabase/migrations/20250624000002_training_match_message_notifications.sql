-- Phase 8: flag message notifications from training matches

CREATE OR REPLACE FUNCTION public.notify_on_message()
RETURNS TRIGGER AS $$
DECLARE
  member RECORD;
  v_from_training_match boolean;
  preview_text TEXT;
BEGIN
  preview_text := CASE
    WHEN NEW.post_id IS NOT NULL THEN 'Shared a post'
    ELSE left(NEW.content, 100)
  END;

  FOR member IN
    SELECT user_id FROM public.conversation_members
    WHERE conversation_id = NEW.conversation_id AND user_id != NEW.sender_id
  LOOP
    SELECT EXISTS (
      SELECT 1
      FROM public.matches m
      WHERE m.status = 'matched'
        AND m.user_a = LEAST(member.user_id, NEW.sender_id)
        AND m.user_b = GREATEST(member.user_id, NEW.sender_id)
    ) INTO v_from_training_match;

    INSERT INTO public.notifications (user_id, type, payload)
    VALUES (
      member.user_id,
      'message',
      jsonb_build_object(
        'conversation_id', NEW.conversation_id,
        'sender_id', NEW.sender_id,
        'preview', preview_text,
        'post_id', NEW.post_id,
        'from_training_match', v_from_training_match
      )
    );
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

UPDATE public.profiles
SET notification_preferences = COALESCE(notification_preferences, '{}'::jsonb) || '{"match": true}'::jsonb
WHERE NOT COALESCE(notification_preferences, '{}'::jsonb) ? 'match';
