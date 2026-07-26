import { useCallback, useEffect, useState } from "react";
import { shouldShowLocationFeedBanner } from "@frennix/api";
import type { Profile } from "@frennix/types";
import {
  dismissLocationFeedBanner,
  isLocationFeedBannerDismissed,
} from "@/lib/location-prompt-storage";

export function useLocationFeedBanner(profile: Profile | null | undefined) {
  const [dismissedLocal, setDismissedLocal] = useState<boolean | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const dismissed = await isLocationFeedBannerDismissed();
      if (!cancelled) {
        setDismissedLocal(dismissed);
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const showBanner =
    ready &&
    !dismissedLocal &&
    shouldShowLocationFeedBanner(profile);

  const dismissBanner = useCallback(async () => {
    await dismissLocationFeedBanner();
    setDismissedLocal(true);
  }, []);

  return { showLocationBanner: showBanner, dismissLocationBanner: dismissBanner };
}
