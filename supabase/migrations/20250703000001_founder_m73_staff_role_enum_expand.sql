-- M7.3a: Expand staff_role enum values.
-- Must run in its own migration — PostgreSQL forbids using new enum values
-- in the same transaction as ALTER TYPE ... ADD VALUE (SQLSTATE 55P04).

ALTER TYPE public.staff_role ADD VALUE IF NOT EXISTS 'owner';
ALTER TYPE public.staff_role ADD VALUE IF NOT EXISTS 'ambassador_manager';
ALTER TYPE public.staff_role ADD VALUE IF NOT EXISTS 'content_manager';
ALTER TYPE public.staff_role ADD VALUE IF NOT EXISTS 'analyst';
