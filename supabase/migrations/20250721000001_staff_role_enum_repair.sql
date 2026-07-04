-- Idempotent repair: seed owner capabilities if Migration B partially failed.
-- Enum value "owner" must already exist from 20250703000001 (Migration A).

CREATE TABLE IF NOT EXISTS public.staff_role_capabilities (
  role public.staff_role NOT NULL,
  capability TEXT NOT NULL,
  PRIMARY KEY (role, capability)
);

INSERT INTO public.staff_role_capabilities (role, capability)
VALUES
  ('owner', 'capability_access_dashboard'),
  ('owner', 'capability_manage_staff'),
  ('owner', 'capability_manage_flags'),
  ('owner', 'capability_manage_roadmap'),
  ('owner', 'capability_manage_releases'),
  ('owner', 'capability_manage_ambassadors'),
  ('owner', 'capability_moderate'),
  ('owner', 'capability_support'),
  ('owner', 'capability_view_executive'),
  ('owner', 'capability_view_community'),
  ('owner', 'capability_view_platform'),
  ('owner', 'capability_view_analytics'),
  ('owner', 'capability_view_activity'),
  ('owner', 'capability_view_inbox'),
  ('owner', 'capability_view_audit'),
  ('owner', 'capability_assign_owner')
ON CONFLICT DO NOTHING;
