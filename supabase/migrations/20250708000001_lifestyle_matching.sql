-- Lifestyle Matching — optional profile fields for parents and schedule-aware discovery.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS parent_status text,
  ADD COLUMN IF NOT EXISTS parent_type text,
  ADD COLUMN IF NOT EXISTS children_age_groups text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS preferred_workout_times text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS kid_friendly_workouts boolean,
  ADD COLUMN IF NOT EXISTS looking_for_parent_partner boolean,
  ADD COLUMN IF NOT EXISTS lifestyle_tags text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.profiles.lifestyle_tags IS
  'Extensible lifestyle tags (college_student, shift_worker, …). Add via catalog — no per-tag columns.';

COMMENT ON COLUMN public.profiles.parent_status IS
  'Lifestyle Matching: parent | not_a_parent | prefer_not_to_say. Nullable — optional.';
COMMENT ON COLUMN public.profiles.parent_type IS
  'Lifestyle Matching: mom | dad | guardian. Nullable — optional.';
COMMENT ON COLUMN public.profiles.children_age_groups IS
  'Lifestyle Matching: infant, toddler, elementary, middle_school, teen, adult_children.';
COMMENT ON COLUMN public.profiles.preferred_workout_times IS
  'Lifestyle Matching: early_morning, mid_morning, lunch, afternoon, evening, after_kids_bedtime, weekends.';
COMMENT ON COLUMN public.profiles.kid_friendly_workouts IS
  'Lifestyle Matching: open to kid-friendly workouts. Nullable — optional.';
COMMENT ON COLUMN public.profiles.looking_for_parent_partner IS
  'Lifestyle Matching: seeking a parent training partner. Nullable — optional.';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_parent_status_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_parent_status_check
  CHECK (parent_status IS NULL OR parent_status IN ('parent', 'not_a_parent', 'prefer_not_to_say'));

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_parent_type_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_parent_type_check
  CHECK (parent_type IS NULL OR parent_type IN ('mom', 'dad', 'guardian'));

-- Expose lifestyle fields via profiles_reader (client read path).
DROP VIEW IF EXISTS public.profiles_reader;
CREATE VIEW public.profiles_reader
WITH (security_invoker = true)
AS
SELECT
  p.id,
  p.username,
  p.display_name,
  p.avatar_url,
  p.cover_image_url,
  p.bio,
  p.fitness_goals,
  p.activities,
  p.city,
  p.visibility,
  p.matching_enabled,
  p.gender,
  p.match_preference,
  p.is_premium,
  p.onboarding_complete,
  p.referral_code,
  p.notification_preferences,
  p.is_admin,
  p.is_trainer,
  p.is_banned,
  p.push_token,
  p.parent_status,
  p.parent_type,
  p.children_age_groups,
  p.preferred_workout_times,
  p.kid_friendly_workouts,
  p.looking_for_parent_partner,
  p.lifestyle_tags,
  p.created_at,
  p.updated_at,
  public.profile_presence_is_online(p.id, p.is_online, p.show_online_status, auth.uid()) AS is_online,
  public.profile_presence_last_seen(p.id, p.last_seen_at, p.show_online_status, auth.uid()) AS last_seen_at,
  CASE WHEN p.id = auth.uid() THEN p.show_online_status ELSE NULL END AS show_online_status
FROM public.profiles p;

GRANT SELECT ON public.profiles_reader TO authenticated;
GRANT SELECT ON public.profiles_reader TO anon;
