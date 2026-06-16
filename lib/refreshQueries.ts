import type { QueryClient } from "@tanstack/react-query";

export async function refetchQueryKeys(
  queryClient: QueryClient,
  queryKeys: readonly (readonly unknown[])[]
) {
  await Promise.all(queryKeys.map((key) => queryClient.refetchQueries({ queryKey: key })));
}
