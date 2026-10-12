import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type AuthStorage = {
  getItem: (key: string) => string | null | Promise<string | null>;
  setItem: (key: string, value: string) => void | Promise<void>;
  removeItem: (key: string) => void | Promise<void>;
};

export type InitSupabaseOptions = {
  storage?: AuthStorage;
  storageKey?: string;
  detectSessionInUrl?: boolean;
};

let client: SupabaseClient | null = null;
let initializedUrl: string | null = null;

export function initSupabase(url: string, anonKey: string, options?: InitSupabaseOptions) {
  if (client) return client;

  initializedUrl = url;
  client = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: options?.detectSessionInUrl ?? typeof window !== "undefined",
      ...(options?.storage ? { storage: options.storage } : {}),
      ...(options?.storageKey ? { storageKey: options.storageKey } : {}),
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
