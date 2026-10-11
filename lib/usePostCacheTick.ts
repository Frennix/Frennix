import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

/** Re-render immersive Reels chrome when like/reaction/comment caches change. */
export function usePostCacheTick(userId: string): number {
  const queryClient = useQueryClient();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!userId) return;
    return queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== "updated") return;
      const key = event.query.queryKey;
      if (key[0] === "reels" || key[0] === "feed" || key[0] === "post") {
        setTick((value) => value + 1);
      }
    });
  }, [queryClient, userId]);

  return tick;
}
