import { formatSupabaseError, getSupabaseErrorDetails } from "./profile-utils";
import { getSupabase } from "./supabase";

export const ACCOUNT_DELETION_INTACT_MESSAGE =
  "Your account was not deleted. Your posts, photos, and login are still there.";

export const ACCOUNT_DELETION_NOT_ENABLED_MESSAGE =
  "Account deletion is not enabled on the server yet. No account was deleted.";

export const ACCOUNT_DELETION_STORAGE_PENDING_MESSAGE =
  "Your account was deleted. Some uploaded files could not be removed yet.";

export const ACCOUNT_STORAGE_BUCKETS = [
  "avatars",
  "posts",
  "stories",
  "messages",
  "trainer-certifications",
  "trainer-portfolio",
  "feedback-attachments",
] as const;

export type DeleteOwnAccountResult = {
  ok: boolean;
  user_id?: string;
  account_deleted?: boolean;
  files_removed?: number;
  buckets_completed?: string[];
  buckets_failed?: string[];
  status?: string;
};

export function shouldAnnounceStoragePending(result: DeleteOwnAccountResult): boolean {
  return Boolean(result.account_deleted && result.status === "storage_pending");
}

/** Edge Functions without an application/json Content-Type arrive as text. */
export function parseDeleteOwnAccountResult(data: unknown): DeleteOwnAccountResult {
  let payload = data;
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch {
      return {};
    }
  }
  if (!payload || typeof payload !== "object") {
    return {};
  }
  return payload as DeleteOwnAccountResult;
}

function isMissingServerCapability(error: unknown): boolean {
  const { message, code } = getSupabaseErrorDetails(error);
  return (
    code === "PGRST202" ||
    /delete_own_account|delete-own-account|could not find the function|schema cache|not found|functions\/v1/i.test(
      message
    )
  );
}

/** Auth-only RPC. File cleanup is the trusted server process, not this client. */
export async function deleteOwnAuthUser(): Promise<{ ok: boolean; user_id?: string }> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("delete_own_account");
  if (error) {
    throw formatSupabaseError(
      error,
      isMissingServerCapability(error)
        ? ACCOUNT_DELETION_NOT_ENABLED_MESSAGE
        : ACCOUNT_DELETION_INTACT_MESSAGE
    );
  }
  return (data ?? {}) as { ok: boolean; user_id?: string };
}

export async function deleteOwnAccount(): Promise<DeleteOwnAccountResult> {
  const supabase = getSupabase();
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    throw formatSupabaseError(sessionError, ACCOUNT_DELETION_INTACT_MESSAGE);
  }
  if (!sessionData.session?.user.id) {
    throw new Error(ACCOUNT_DELETION_INTACT_MESSAGE);
  }

  const { data, error } = await supabase.functions.invoke("delete-own-account");
  const result = parseDeleteOwnAccountResult(data);
  if (result.account_deleted) {
    return result;
  }
  if (error) {
    throw formatSupabaseError(
      error,
      isMissingServerCapability(error)
        ? ACCOUNT_DELETION_NOT_ENABLED_MESSAGE
        : ACCOUNT_DELETION_INTACT_MESSAGE
    );
  }
  throw new Error(ACCOUNT_DELETION_INTACT_MESSAGE);
}
