import { getSupabase } from "./supabase";

export function getAuthErrorDetails(error: unknown): {
  message: string;
  code?: string;
  status?: number;
} {
  if (error && typeof error === "object") {
    const authError = error as { message?: unknown; code?: unknown; status?: unknown };
    return {
      message: authError.message ? String(authError.message) : "Unknown auth error",
      code: authError.code ? String(authError.code) : undefined,
      status: typeof authError.status === "number" ? authError.status : undefined,
    };
  }
  if (error instanceof Error) return { message: error.message };
  return { message: String(error) };
}

export function logAuthError(scope: string, error: unknown) {
  const details = getAuthErrorDetails(error);
  console.error(`[auth] ${scope}`, details);
}

export function formatAuthErrorForDisplay(error: unknown): string {
  const { message, code } = getAuthErrorDetails(error);
  return code ? `${message} (${code})` : message;
}

export async function signInWithEmail(email: string, password: string) {
  console.info("[auth] signInWithPassword request", { email: email.trim() });
  const { data, error } = await getSupabase().auth.signInWithPassword({ email, password });
  if (error) {
    logAuthError("signInWithPassword failed", error);
    throw error;
  }
  console.info("[auth] signInWithPassword success", { userId: data.user?.id });
  return data;
}

export function formatLoginError(error: unknown): string {
  const { message, code } = getAuthErrorDetails(error);
  if (code === "email_not_confirmed") {
    return "Please confirm your email before signing in.";
  }
  if (code === "invalid_credentials") {
    return "Invalid email or password.";
  }
  if (message) return message;
  return "Sign in failed";
}

export async function signUpWithEmail(email: string, password: string) {
  const { data, error } = await getSupabase().auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await getSupabase().auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data, error } = await getSupabase().auth.getSession();
  if (error) throw error;
  return data.session;
}

export function onAuthStateChange(
  callback: (event: string, session: Awaited<ReturnType<typeof getSession>>) => void
) {
  return getSupabase().auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
}

export async function resetPasswordForEmail(email: string, redirectTo?: string) {
  const redirect = redirectTo ?? "frennix://reset-password";
  console.info("[password-reset] Requesting reset email", { redirectTo: redirect });

  const { error } = await getSupabase().auth.resetPasswordForEmail(email, {
    redirectTo: redirect,
  });

  if (error) {
    console.error("[password-reset] Failed", {
      message: error.message,
      status: error.status,
      code: "code" in error ? (error as { code?: string }).code : undefined,
    });
    throw error;
  }

  console.info("[password-reset] Reset email request accepted by Supabase");
}

export async function updatePassword(password: string) {
  console.info("[auth] updateUser password reset request");
  const { data, error } = await getSupabase().auth.updateUser({ password });
  if (error) {
    logAuthError("updateUser password reset failed", error);
    throw error;
  }
  console.info("[auth] updateUser password reset success", {
    userId: data.user?.id,
    emailConfirmedAt: data.user?.email_confirmed_at ?? null,
  });
  return data;
}

/** Cooldown after Supabase accepts a reset email request. */
export const PASSWORD_RESET_SUCCESS_COOLDOWN_SECONDS = 180;

function getAuthErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  if (error instanceof Error) return error.message;
  return String(error);
}

/** Extract seconds from Supabase auth rate-limit errors, e.g. "...after 45 seconds." */
export function parsePasswordResetCooldown(error: unknown): number | null {
  const message = getAuthErrorMessage(error);
  const secondsMatch = message.match(/after (\d+) seconds?/i);
  if (secondsMatch) return parseInt(secondsMatch[1], 10);

  const minutesMatch = message.match(/after (\d+) minutes?/i);
  if (minutesMatch) return parseInt(minutesMatch[1], 10) * 60;

  return null;
}

export function isPasswordResetRateLimited(error: unknown): boolean {
  const message = getAuthErrorMessage(error).toLowerCase();
  if (parsePasswordResetCooldown(error) !== null) return true;
  return (
    message.includes("rate limit") ||
    message.includes("too many") ||
    message.includes("email rate limit exceeded")
  );
}

export function resolvePasswordResetRateLimitCooldown(error: unknown): number {
  const explicit = parsePasswordResetCooldown(error);
  if (explicit !== null && explicit > 0) return explicit;
  return 0;
}

export function formatPasswordResetWaitMessage(remainingSeconds: number): string {
  if (remainingSeconds >= 60) {
    const minutes = Math.ceil(remainingSeconds / 60);
    return minutes === 1
      ? "Please wait 1 minute before requesting another reset email."
      : `Please wait ${minutes} minutes before requesting another reset email.`;
  }
  return `Please wait ${remainingSeconds} seconds before requesting another reset email.`;
}

export function formatPasswordResetError(error: unknown): string | null {
  if (isPasswordResetRateLimited(error)) {
    return "Too many reset requests were sent. Please wait a few minutes before trying again.";
  }
  const message = getAuthErrorMessage(error);
  if (!message) return "Could not send reset email. Please try again.";
  return message;
}
