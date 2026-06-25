-- Allow profile inserts (e.g. onboarding fallback) without an explicit referral_code.
ALTER TABLE public.profiles
  ALTER COLUMN referral_code SET DEFAULT public.generate_referral_code();
