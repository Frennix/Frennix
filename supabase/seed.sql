-- Demo seed data for local development
-- Run after migrations with: supabase db reset (local) or paste into SQL editor

-- Note: auth.users must exist first. Create test users via Supabase Auth dashboard,
-- then update the UUIDs below to match.

-- Example profile enrichment (replace UUIDs with your test user IDs):
-- UPDATE public.profiles SET
--   username = 'demo_runner',
--   display_name = 'Demo Runner',
--   bio = 'Training for my first marathon.',
--   fitness_goals = ARRAY['run_marathon', 'improve_endurance'],
--   activities = ARRAY['running', 'cycling'],
--   city = 'London',
--   onboarding_complete = true,
--   gender = 'female',
--   match_preference = 'any'
-- WHERE id = 'YOUR-USER-UUID';

INSERT INTO public.subscription_plans (name, price_cents, interval, active)
VALUES ('Frennix Premium', 999, 'month', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.products (name, description, price_cents, active)
VALUES ('Frennix Tee', 'Coming soon', 2999, false)
ON CONFLICT DO NOTHING;
