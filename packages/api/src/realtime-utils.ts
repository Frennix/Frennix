import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabase } from "./supabase";

let realtimeChannelSeq = 0;

/**
 * Unique Realtime topic — Supabase returns an existing channel when the topic
 * matches, which causes "cannot add postgres_changes callbacks after subscribe()"
 * if a prior subscription is still active.
 */
export function allocRealtimeTopic(prefix: string, stableKey?: string): string {
  const seq = ++realtimeChannelSeq;
  return stableKey ? `${prefix}:${stableKey}:${seq}` : `${prefix}:${seq}`;
}

/** Remove a channel from the client (preferred cleanup). */
export async function removeRealtimeChannel(channel: RealtimeChannel | null | undefined): Promise<void> {
  if (!channel) return;
  try {
    await getSupabase().removeChannel(channel);
  } catch (error) {
    console.warn("[realtime] removeChannel failed", error);
  }
}

/** Sync teardown helper for React effect cleanups. */
export function teardownRealtimeChannel(channel: RealtimeChannel | null | undefined): void {
  if (!channel) return;
  try {
    channel.unsubscribe();
  } catch (error) {
    console.warn("[realtime] unsubscribe failed", error);
  }
  void removeRealtimeChannel(channel);
}

export type RealtimeSubscription = {
  channel: RealtimeChannel | null;
  unsubscribe: () => void;
};

/** Subscribe to postgres_changes on a fresh channel; returns null channel on failure. */
export function subscribePostgresChanges(
  topicPrefix: string,
  stableKey: string,
  bindings: Array<{
    config: {
      event: "*" | "INSERT" | "UPDATE" | "DELETE";
      schema: string;
      table: string;
      filter?: string;
    };
    callback: (payload: unknown) => void;
  }>
): RealtimeSubscription {
  const topic = allocRealtimeTopic(topicPrefix, stableKey);

  try {
    let channel = getSupabase().channel(topic);

    for (const binding of bindings) {
      channel = channel.on("postgres_changes", binding.config, binding.callback);
    }

    channel.subscribe();

    return {
      channel,
      unsubscribe: () => teardownRealtimeChannel(channel),
    };
  } catch (error) {
    console.warn(`[realtime] subscribe failed for ${topicPrefix}:${stableKey}`, error);
    return {
      channel: null,
      unsubscribe: () => undefined,
    };
  }
}
