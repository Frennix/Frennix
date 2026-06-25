-- Fix infinite recursion (42P17) in profiles RLS policies.
-- Policies must not query public.profiles under RLS; use SECURITY DEFINER helpers instead.

CREATE OR REPLACE FUNCTION public.is_profile_banned(profile_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_banned FROM public.profiles WHERE id = profile_id),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_profile_banned(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO authenticated, anon;

DROP POLICY IF EXISTS "Public profiles are viewable" ON public.profiles;

CREATE POLICY "Public profiles are viewable" ON public.profiles
  FOR SELECT USING (
    id = auth.uid()
    OR public.is_current_user_admin()
    OR (
      NOT public.is_profile_banned(id)
      AND NOT public.users_are_blocked(auth.uid(), id)
      AND (
        visibility = 'public'
        OR (
          visibility = 'followers'
          AND EXISTS (
            SELECT 1
            FROM public.follows
            WHERE follower_id = auth.uid()
              AND following_id = profiles.id
          )
        )
      )
    )
  );

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Admins ban users" ON public.profiles;

CREATE POLICY "Admins ban users" ON public.profiles
  FOR UPDATE
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());
