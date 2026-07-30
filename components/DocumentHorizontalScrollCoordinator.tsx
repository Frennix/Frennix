import { usePathname } from "expo-router";
import { useEffect } from "react";
import { scheduleDocumentHorizontalScrollReset } from "@/lib/document-horizontal-scroll";

/** Resets accidental horizontal document drift whenever the active route changes. */
export function DocumentHorizontalScrollCoordinator() {
  const pathname = usePathname();

  useEffect(() => {
    scheduleDocumentHorizontalScrollReset();
  }, [pathname]);

  return null;
}
