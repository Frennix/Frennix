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

export function trackTabSwitch(tab: string, durationMs: number): void {
  trackAnalyticsEvent("perf_tab_switch", {
    tab,
    duration_ms: Math.round(durationMs),
  });
}

export function trackInteraction(name: string, durationMs: number, extra: Record<string, unknown> = {}): void {
  trackAnalyticsEvent("perf_interaction", {
    interaction: name,
    duration_ms: Math.round(durationMs),
    ...extra,
  });
}

export function trackImageLoad(uri: string, durationMs: number): void {
  trackAnalyticsEvent("perf_image_load", {
    duration_ms: Math.round(durationMs),
    uri_host: (() => {
      try {
        return new URL(uri).host;
      } catch {
        return "unknown";
      }
    })(),
  });
}

export function trackMessagingLoad(durationMs: number, conversationId: string, messageCount: number): void {
  trackAnalyticsEvent("perf_messaging_load", {
    duration_ms: Math.round(durationMs),
    conversation_id: conversationId,
    message_count: messageCount,
  });
}

export function trackMatchingDeckLoaded(durationMs: number, candidateCount: number): void {
  trackAnalyticsEvent("perf_matching_load", {
    duration_ms: Math.round(durationMs),
    candidate_count: candidateCount,
  });
}

export function trackMatchSkip(partnerId: string, deckRemaining: number): void {
  trackAnalyticsEvent("match_skip", { partner_id: partnerId, deck_remaining: deckRemaining });
}

export function trackMatchConnect(partnerId: string, isMutual: boolean, matchScore?: number): void {
  trackAnalyticsEvent("match_connect", {
    partner_id: partnerId,
    is_mutual: isMutual,
    match_score: matchScore ?? null,
  });
}

export function trackMatchDeckEmpty(): void {
  trackAnalyticsEvent("match_deck_empty", {});
}

export function trackMatchDeckLoaded(count: number): void {
  trackAnalyticsEvent("match_deck_loaded", { candidate_count: count });
}
