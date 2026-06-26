import { useCallback, useRef } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";

const DEFAULT_THRESHOLD = 8;

/** Track whether a scroll surface is at (or near) the top for tab re-tap refresh behavior. */
export function useScrollAtTop(threshold = DEFAULT_THRESHOLD) {
  const atTopRef = useRef(true);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      atTopRef.current = event.nativeEvent.contentOffset.y <= threshold;
    },
    [threshold]
  );

  const isAtTop = useCallback(() => atTopRef.current, []);

  const resetAtTop = useCallback(() => {
    atTopRef.current = true;
  }, []);

  return { onScroll, isAtTop, resetAtTop };
}
