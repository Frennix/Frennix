import { useCallback, useEffect, useRef, useState } from "react";
import { confirmDismiss } from "@/lib/alerts";

const DISMISS_ANIMATION_MS = 280;

/**
 * Confirm → animate row out → remove from list.
 * Keeps confirmation while avoiding abrupt FlatList jumps.
 */
export function useDismissWithAnimation(onDismiss: (id: string) => void) {
  const [dismissingIds, setDismissingIds] = useState<Set<string>>(() => new Set());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const requestDismiss = useCallback(
    (id: string) => {
      confirmDismiss(() => {
        setDismissingIds((current) => {
          const next = new Set(current);
          next.add(id);
          return next;
        });

        const existing = timersRef.current.get(id);
        if (existing) clearTimeout(existing);

        const timer = setTimeout(() => {
          onDismiss(id);
          setDismissingIds((current) => {
            const next = new Set(current);
            next.delete(id);
            return next;
          });
          timersRef.current.delete(id);
        }, DISMISS_ANIMATION_MS);

        timersRef.current.set(id, timer);
      });
    },
    [onDismiss]
  );

  const isDismissing = useCallback((id: string) => dismissingIds.has(id), [dismissingIds]);

  return { requestDismiss, isDismissing };
}
