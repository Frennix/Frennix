import { useEffect } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { attachPresenceLifecycle } from "@/lib/presence";

/** Mount once near the app root to sync online status with Supabase. */
export function PresenceCoordinator() {
  const { session, passwordRecovery } = useAuth();
  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) {
      console.info("[presence] PresenceCoordinator idle — no userId");
      return;
    }
    if (passwordRecovery) {
      console.info("[presence] PresenceCoordinator skipped — password recovery", { userId });
      return;
    }
    console.info("[presence] PresenceCoordinator attach", { userId });
    return attachPresenceLifecycle(userId);
  }, [userId, passwordRecovery]);

  return null;
}
