import type { QueryClient } from "@tanstack/react-query";

/** Invalidate feeds and profile content after blocking a user. */
export async function invalidateAfterBlock(queryClient: QueryClient, userId: string) {
  await queryClient.invalidateQueries({ queryKey: ["feed", userId] });
  await queryClient.invalidateQueries({ queryKey: ["user-posts"] });
}
