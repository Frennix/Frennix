import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/AuthProvider";
import { resumeWebPushRegistrationIfNeeded } from "@/lib/web-push-auto-register";
import { showWebPushSuccessToast } from "@/components/WebPushSuccessToast";

/** Background push registration after sign-in or when permission is already granted. */
export function WebPushAutoRegistration() {
  const { session, authReady } = useAuth();
  const userId = session?.user.id ?? "";
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!authReady || !userId || Platform.OS !== "web") return;

    const onEnabled = () => showWebPushSuccessToast();

    void resumeWebPushRegistrationIfNeeded(userId, queryClient, onEnabled);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void resumeWebPushRegistrationIfNeeded(userId, queryClient, onEnabled);
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    const appStateSub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void resumeWebPushRegistrationIfNeeded(userId, queryClient, onEnabled);
      }
    });

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      appStateSub.remove();
    };
  }, [authReady, queryClient, userId]);

  return null;
}
