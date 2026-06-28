import { useQuery } from "@tanstack/react-query";
import { canAccessFounderDashboard, getMyStaffRole, hasStaffCapability } from "@frennix/api";
import type { StaffCapability, StaffRole } from "@frennix/types";
import { useAuth } from "@/providers/AuthProvider";

export function useStaffAccess() {
  const { session } = useAuth();
  const userId = session?.user.id ?? "";

  const roleQuery = useQuery({
    queryKey: ["staff-role", userId],
    queryFn: getMyStaffRole,
    enabled: !!userId,
    staleTime: 60_000,
  });

  const accessQuery = useQuery({
    queryKey: ["founder-dashboard-access", userId],
    queryFn: canAccessFounderDashboard,
    enabled: !!userId,
    staleTime: 60_000,
  });

  const role = roleQuery.data ?? null;
  const canAccessDashboard = accessQuery.data === true;
  const isStaff = Boolean(role) || canAccessDashboard;

  return {
    role,
    isStaff,
    canAccessDashboard,
    isLoading: roleQuery.isLoading || accessQuery.isLoading,
    refetch: async () => {
      await Promise.all([roleQuery.refetch(), accessQuery.refetch()]);
    },
  };
}

export function useStaffCapability(capability: StaffCapability) {
  const { session } = useAuth();
  const userId = session?.user.id ?? "";

  const query = useQuery({
    queryKey: ["staff-capability", userId, capability],
    queryFn: () => hasStaffCapability(capability),
    enabled: !!userId,
    staleTime: 60_000,
  });

  return {
    allowed: query.data === true,
    isLoading: query.isLoading,
  };
}

const ROLE_LABELS: Record<StaffRole, string> = {
  owner: "Owner",
  founder: "Founder",
  admin: "Admin",
  moderator: "Moderator",
  support: "Support",
  ambassador_manager: "Ambassador Manager",
  content_manager: "Content Manager",
  analyst: "Analyst",
};

export function formatStaffRole(role: StaffRole | null): string {
  if (!role) return "Staff";
  return ROLE_LABELS[role] ?? role;
}
