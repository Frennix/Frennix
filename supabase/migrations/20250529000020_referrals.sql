-- Invite friends & referral tracking

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON public.profiles(referral_code);

-- Backfill referral codes for existing profiles
UPDATE public.profiles
SET referral_code = lower(substr(replace(id::text, '-', ''), 1, 8))
WHERE referral_code IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN referral_code SET NOT NULL;

CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT AS $$
BEGIN
  RETURN lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, referral_code)
  VALUES (
    NEW.id,
    'user_' || substr(replace(NEW.id::text, '-', ''), 1, 8),
    COALESCE(NEW.raw_user_meta_data->>'display_name', 'Frennix User'),
    public.generate_referral_code()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (referred_id),
  CHECK (referrer_id != referred_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_id, created_at DESC);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own referrals as referrer" ON public.referrals
  FOR SELECT USING (referrer_id = auth.uid());

CREATE POLICY "View own referral record" ON public.referrals
  FOR SELECT USING (referred_id = auth.uid());

-- Claim referral once during onboarding (by referral code or username)
CREATE OR REPLACE FUNCTION public.claim_referral(referral_code_input TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  referrer UUID;
  normalized TEXT;
BEGIN
  normalized := lower(trim(referral_code_input));
  IF normalized = '' THEN
    RETURN false;
  END IF;

  SELECT id INTO referrer
  FROM public.profiles
  WHERE referral_code = normalized OR lower(username) = normalized
  LIMIT 1;

  IF referrer IS NULL OR referrer = auth.uid() THEN
    RETURN false;
  END IF;

  INSERT INTO public.referrals (referrer_id, referred_id)
  VALUES (referrer, auth.uid())
  ON CONFLICT (referred_id) DO NOTHING;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.claim_referral(TEXT) TO authenticated;
