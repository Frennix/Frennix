-- P1: Feature flag evaluation for training matchmaking kill switch.

INSERT INTO public.feature_flags (key, name, description, milestone_code, enabled_globally)
VALUES (
  'training_matchmaking',
  'Training Partner Matchmaking',
  'Global kill switch for training partner discovery (P1)',
  'P1',
  true
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  milestone_code = EXCLUDED.milestone_code;

CREATE OR REPLACE FUNCTION public.evaluate_feature_flag(p_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_flag public.feature_flags%ROWTYPE;
  v_user UUID := auth.uid();
BEGIN
  SELECT * INTO v_flag FROM public.feature_flags WHERE key = p_key;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_flag.enabled_globally THEN
    RETURN true;
  END IF;

  IF v_user IS NOT NULL THEN
    RETURN EXISTS (
      SELECT 1 FROM public.feature_flag_overrides o
      WHERE o.flag_key = p_key
        AND o.target_type = 'user'
        AND o.target_value = v_user::text
        AND o.enabled = true
        AND (o.expires_at IS NULL OR o.expires_at > now())
    );
  END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.evaluate_feature_flag(TEXT) TO authenticated;

-- Allow authenticated users to read global flag state (enabled_globally only).
DROP POLICY IF EXISTS "Authenticated read flag enabled state" ON public.feature_flags;
CREATE POLICY "Authenticated read flag enabled state" ON public.feature_flags
  FOR SELECT TO authenticated
  USING (true);
