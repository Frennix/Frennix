-- Online presence: last_seen_at + is_online on profiles.
-- Clients call set_presence() so only auth.uid() row is updated (presence fields only).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_online BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_profiles_presence
  ON public.profiles (is_online, last_seen_at DESC)
  WHERE is_online = true;

COMMENT ON COLUMN public.profiles.last_seen_at IS 'UTC timestamp of last app activity heartbeat';
COMMENT ON COLUMN public.profiles.is_online IS 'True while app is foreground; cleared on background/sign-out';

CREATE OR REPLACE FUNCTION public.set_presence(p_is_online boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.profiles
  SET
    is_online = p_is_online,
    last_seen_at = now(),
    updated_at = now()
  WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.set_presence(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_presence(boolean) TO authenticated;
