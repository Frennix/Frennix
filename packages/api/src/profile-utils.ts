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

export function getErrorMessage(error: unknown): string {
  const { message, code, details, hint } = getSupabaseErrorDetails(error);
  return [message, code ? `code=${code}` : null, details ? `details=${details}` : null, hint ? `hint=${hint}` : null]
    .filter(Boolean)
    .join(" | ");
}

export function formatSupabaseError(error: unknown, context: string): Error {
  if (error && typeof error === "object") {
    const supabaseError = error as {
      message?: string;
      code?: string;
      details?: string;
      hint?: string;
    };
    const parts = [
      context,
      supabaseError.message,
      supabaseError.code ? `code=${supabaseError.code}` : null,
      supabaseError.details ? `details=${supabaseError.details}` : null,
      supabaseError.hint ? `hint=${supabaseError.hint}` : null,
    ].filter(Boolean);
    return new Error(parts.join(" | "));
  }
  return new Error(context);
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
