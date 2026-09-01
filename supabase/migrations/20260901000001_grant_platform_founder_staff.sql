-- One-time repair: production had zero staff_memberships, so founder dashboard RPCs
-- (can_access_founder_dashboard / get_beta_metrics_dashboard) denied all users.
-- Safe guard: only runs when no active owner/founder exists yet.

DO $$
DECLARE
  v_founder_id UUID;
  v_has_founder BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.staff_memberships sm
    WHERE sm.revoked_at IS NULL
      AND sm.role IN ('owner', 'founder')
  ) INTO v_has_founder;

  IF v_has_founder THEN
    RETURN;
  END IF;

  SELECT p.id
  INTO v_founder_id
  FROM public.profiles p
  WHERE p.username = 'markeith'
  LIMIT 1;

  IF v_founder_id IS NULL THEN
    RAISE NOTICE 'grant_platform_founder_staff: markeith profile not found — skipped';
    RETURN;
  END IF;

  INSERT INTO public.staff_memberships (user_id, role, granted_at)
  VALUES (v_founder_id, 'founder'::public.staff_role, now())
  ON CONFLICT (user_id) DO UPDATE
    SET role = EXCLUDED.role,
        revoked_at = NULL,
        granted_at = EXCLUDED.granted_at;

  RAISE NOTICE 'grant_platform_founder_staff: granted founder staff to %', v_founder_id;
END;
$$;
