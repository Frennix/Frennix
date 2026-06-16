import Constants from "expo-constants";

const extra = Constants.expoConfig?.extra ?? {};

export const config = {
  supabaseUrl: (extra.supabaseUrl as string) || process.env.EXPO_PUBLIC_SUPABASE_URL || "",
  supabaseAnonKey:
    (extra.supabaseAnonKey as string) || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "",
  sentryDsn: (extra.sentryDsn as string) || process.env.EXPO_PUBLIC_SENTRY_DSN || "",
  privacyPolicyUrl:
    (extra.privacyPolicyUrl as string) ||
    process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL ||
    "https://frennix.app/privacy",
  termsUrl:
    (extra.termsUrl as string) || process.env.EXPO_PUBLIC_TERMS_URL || "https://frennix.app/terms",
  appUrl:
    (extra.appUrl as string) || process.env.EXPO_PUBLIC_APP_URL || "https://frennix.vercel.app",
};

export function isSupabaseConfigured() {
  return Boolean(config.supabaseUrl && config.supabaseAnonKey);
}
