import { useEffect } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { attachPresenceLifecycle } from "@/lib/presence";

/** Mount once near the app root to sync online status with Supabase. */
export function PresenceCoordinator() {
  const { session, passwordRecovery } = useAuth();
  const userId = session?.user.id;

  useEffect(() => {
    if (!userId || passwordRecovery) return;
    return attachPresenceLifecycle(userId);
  }, [userId, passwordRecovery]);

  return null;
}
