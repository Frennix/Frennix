import Constants from "expo-constants";
import { Platform } from "react-native";
import { trackDailyActiveUser, trackProductEvent } from "@frennix/api";

export function getAnalyticsContext() {
  return {
    appVersion: Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? undefined,
    platform: Platform.OS,
  };
}

export function trackAnalyticsEvent(
  eventName: string,
  properties: Record<string, unknown> = {}
): void {
  void trackProductEvent(eventName, properties, getAnalyticsContext());
}

export function trackDailyActive(): void {
  void trackDailyActiveUser(getAnalyticsContext());
}

export function trackScreenLoad(screen: string, durationMs: number): void {
  trackAnalyticsEvent("perf_screen_load", { screen, duration_ms: Math.round(durationMs) });
}

export function trackFeedLoad(durationMs: number, postCount: number): void {
  trackAnalyticsEvent("perf_feed_load", {
    duration_ms: Math.round(durationMs),
    post_count: postCount,
  });
}

export function trackMessagingLoad(durationMs: number, conversationId: string, messageCount: number): void {
  trackAnalyticsEvent("perf_messaging_load", {
    duration_ms: Math.round(durationMs),
    conversation_id: conversationId,
    message_count: messageCount,
  });
}
