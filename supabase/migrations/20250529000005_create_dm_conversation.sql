-- Atomically find or create a 1:1 DM conversation (bypasses RLS chicken-and-egg on insert).

CREATE OR REPLACE FUNCTION public.create_or_get_dm_conversation(user_a UUID, user_b UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conv_id UUID;
BEGIN
  IF user_a IS NULL OR user_b IS NULL THEN
    RAISE EXCEPTION 'Both user ids are required';
  END IF;

  IF user_a = user_b THEN
    RAISE EXCEPTION 'Cannot create a conversation with yourself';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = user_a) THEN
    RAISE EXCEPTION 'Current user profile not found';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = user_b) THEN
    RAISE EXCEPTION 'Target user profile not found';
  END IF;

  conv_id := public.get_dm_conversation(user_a, user_b);
  IF conv_id IS NOT NULL THEN
    RETURN conv_id;
  END IF;

  INSERT INTO public.conversations DEFAULT VALUES
  RETURNING id INTO conv_id;

  INSERT INTO public.conversation_members (conversation_id, user_id)
  VALUES (conv_id, user_a), (conv_id, user_b);

  RETURN conv_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_or_get_dm_conversation(UUID, UUID) TO authenticated;
