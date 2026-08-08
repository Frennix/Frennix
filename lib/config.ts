import Constants from "expo-constants";
import { Platform } from "react-native";

const extra = Constants.expoConfig?.extra ?? {};

function readVapidPublicKeyFromDocument(): string {
  if (Platform.OS !== "web" || typeof document === "undefined") return "";
  return (
    document.querySelector('meta[name="frennix-vapid-public-key"]')?.getAttribute("content") ?? ""
  );
}

function resolveVapidPublicKey(): string {
  return (
    (extra.vapidPublicKey as string) ||
    process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY ||
    readVapidPublicKeyFromDocument() ||
    ""
  );
}

import { LEGAL_ROUTES } from "@/lib/legal/routes";

export const config = {
  supabaseUrl: (extra.supabaseUrl as string) || process.env.EXPO_PUBLIC_SUPABASE_URL || "",
  supabaseAnonKey:
    (extra.supabaseAnonKey as string) || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "",
  sentryDsn: (extra.sentryDsn as string) || process.env.EXPO_PUBLIC_SENTRY_DSN || "",
  privacyPolicyUrl: LEGAL_ROUTES.privacyPolicy,
  termsUrl: LEGAL_ROUTES.termsOfService,
  appUrl:
    (extra.appUrl as string) || process.env.EXPO_PUBLIC_APP_URL || "https://frennix.vercel.app",
  get vapidPublicKey() {
    return resolveVapidPublicKey();
  },
};

export function isSupabaseConfigured() {
  return Boolean(config.supabaseUrl && config.supabaseAnonKey);
}
