import type { Profile } from "@frennix/types";

export function getSupabaseErrorDetails(error: unknown): {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
} {
  if (error && typeof error === "object") {
    const supabaseError = error as {
      message?: unknown;
      code?: unknown;
      details?: unknown;
      hint?: unknown;
    };
    return {
      message: supabaseError.message ? String(supabaseError.message) : "Unknown error",
      code: supabaseError.code ? String(supabaseError.code) : undefined,
      details: supabaseError.details ? String(supabaseError.details) : undefined,
      hint: supabaseError.hint ? String(supabaseError.hint) : undefined,
    };
  }
  if (error instanceof Error) return { message: error.message };
  return { message: String(error) };
}

export function logProfileError(scope: string, error: unknown, context?: Record<string, unknown>) {
  console.error(`[profile] ${scope}`, { ...context, ...getSupabaseErrorDetails(error) });
}

export function getErrorMessage(error: unknown, fallback?: string): string {
  return getUserFriendlyErrorMessage(error, fallback);
}

/** Technical detail for logs only — never show in UI. */
export function getTechnicalErrorMessage(error: unknown): string {
  const { message, code, details, hint } = getSupabaseErrorDetails(error);
  return [message, code ? `code=${code}` : null, details ? `details=${details}` : null, hint ? `hint=${hint}` : null]
    .filter(Boolean)
    .join(" | ");
}

const USER_ERROR_FALLBACK = "Something went wrong. Please try again.";

const ERROR_CODE_MESSAGES: Record<string, string> = {
  invalid_credentials: "Invalid email or password.",
  email_not_confirmed: "Please confirm your email before signing in.",
  user_not_found: "We couldn't find an account with that email.",
  over_request_rate_limit: "Too many attempts. Please wait a moment and try again.",
  request_timeout: "The request timed out. Please try again.",
};

function looksTechnicalErrorMessage(message: string): boolean {
  return (
    /PGRST\d+/i.test(message) ||
    /postgres|supabase|row-level security|violates .* constraint/i.test(message) ||
    /\b(RLS|JWT|SQL|RPC)\b/i.test(message) ||
    /code=|details=|hint=/i.test(message) ||
    /TypeError|ReferenceError|SyntaxError/i.test(message) ||
    /undefined is not|cannot read propert/i.test(message) ||
    /ECONNREFUSED|ENOTFOUND/i.test(message)
  );
}

/** User-safe error copy — never exposes Postgres codes, stack fragments, or internal API details. */
export function getUserFriendlyErrorMessage(
  error: unknown,
  fallback: string = USER_ERROR_FALLBACK
): string {
  const { message, code } = getSupabaseErrorDetails(error);

  if (code && ERROR_CODE_MESSAGES[code]) {
    return ERROR_CODE_MESSAGES[code];
  }

  if (/invalid login credentials/i.test(message)) return "Invalid email or password.";
  if (/email not confirmed/i.test(message)) return "Please confirm your email before signing in.";
  if (/jwt expired|session expired/i.test(message)) return "Your session expired. Please sign in again.";
  if (/network request failed|failed to fetch/i.test(message)) {
    return "Network error. Check your connection and try again.";
  }
  if (/rate limit|too many requests/i.test(message)) {
    return "Too many attempts. Please wait a moment and try again.";
  }

  if (!message || looksTechnicalErrorMessage(message) || code) {
    return fallback;
  }

  if (message.length > 120) {
    return fallback;
  }

  return message;
}

export function formatSupabaseError(error: unknown, context: string): Error {
  logProfileError(context, error);
  const fallback =
    /post|share|upload/i.test(context)
      ? "We couldn't complete that action right now. Please try again in a few minutes."
      : context;
  return new Error(getUserFriendlyErrorMessage(error, fallback));
}

export function avatarDisplayUri(uri: string | null | undefined, version?: string | null) {
  if (!uri) return null;
  if (!version) return uri;
  const separator = uri.includes("?") ? "&" : "?";
  return `${uri}${separator}v=${encodeURIComponent(version)}`;
}

export async function readImageBytes(uri: string, file?: File | null): Promise<ArrayBuffer> {
  if (file) return file.arrayBuffer();

  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error(`Could not read image (${response.status})`);
  }
  return (await response.blob()).arrayBuffer();
}

export function normalizeImageExt(mimeType: string): string {
  const ext = mimeType.split("/")[1]?.toLowerCase() ?? "jpg";
  if (ext === "jpeg") return "jpg";
  if (ext === "png" || ext === "webp" || ext === "gif") return ext;
  return "jpg";
}
