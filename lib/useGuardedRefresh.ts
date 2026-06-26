import { useCallback, useRef } from "react";
import { getErrorMessage } from "@frennix/api";
import { showAlert } from "@/lib/alerts";
import { hapticRefresh } from "@/lib/haptics";

type GuardedRefreshOptions = {
  onError?: (error: unknown) => void;
  errorTitle?: string;
  /** Trigger light haptic when pull-to-refresh starts. */
  haptic?: boolean;
};

/** Wraps pull-to-refresh so duplicate gestures are ignored and failures show a friendly alert. */
export function useGuardedRefresh(
  refreshFn: () => Promise<unknown>,
  options: GuardedRefreshOptions = {}
) {
  const inFlightRef = useRef(false);
  const refreshFnRef = useRef(refreshFn);
  refreshFnRef.current = refreshFn;

  const onRefresh = useCallback(async () => {
    if (inFlightRef.current) return;

    inFlightRef.current = true;
    if (options.haptic) hapticRefresh();
    try {
      await refreshFnRef.current();
    } catch (error) {
      if (options.onError) {
        options.onError(error);
      } else {
        showAlert(options.errorTitle ?? "Could not refresh", getErrorMessage(error));
      }
    } finally {
      inFlightRef.current = false;
    }
  }, [options.errorTitle, options.haptic, options.onError]);

  return onRefresh;
}
