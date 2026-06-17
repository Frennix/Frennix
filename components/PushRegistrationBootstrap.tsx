import { useEffect } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { setupPushRegistration } from "@/lib/notifications";

export function PushRegistrationBootstrap() {
  const { session, passwordRecovery } = useAuth();
  const userId = session?.user.id ?? "";

  useEffect(() => {
    if (!userId || passwordRecovery) return;
    return setupPushRegistration(userId);
  }, [userId, passwordRecovery]);

  return null;
}
