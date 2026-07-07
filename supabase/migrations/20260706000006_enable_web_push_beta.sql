-- Enable Web Push for beta iPhone testing + recipient-aware flag evaluation for dispatch.

-- 1. Recipient-aware flag check (edge function has no auth.uid())
CREATE OR REPLACE FUNCTION public.evaluate_feature_flag_for_user(p_key TEXT, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_flag public.feature_flags%ROWTYPE;
BEGIN
  SELECT * INTO v_flag FROM public.feature_flags WHERE key = p_key;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_flag.enabled_globally THEN
    RETURN true;
  END IF;

  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.feature_flag_overrides o
    WHERE o.flag_key = p_key
      AND o.target_type = 'user'
      AND o.target_value = p_user_id::text
      AND o.enabled = true
      AND (o.expires_at IS NULL OR o.expires_at > now())
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.evaluate_feature_flag_for_user(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.evaluate_feature_flag_for_user(TEXT, UUID) TO service_role;

-- 2. Beta launch: enable web push globally until cohort rollout is configured
UPDATE public.feature_flags
SET enabled_globally = true,
    updated_at = now()
WHERE key = 'web_push_notifications';
