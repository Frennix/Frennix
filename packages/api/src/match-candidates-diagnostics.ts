import { getSupabaseErrorDetails, getUserFriendlyErrorMessage } from "./profile-utils";

export type MatchCandidatesLoadStep =
  | "profiles_reader"
  | "get_match_candidates"
  | "unknown";

export type MatchCandidatesLoadDiagnostic = {
  step: MatchCandidatesLoadStep;
  httpStatus: number | null;
  supabaseCode: string | null;
  message: string;
  capturedAt: string;
};

export class MatchCandidatesLoadError extends Error {
  readonly diagnostic: MatchCandidatesLoadDiagnostic;

  constructor(diagnostic: MatchCandidatesLoadDiagnostic, userMessage: string) {
    super(userMessage);
    this.name = "MatchCandidatesLoadError";
    this.diagnostic = diagnostic;
  }
}

const UUID_PATTERN =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const COORD_PATTERN = /-?\d{1,3}\.\d{5,}/g;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

/** Strip IDs, coordinates, and emails from server messages before display. */
export function sanitizeMatchCandidatesDiagnosticMessage(message: string): string {
  return message
    .replace(UUID_PATTERN, "[redacted]")
    .replace(COORD_PATTERN, "[redacted]")
    .replace(EMAIL_PATTERN, "[redacted]")
    .trim();
}

function inferHttpStatus(error: unknown): number | null {
  if (error && typeof error === "object") {
    const candidate = error as { status?: unknown; code?: unknown };
    if (typeof candidate.status === "number" && Number.isFinite(candidate.status)) {
      return candidate.status;
    }

    const code = candidate.code ? String(candidate.code) : "";
    if (code === "PGRST301") return 401;
    if (code === "PGRST116") return 406;
    if (code === "PGRST202") return 404;
    if (code === "42501") return 403;
    if (code === "P0001") return 400;
    if (/^PGRST/.test(code)) return 400;
    if (/^\d{5}$/.test(code)) return 500;
  }
  return null;
}

export function buildMatchCandidatesLoadDiagnostic(
  step: MatchCandidatesLoadStep,
  cause: unknown
): MatchCandidatesLoadDiagnostic {
  const { message, code } = getSupabaseErrorDetails(cause);
  return {
    step,
    httpStatus: inferHttpStatus(cause),
    supabaseCode: code ?? null,
    message: sanitizeMatchCandidatesDiagnosticMessage(message || "Unknown error"),
    capturedAt: new Date().toISOString(),
  };
}

export function formatMatchCandidatesLoadDiagnosticText(
  diagnostic: MatchCandidatesLoadDiagnostic
): string {
  return [
    "Frennix Training Partners — load diagnostic",
    `captured_at: ${diagnostic.capturedAt}`,
    `failed_step: ${diagnostic.step}`,
    `http_status: ${diagnostic.httpStatus ?? "unknown"}`,
    `supabase_code: ${diagnostic.supabaseCode ?? "none"}`,
    `message: ${diagnostic.message}`,
  ].join("\n");
}

export function isMatchCandidatesLoadError(
  error: unknown
): error is MatchCandidatesLoadError {
  return error instanceof MatchCandidatesLoadError;
}

export function getMatchCandidatesLoadDiagnostic(
  error: unknown
): MatchCandidatesLoadDiagnostic | null {
  if (isMatchCandidatesLoadError(error)) return error.diagnostic;
  return null;
}

/** Structured diagnostic for wrapped or legacy/unclassified load errors. */
export function resolveMatchCandidatesLoadDiagnostic(
  error: unknown
): MatchCandidatesLoadDiagnostic | null {
  if (error == null) return null;
  return (
    getMatchCandidatesLoadDiagnostic(error) ??
    buildMatchCandidatesLoadDiagnostic("unknown", error)
  );
}

type CreateMatchCandidatesLoadErrorInput = {
  step: MatchCandidatesLoadStep;
  cause: unknown;
  userMessage?: string;
};

export function createMatchCandidatesLoadError({
  step,
  cause,
  userMessage,
}: CreateMatchCandidatesLoadErrorInput): MatchCandidatesLoadError {
  const diagnostic = buildMatchCandidatesLoadDiagnostic(step, cause);
  const fallback =
    step === "get_match_candidates"
      ? "Failed to load match candidates"
      : "Something went wrong. Please try again.";
  const message =
    userMessage ?? getUserFriendlyErrorMessage(cause, fallback);
  return new MatchCandidatesLoadError(diagnostic, message);
}
