-- Fix profile_for_viewer: show_online_status is NOT NULL on profiles.
-- Assigning NULL caused 42804 "Returned type profiles does not match expected"
-- in get_match_candidates and search_profiles (RETURN QUERY SETOF profiles).

CREATE OR REPLACE FUNCTION public.profile_for_viewer(
  p public.profiles,
  p_viewer_id uuid DEFAULT auth.uid()
)
RETURNS public.profiles
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  result public.profiles;
BEGIN
  result := p;
  result.is_online := public.profile_presence_is_online(
    p.id, p.is_online, p.show_online_status, p_viewer_id
  );
  result.last_seen_at := public.profile_presence_last_seen(
    p.id, p.last_seen_at, p.show_online_status, p_viewer_id
  );
  -- Mask privacy preference for other viewers without violating NOT NULL.
  IF p.id IS DISTINCT FROM p_viewer_id THEN
    result.show_online_status := true;
  END IF;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.profile_for_viewer(public.profiles, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile_for_viewer(public.profiles, uuid) TO authenticated;
