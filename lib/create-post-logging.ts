import { Sentry } from "@/lib/sentry";

export type CreatePostLogPhase = "media_upload" | "post_save" | "navigation" | "draft";

export function logCreatePostError(
  phase: CreatePostLogPhase,
  error: unknown,
  extra?: Record<string, unknown>
) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[create-post:${phase}]`, message, extra ?? {});

  try {
    Sentry.captureException(error instanceof Error ? error : new Error(message), {
      extra: { phase, ...extra },
    });
  } catch {
    // Sentry may be unavailable in some environments.
  }
}

export function logCreatePostInfo(phase: CreatePostLogPhase, detail: string, extra?: Record<string, unknown>) {
  console.info(`[create-post:${phase}]`, detail, extra ?? {});
}
