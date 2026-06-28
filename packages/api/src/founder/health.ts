import type {
  CommunityHealthDashboard,
  FounderAuditEntry,
  FounderPaginatedResult,
  PlatformBootstrapStatus,
  PlatformHealthDashboard,
  StaffInvite,
  StaffMember,
  StaffRole,
} from "@frennix/types";
import { formatSupabaseError } from "../profile-utils";
import { getSupabase } from "../supabase";

export async function canAccessFounderDashboard(): Promise<boolean> {
  const { data, error } = await getSupabase().rpc("can_access_founder_dashboard");
  if (error) {
    console.warn("[founder] can_access_founder_dashboard failed", error.message);
    return false;
  }
  return data === true;
}

export async function getPlatformBootstrapStatus(): Promise<PlatformBootstrapStatus> {
  const { data, error } = await getSupabase().rpc("get_platform_bootstrap_status");
  if (error) throw formatSupabaseError(error, "Failed to load bootstrap status");
  return data as PlatformBootstrapStatus;
}

export async function claimPlatformBootstrap(tokenHash: string): Promise<StaffRole> {
  const { data, error } = await getSupabase().rpc("claim_platform_bootstrap", {
    p_token_hash: tokenHash,
  });
  if (error) throw formatSupabaseError(error, "Failed to claim platform bootstrap");
  return data as StaffRole;
}

export async function revokeStaffMembership(userId: string): Promise<void> {
  const { error } = await getSupabase().rpc("revoke_staff_membership", {
    p_user_id: userId,
  });
  if (error) throw formatSupabaseError(error, "Failed to revoke staff membership");
}

export async function cancelStaffInvite(inviteId: string): Promise<void> {
  const { error } = await getSupabase().rpc("cancel_staff_invite", {
    p_invite_id: inviteId,
  });
  if (error) throw formatSupabaseError(error, "Failed to cancel invite");
}

export async function listStaffMembers(params?: {
  page?: number;
  pageSize?: number;
  search?: string;
}): Promise<FounderPaginatedResult<StaffMember>> {
  const { data, error } = await getSupabase().rpc("list_staff_members", {
    p_page: params?.page ?? 1,
    p_page_size: params?.pageSize ?? 25,
    p_search: params?.search ?? null,
  });
  if (error) throw formatSupabaseError(error, "Failed to list staff members");
  return data as FounderPaginatedResult<StaffMember>;
}

export async function listStaffInvites(params?: {
  page?: number;
  pageSize?: number;
}): Promise<FounderPaginatedResult<StaffInvite>> {
  const { data, error } = await getSupabase().rpc("list_staff_invites", {
    p_page: params?.page ?? 1,
    p_page_size: params?.pageSize ?? 25,
  });
  if (error) throw formatSupabaseError(error, "Failed to list staff invites");
  return data as FounderPaginatedResult<StaffInvite>;
}

export async function getFounderAuditLog(params?: {
  page?: number;
  pageSize?: number;
  search?: string;
}): Promise<FounderPaginatedResult<FounderAuditEntry>> {
  const { data, error } = await getSupabase().rpc("get_founder_audit_log", {
    p_page: params?.page ?? 1,
    p_page_size: params?.pageSize ?? 25,
    p_search: params?.search ?? null,
  });
  if (error) throw formatSupabaseError(error, "Failed to load audit log");
  return data as FounderPaginatedResult<FounderAuditEntry>;
}

export async function getCommunityHealth(days = 30): Promise<CommunityHealthDashboard> {
  const { data, error } = await getSupabase().rpc("get_community_health", {
    p_days: days,
  });
  if (error) throw formatSupabaseError(error, "Failed to load community health");
  return data as CommunityHealthDashboard;
}

export async function getPlatformHealth(): Promise<PlatformHealthDashboard> {
  const { data, error } = await getSupabase().rpc("get_platform_health");
  if (error) throw formatSupabaseError(error, "Failed to load platform health");
  return data as PlatformHealthDashboard;
}
