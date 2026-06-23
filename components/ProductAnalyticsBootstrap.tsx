import { useEffect } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useAuth } from "@/providers/AuthProvider";
import { trackDailyActive } from "@/lib/product-analytics";
import { useScreenLoadAnalytics } from "@/lib/useScreenLoadAnalytics";

/** Tracks daily active user + screen load performance for signed-in users. */
export function ProductAnalyticsBootstrap() {
  const { session } = useAuth();
  const userId = session?.user.id ?? "";

  useScreenLoadAnalytics(!!userId);

  useEffect(() => {
    if (!userId) return;

    trackDailyActive();

    function onAppStateChange(state: AppStateStatus) {
      if (state === "active") {
        trackDailyActive();
      }
    }

    const sub = AppState.addEventListener("change", onAppStateChange);
    return () => sub.remove();
  }, [userId]);

  return null;
}
