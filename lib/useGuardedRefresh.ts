import { useCallback, useRef } from "react";
import { getErrorMessage } from "@frennix/api";
import { showAlert } from "@/lib/alerts";

type GuardedRefreshOptions = {
  onError?: (error: unknown) => void;
  errorTitle?: string;
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
  }, [options.errorTitle, options.onError]);

  return onRefresh;
}
