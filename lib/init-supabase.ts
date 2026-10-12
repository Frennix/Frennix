import { Platform } from "react-native";
import { initSupabase, isSupabaseInitialized } from "@frennix/api";
import { config, isSupabaseConfigured } from "./config";
import { NATIVE_AUTH_STORAGE_KEY, nativeAuthStorage } from "./native-auth-storage";
import { markStartupMount } from "./startup-mount-trace";

markStartupMount("init-supabase:module", "sync");

const FRENNIX_PRODUCTION_SUPABASE_URL = "https://wkrwncovmpsveatlrqel.supabase.co";

function logSupabaseConfigAtInit() {
  console.info("[supabase:init] EXPO_PUBLIC_SUPABASE_URL", process.env.EXPO_PUBLIC_SUPABASE_URL ?? null);
  console.info("[supabase:init] config.supabaseUrl", config.supabaseUrl || null);
  console.info("[supabase:init] FRENNIX_PRODUCTION_SUPABASE_URL", FRENNIX_PRODUCTION_SUPABASE_URL);
  console.info(
    "[supabase:init] configMatchesProduction",
    config.supabaseUrl === FRENNIX_PRODUCTION_SUPABASE_URL
  );
  console.info(
    "[supabase:init] envMatchesProduction",
    process.env.EXPO_PUBLIC_SUPABASE_URL === FRENNIX_PRODUCTION_SUPABASE_URL
  );
}

export function ensureSupabaseInitialized() {
  if (!isSupabaseConfigured() || isSupabaseInitialized()) return;
  logSupabaseConfigAtInit();
  if (Platform.OS === "web") {
    initSupabase(config.supabaseUrl, config.supabaseAnonKey);
    return;
  }
  initSupabase(config.supabaseUrl, config.supabaseAnonKey, {
    storage: nativeAuthStorage,
    storageKey: NATIVE_AUTH_STORAGE_KEY,
    detectSessionInUrl: false,
  });
}

ensureSupabaseInitialized();
