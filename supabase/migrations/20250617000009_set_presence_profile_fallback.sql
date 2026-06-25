-- set_presence previously returned success even when no profiles row matched auth.uid().
-- Upsert a minimal profile from auth.users when missing, or raise a clear error.

DROP FUNCTION IF EXISTS public.set_presence(boolean);

CREATE FUNCTION public.set_presence(p_is_online boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_rows integer := 0;
  v_created boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.profiles
  SET
    is_online = p_is_online,
    last_seen_at = now(),
    updated_at = now()
  WHERE id = v_uid;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN
    INSERT INTO public.profiles (id, username, display_name, is_online, last_seen_at, updated_at)
    SELECT
      u.id,
      'user_' || substr(replace(u.id::text, '-', ''), 1, 8),
      COALESCE(u.raw_user_meta_data->>'display_name', 'Frennix User'),
      p_is_online,
      now(),
      now()
    FROM auth.users u
    WHERE u.id = v_uid
    ON CONFLICT (id) DO UPDATE SET
      is_online = EXCLUDED.is_online,
      last_seen_at = EXCLUDED.last_seen_at,
      updated_at = EXCLUDED.updated_at;

    GET DIAGNOSTICS v_rows = ROW_COUNT;

    IF v_rows = 0 THEN
      RAISE EXCEPTION
        'set_presence: no profiles row for auth.uid() % and no auth.users row to create one',
        v_uid;
    END IF;

    v_created := true;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'user_id', v_uid,
    'is_online', p_is_online,
    'created_profile', v_created,
    'rows_affected', v_rows
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_presence(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_presence(boolean) TO authenticated;
