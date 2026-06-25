import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;
let initializedUrl: string | null = null;

const detectSessionInUrl = typeof window !== "undefined";

export function initSupabase(url: string, anonKey: string) {
  if (client) return client;

  initializedUrl = url;
  client = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl,
    },
  });
  return client;
}

export function isSupabaseInitialized() {
  return client !== null;
}

export function getSupabase(): SupabaseClient {
  if (!client) {
    throw new Error("Supabase not initialized. Call initSupabase first.");
  }
  return client;
}

/** URL passed to initSupabase — the PostgREST base the client actually uses. */
export function getSupabaseInitUrl(): string | null {
  return initializedUrl;
}

export type Database = Record<string, unknown>;
