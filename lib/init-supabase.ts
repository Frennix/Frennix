import { initSupabase, isSupabaseInitialized } from "@frennix/api";
import { config, isSupabaseConfigured } from "./config";

export function ensureSupabaseInitialized() {
  if (!isSupabaseConfigured() || isSupabaseInitialized()) return;
  initSupabase(config.supabaseUrl, config.supabaseAnonKey);
}

ensureSupabaseInitialized();
