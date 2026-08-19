import { useIsFocused } from "@react-navigation/native";
import { useEffect, useState } from "react";
import { AppState, Platform } from "react-native";
import { setFeedVideoPlaybackAllowed } from "./feedVideoPlaybackCoordinator";

export type FeedVideoPlaybackGateProps = {
  /** True when story viewer, lightbox, or other full-screen overlay blocks feed playback. */
  overlaysBlocking?: boolean;
};

/** Syncs tab focus and app visibility with feed video playback — mount inside the feed route only. */
export function FeedVideoPlaybackGate({ overlaysBlocking = false }: FeedVideoPlaybackGateProps) {
  const isFocused = useIsFocused();
  const [appVisible, setAppVisible] = useState(true);

  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      const onVisibilityChange = () => {
        setAppVisible(document.visibilityState === "visible");
      };
      onVisibilityChange();
      document.addEventListener("visibilitychange", onVisibilityChange);
      return () => document.removeEventListener("visibilitychange", onVisibilityChange);
    }

    const subscription = AppState.addEventListener("change", (nextState) => {
      setAppVisible(nextState === "active");
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    setFeedVideoPlaybackAllowed(isFocused && appVisible && !overlaysBlocking);
  }, [isFocused, appVisible, overlaysBlocking]);

  return null;
}
