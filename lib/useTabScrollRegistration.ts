import { useEffect, useRef } from "react";
import { registerTabScrollController, type TabScrollKey } from "@/lib/tab-scroll-registry";

/** Register a tab's scroll-to-top handler for bottom-nav re-tap behavior. */
export function useTabScrollRegistration(key: TabScrollKey, scrollToTop: () => void) {
  const scrollToTopRef = useRef(scrollToTop);
  scrollToTopRef.current = scrollToTop;

  useEffect(() => {
    return registerTabScrollController(key, {
      scrollToTop: () => scrollToTopRef.current(),
    });
  }, [key]);
}
