-- M7.3a / Migration A: Add staff_role enum values ONLY.
-- PostgreSQL forbids using a new enum value in the same transaction as
-- ALTER TYPE ... ADD VALUE (SQLSTATE 55P04). This file must NOT contain
-- any INSERT/UPDATE/SELECT that references the new values.
-- Migration B (20250703000002) inserts staff_role_capabilities.

ALTER TYPE public.staff_role ADD VALUE IF NOT EXISTS 'owner';
ALTER TYPE public.staff_role ADD VALUE IF NOT EXISTS 'ambassador_manager';
ALTER TYPE public.staff_role ADD VALUE IF NOT EXISTS 'content_manager';
ALTER TYPE public.staff_role ADD VALUE IF NOT EXISTS 'analyst';
