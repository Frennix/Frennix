import type { StaffCapability, StaffRole } from "@frennix/types";
import { formatSupabaseError } from "../profile-utils";
import { getSupabase } from "../supabase";

export {
  canAccessFounderDashboard,
  claimPlatformBootstrap,
  getPlatformBootstrapStatus,
  revokeStaffMembership,
  cancelStaffInvite,
  listStaffMembers,
  listStaffInvites,
  getFounderAuditLog,
} from "./health";

export async function getMyStaffRole(): Promise<StaffRole | null> {
  const { data, error } = await getSupabase().rpc("get_my_staff_role");
  if (error) {
    console.warn("[founder] get_my_staff_role failed", error.message);
    return null;
  }
  return (data as StaffRole | null) ?? null;
}

export async function hasStaffCapability(capability: StaffCapability): Promise<boolean> {
  const { data, error } = await getSupabase().rpc("has_staff_capability", {
    p_capability: capability,
  });
  if (error) {
    console.warn("[founder] has_staff_capability failed", error.message);
    return false;
  }
  return data === true;
}

export async function acceptStaffInvite(tokenHash: string): Promise<StaffRole> {
  const { data, error } = await getSupabase().rpc("accept_staff_invite", {
    p_token_hash: tokenHash,
  });
  if (error) throw formatSupabaseError(error, "Failed to accept staff invite");
  return data as StaffRole;
}

export async function createStaffInvite(
  email: string,
  role: StaffRole,
  tokenHash: string,
  expiresAt?: string
): Promise<string> {
  const { data, error } = await getSupabase().rpc("create_staff_invite", {
    p_email: email,
    p_role: role,
    p_token_hash: tokenHash,
    p_expires_at: expiresAt ?? null,
  });
  if (error) throw formatSupabaseError(error, "Failed to create staff invite");
  return data as string;
}
