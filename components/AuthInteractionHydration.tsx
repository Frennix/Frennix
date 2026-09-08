import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/AuthProvider";
import {
  invalidateInteractionQueriesOnLogin,
  resetInteractionQueriesOnLogout,
} from "@/lib/auth-interaction-hydration";

/** Keep post/comment like state sourced from the database across logout and login. */
export function AuthInteractionHydration() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const previousUserIdRef = useRef<string | null>(null);
  const userId = session?.user.id ?? null;

  useEffect(() => {
    const previousUserId = previousUserIdRef.current;
    previousUserIdRef.current = userId;

    if (previousUserId && !userId) {
      resetInteractionQueriesOnLogout(queryClient, previousUserId);
      return;
    }

    if (!previousUserId && userId) {
      invalidateInteractionQueriesOnLogin(queryClient, userId);
    }
  }, [queryClient, userId]);

  return null;
}
