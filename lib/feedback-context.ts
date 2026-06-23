import { useLocalSearchParams } from "expo-router";
import Constants from "expo-constants";
import { Platform } from "react-native";
import type { FeedbackFeatureArea } from "@frennix/types";

export function getFeedbackContext(screenPath?: string) {
  return {
    app_version: Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? null,
    platform: Platform.OS,
    screen_path: screenPath ?? null,
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
