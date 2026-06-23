import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "Frennix",
  slug: "frennix",
  version: "0.1.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  scheme: "frennix",
  userInterfaceStyle: "dark",
  newArchEnabled: true,
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#0A0A0B",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.frennix.app",
    usesAppleSignIn: true,
    infoPlist: {
      NSCameraUsageDescription:
        "Frennix needs camera access to share workout photos and videos.",
      NSPhotoLibraryUsageDescription:
        "Frennix needs photo library access to share workout content.",
      NSMicrophoneUsageDescription: "Frennix needs microphone access for workout videos.",
      UIBackgroundModes: ["remote-notification"],
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#0A0A0B",
    },
    package: "com.frennix.app",
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    [
      "expo-notifications",
      {
        icon: "./assets/brand/frennix-logo-icon.png",
        color: "#22C55E",
      },
    ],
    "expo-apple-authentication",
    [
      "@sentry/react-native/expo",
      {
        organization: "frennix",
        project: "frennix-mobile",
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    router: { origin: false },
    eas: {
      projectId: "7910ebf1-56ce-4fa0-9777-6c88602c89c6",
    },
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
    sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? "",
    privacyPolicyUrl: process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL ?? "https://frennix.app/privacy",
    termsUrl: process.env.EXPO_PUBLIC_TERMS_URL ?? "https://frennix.app/terms",
    appUrl: process.env.EXPO_PUBLIC_APP_URL ?? "https://frennix.vercel.app",
  },
};

export default config;
