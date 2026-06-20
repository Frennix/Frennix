import { useEffect } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { attachPresenceLifecycle } from "@/lib/presence";

/** Mount once near the app root to sync online status with Supabase. */
export function PresenceCoordinator() {
  const { session, loading, passwordRecovery } = useAuth();
  const userId = session?.user.id;

  useEffect(() => {
    if (loading || !userId || passwordRecovery) return;
    return attachPresenceLifecycle(userId);
  }, [loading, userId, passwordRecovery]);

  return null;
}
