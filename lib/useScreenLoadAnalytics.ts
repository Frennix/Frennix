import { useEffect, useRef } from "react";
import { usePathname } from "expo-router";
import { trackScreenLoad } from "@/lib/product-analytics";

/** Records screen load duration once per route focus. */
export function useScreenLoadAnalytics(enabled = true) {
  const pathname = usePathname();
  const startedAtRef = useRef<number>(Date.now());
  const lastPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const now = Date.now();
    if (lastPathRef.current && lastPathRef.current !== pathname) {
      trackScreenLoad(lastPathRef.current, now - startedAtRef.current);
    }

    lastPathRef.current = pathname;
    startedAtRef.current = now;
  }, [pathname, enabled]);
}
