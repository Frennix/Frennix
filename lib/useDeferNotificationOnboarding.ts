import { useEffect } from "react";
import { setNotificationOnboardingBlocked } from "@/lib/notification-onboarding";

/** Suppress notification permission prompts while a sensitive flow is active. */
export function useDeferNotificationOnboarding() {
  useEffect(() => {
    setNotificationOnboardingBlocked(true);
    return () => setNotificationOnboardingBlocked(false);
  }, []);
}
