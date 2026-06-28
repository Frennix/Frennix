import { useLocalSearchParams } from "expo-router";
import Constants from "expo-constants";
import { Platform } from "react-native";
import type { FeedbackFeatureArea } from "@frennix/types";

function readBuildNumber(): string | null {
  const config = Constants.expoConfig;
  if (!config) return Constants.nativeBuildVersion ?? null;
  const iosBuild = config.ios?.buildNumber;
  const androidBuild = config.android?.versionCode;
  if (iosBuild) return String(iosBuild);
  if (androidBuild != null) return String(androidBuild);
  return Constants.nativeBuildVersion ?? null;
}

function readBrowser(): string | null {
  if (Platform.OS !== "web" || typeof navigator === "undefined") return null;
  return navigator.userAgent ?? null;
}

export function getFeedbackContext(screenPath?: string) {
  return {
    app_version: Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? null,
    platform: Platform.OS,
    screen_path: screenPath ?? null,
    os_version: Platform.Version != null ? String(Platform.Version) : null,
    browser: readBrowser(),
    build_number: readBuildNumber(),
  };
}

export function parseFeedbackArea(value: unknown): FeedbackFeatureArea {
  const areas: FeedbackFeatureArea[] = [
    "training_partners",
    "trainer_matching",
    "messages",
    "events",
    "notifications",
    "general",
  ];
  if (typeof value === "string" && areas.includes(value as FeedbackFeatureArea)) {
    return value as FeedbackFeatureArea;
  }
  return "general";
}

export function useFeedbackParams() {
  const params = useLocalSearchParams<{ area?: string; from?: string }>();
  const featureArea = parseFeedbackArea(params.area);
  const screenPath = typeof params.from === "string" ? params.from : null;
  return { featureArea, screenPath };
}

export function feedbackHref(area: FeedbackFeatureArea, from?: string) {
  const query = new URLSearchParams({ area });
  if (from) query.set("from", from);
  return `/beta-feedback?${query.toString()}`;
}
