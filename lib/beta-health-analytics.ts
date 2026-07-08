import { trackAnalyticsEvent } from "@/lib/product-analytics";

/** Lightweight beta-health events — stored in existing product_events table. */
export function trackAuthLoginSuccess(): void {
  trackAnalyticsEvent("auth_login_success");
}

export function trackAuthLoginFailed(reason?: string): void {
  trackAnalyticsEvent("auth_login_failed", { reason: reason ?? "unknown" });
}

export function trackAppStartup(durationMs: number): void {
  trackAnalyticsEvent("perf_app_startup", { duration_ms: Math.round(durationMs) });
}

export function trackStartupStall(gap: string | null): void {
  trackAnalyticsEvent("startup_stall", { startup_gap: gap ?? "unknown" });
}

export function trackClientError(source: string, message: string): void {
  trackAnalyticsEvent("client_error", { source, message: message.slice(0, 500) });
}

export function trackApiRequestFailed(endpoint: string, status?: number, error?: string): void {
  trackAnalyticsEvent("api_request_failed", {
    endpoint: endpoint.slice(0, 200),
    status: status ?? null,
    error: error?.slice(0, 300) ?? null,
  });
}

export function trackPushRegistrationSuccess(channel: string): void {
  trackAnalyticsEvent("push_registration_success", { channel });
}

export function trackPushRegistrationFailed(reason: string): void {
  trackAnalyticsEvent("push_registration_failed", { reason });
}

export function trackUploadFailed(
  mediaType: "photo" | "video" | "story" | "image",
  phase: string,
  error?: string
): void {
  trackAnalyticsEvent("upload_failed", {
    media_type: mediaType,
    phase,
    error: error?.slice(0, 300) ?? null,
  });
}

export function trackMessageSendFailed(conversationId?: string, error?: string): void {
  trackAnalyticsEvent("message_send_failed", {
    conversation_id: conversationId ?? null,
    error: error?.slice(0, 300) ?? null,
  });
}

export function trackCommentFailed(postId?: string, error?: string): void {
  trackAnalyticsEvent("comment_failed", {
    post_id: postId ?? null,
    error: error?.slice(0, 300) ?? null,
  });
}

export function trackEventCreationFailed(error?: string): void {
  trackAnalyticsEvent("event_creation_failed", { error: error?.slice(0, 300) ?? null });
}
