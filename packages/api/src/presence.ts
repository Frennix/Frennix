import { getSupabase, getSupabaseInitUrl } from "./supabase";

/** Frennix Production Supabase project (SQL Editor reference). */
const FRENNIX_PRODUCTION_SUPABASE_URL = "https://wkrwncovmpsveatlrqel.supabase.co";

/** Consider user online if flagged and seen within this window. */
export const PRESENCE_ONLINE_THRESHOLD_MS = 3 * 60 * 1000;

/** Heartbeat interval while app is active. */
export const PRESENCE_HEARTBEAT_MS = 60 * 1000;

export type SetPresenceResult = {
  ok: boolean;
  user_id: string;
  is_online: boolean;
  created_profile?: boolean;
  rows_affected?: number;
};

type VerifyProfileRow = {
  id: string;
  username: string;
  is_online: boolean | null;
  last_seen_at: string | null;
  updated_at: string | null;
};

/** Direct read from public.profiles — not the RPC return payload. */
async function readProfilePresenceRow(userId: string) {
  const { data, error } = await getSupabase()
    .from("profiles")
    .select("id, username, is_online, last_seen_at, updated_at")
    .eq("id", userId)
    .maybeSingle();

  return {
    row: (data ?? null) as VerifyProfileRow | null,
    error,
  };
}

function logSupabaseUrlComparison(context: string) {
  const expoPublicSupabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? null;
  const supabaseClientInitUrl = getSupabaseInitUrl();

  console.info("[presence:api] supabase URL comparison context", context);
  console.info("[presence:api] EXPO_PUBLIC_SUPABASE_URL", expoPublicSupabaseUrl);
  console.info("[presence:api] supabaseClientInitUrl", supabaseClientInitUrl);
  console.info(
    "[presence:api] FRENNIX_PRODUCTION_SUPABASE_URL",
    FRENNIX_PRODUCTION_SUPABASE_URL
  );
  console.info(
    "[presence:api] expoPublicMatchesClientInit",
    expoPublicSupabaseUrl === supabaseClientInitUrl
  );
  console.info(
    "[presence:api] clientInitMatchesProduction",
    supabaseClientInitUrl === FRENNIX_PRODUCTION_SUPABASE_URL
  );
  console.info(
    "[presence:api] expoPublicMatchesProduction",
    expoPublicSupabaseUrl === FRENNIX_PRODUCTION_SUPABASE_URL
  );
}

function logSetPresenceRpcResponse(
  isOnline: boolean,
  userId: string | null,
  rpcCompletedAt: string,
  rpcResponse: {
    data: unknown;
    error: { message: string; code?: string; details?: string; hint?: string } | null;
    status?: number;
    statusText?: string;
    count?: number | null;
  },
  result: SetPresenceResult | null
) {
  console.info("[presence:api] rpc set_presence RESPONSE timestamp", rpcCompletedAt);
  console.info("[presence:api] rpc set_presence RESPONSE requestedOnline", isOnline);
  console.info("[presence:api] rpc set_presence RESPONSE userId", userId);
  console.info("[presence:api] rpc set_presence RESPONSE status", rpcResponse.status ?? null);
  console.info("[presence:api] rpc set_presence RESPONSE statusText", rpcResponse.statusText ?? null);
  console.info("[presence:api] rpc set_presence RESPONSE count", rpcResponse.count ?? null);
  console.info("[presence:api] rpc set_presence RESPONSE error", rpcResponse.error);
  console.info("[presence:api] rpc set_presence RESPONSE data", rpcResponse.data);
  console.info(
    "[presence:api] rpc set_presence RESPONSE dataJson",
    rpcResponse.data != null ? JSON.stringify(rpcResponse.data) : null
  );
  console.info("[presence:api] rpc set_presence RESULT rows_affected", result?.rows_affected ?? null);
  console.info("[presence:api] rpc set_presence RESULT ok", result?.ok ?? null);
  console.info("[presence:api] rpc set_presence RESULT user_id", result?.user_id ?? null);
  console.info("[presence:api] rpc set_presence RESULT is_online", result?.is_online ?? null);
  console.info(
    "[presence:api] rpc set_presence RESULT created_profile",
    result?.created_profile ?? null
  );
  console.info(
    "[presence:api] rpc set_presence RESULT fullJson",
    result ? JSON.stringify(result) : null
  );
  console.info(
    "[presence:api] rpc set_presence NOTE",
    "RESULT.is_online echoes p_is_online request param, not a SELECT from profiles"
  );
}

function logRpcRowComparison(
  requestedOnline: boolean,
  result: SetPresenceResult | null,
  row: VerifyProfileRow | null,
  readAt: string
) {
  console.info("[presence:api] rpc vs row comparison timestamp", readAt);
  console.info("[presence:api] rpc vs row comparison requestedOnline", requestedOnline);
  console.info("[presence:api] rpc vs row comparison rows_affected", result?.rows_affected ?? null);
  console.info("[presence:api] rpc vs row comparison rpcResultIsOnline", result?.is_online ?? null);
  console.info("[presence:api] rpc vs row comparison rowIsOnline", row?.is_online ?? null);
  console.info("[presence:api] rpc vs row comparison rowUpdatedAt", row?.updated_at ?? null);
  console.info(
    "[presence:api] rpc vs row comparison rowMatchesRequest",
    requestedOnline ? row?.is_online === true : row?.is_online === false
  );
}

function logVerifyProfileRowRaw(
  label: string,
  userId: string,
  verifiedAt: string,
  row: VerifyProfileRow | null,
  readError: { message: string; code?: string } | null
) {
  const rowJson = row ? JSON.stringify(row) : null;

  console.info("[presence:api]", label, "meta", {
    userId,
    verifiedAt,
    readError: readError
      ? { message: readError.message, code: readError.code ?? null }
      : null,
  });
  console.info("[presence:api]", label, "rowJson", rowJson);
  console.info("[presence:api]", label, "id", row?.id ?? null);
  console.info("[presence:api]", label, "username", row?.username ?? null);
  console.info("[presence:api]", label, "is_online", row?.is_online ?? null);
  console.info("[presence:api]", label, "last_seen_at", row?.last_seen_at ?? null);
  console.info("[presence:api]", label, "updated_at", row?.updated_at ?? null);
}

export async function setPresence(
  isOnline: boolean,
  callerReason?: string
): Promise<SetPresenceResult> {
  const supabase = getSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const userId = session?.user?.id ?? null;

  if (!isOnline) {
    console.warn("[PRESENCE FALSE]", {
      source: callerReason ?? "packages/api/src/presence.ts:setPresence.before-rpc",
      timestamp: new Date().toISOString(),
      stack: new Error().stack,
    });
  } else {
    console.info("[presence:api] rpc set_presence", { isOnline, userId });
  }

  const rpcStartedAt = new Date().toISOString();
  console.info("[presence:api] rpc set_presence REQUEST", {
    isOnline,
    userId,
    p_is_online: isOnline,
    startedAt: rpcStartedAt,
    callerReason: callerReason ?? null,
  });

  const rpcResponse = await supabase.rpc("set_presence", {
    p_is_online: isOnline,
  });
  const rpcCompletedAt = new Date().toISOString();

  const { data, error } = rpcResponse;

  if (error) {
    console.warn("[presence:api] rpc set_presence error", {
      isOnline,
      userId,
      startedAt: rpcStartedAt,
      completedAt: rpcCompletedAt,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      fullError: error,
    });
    throw error;
  }

  const result = (data ?? null) as SetPresenceResult | null;
  logSetPresenceRpcResponse(isOnline, userId, rpcCompletedAt, rpcResponse, result);

  if (result?.created_profile) {
    console.warn("[presence:api] created missing profiles row during set_presence", {
      userId: result.user_id,
      rows_affected: result.rows_affected ?? null,
    });
  }

  if (!userId) {
    return result ?? { ok: true, user_id: "", is_online: isOnline };
  }

  const postRpcReadAt = new Date().toISOString();
  const readImmediate = await readProfilePresenceRow(userId);
  logVerifyProfileRowRaw(
    "post-RPC read immediate public.profiles",
    userId,
    postRpcReadAt,
    readImmediate.row,
    readImmediate.error
  );
  logRpcRowComparison(isOnline, result, readImmediate.row, postRpcReadAt);

  logSupabaseUrlComparison("setPresence verify");

  const verifiedAt = new Date().toISOString();
  const read1 = await readProfilePresenceRow(userId);
  logVerifyProfileRowRaw(
    "verify read #1 public.profiles",
    userId,
    verifiedAt,
    read1.row,
    read1.error
  );
  logRpcRowComparison(isOnline, result, read1.row, verifiedAt);

  const read2 = await readProfilePresenceRow(userId);
  logVerifyProfileRowRaw(
    "verify read #2 public.profiles",
    userId,
    verifiedAt,
    read2.row,
    read2.error
  );
  logRpcRowComparison(isOnline, result, read2.row, verifiedAt);

  const profile = read2.row ?? read1.row ?? readImmediate.row;
  const profileError = read2.error ?? read1.error ?? readImmediate.error;

  if (profileError) {
    console.warn("[presence:api] verify profile read failed", {
      userId,
      verifiedAt,
      requestedOnline: isOnline,
      message: profileError.message,
      code: profileError.code,
      rpcResult: result,
    });
  } else if (!profile) {
    console.error("[presence:api] VERIFY FAILED — no profiles row for signed-in auth user", {
      userId,
      verifiedAt,
      requestedOnline: isOnline,
      rpcResult: result,
      hint: "Filter profiles.id = this userId in Supabase Table Editor",
    });
  } else {
    const rowOnline = profile.is_online === true;
    const rowHasLastSeen = Boolean(profile.last_seen_at);
    const matchesRequest =
      isOnline ? rowOnline && rowHasLastSeen : profile.is_online === false;

    if (matchesRequest) {
      console.info("[presence:api] verify OK — profiles row matches request", {
        userId,
        verifiedAt,
        requestedOnline: isOnline,
        rpcResultIsOnline: result?.is_online ?? null,
        rpcRowsAffected: result?.rows_affected ?? null,
        readImmediateIsOnline: readImmediate.row?.is_online ?? null,
        read1IsOnline: read1.row?.is_online ?? null,
        read2IsOnline: read2.row?.is_online ?? null,
      });
    } else {
      console.error("[presence:api] VERIFY FAILED — profiles row does not match request", {
        userId,
        verifiedAt,
        requestedOnline: isOnline,
        rpcResultIsOnline: result?.is_online ?? null,
        rowOnline,
        rowHasLastSeen,
        profile: {
          id: profile.id,
          username: profile.username,
          is_online: profile.is_online,
          is_online_type: typeof profile.is_online,
          last_seen_at: profile.last_seen_at,
          updated_at: profile.updated_at,
        },
        read1: read1.row,
        read2: read2.row,
        readImmediate: readImmediate.row,
        rpcResult: result,
        rpcRowsAffected: result?.rows_affected ?? null,
        hint:
          "rpcResult.is_online is the request echo. Compare profile.is_online to SQL editor.",
      });
    }
  }

  return result ?? { ok: true, user_id: userId, is_online: isOnline };
}

export type PresenceFields = {
  is_online?: boolean | null;
  last_seen_at?: string | null;
};

export function isUserOnline(
  profile: (PresenceFields & { show_online_status?: boolean | null }) | null | undefined,
  nowMs = Date.now()
): boolean {
  if (profile?.show_online_status === false) return false;
  if (!profile?.last_seen_at || !profile.is_online) return false;
  const seenMs = new Date(profile.last_seen_at).getTime();
  if (Number.isNaN(seenMs)) return false;
  return nowMs - seenMs <= PRESENCE_ONLINE_THRESHOLD_MS;
}

export type ProfilePresenceUpdate = {
  id: string;
  is_online: boolean;
  last_seen_at: string | null;
};

export function subscribeToProfilesPresence(
  profileIds: string[],
  onUpdate: (update: ProfilePresenceUpdate) => void
) {
  const uniqueIds = [...new Set(profileIds.filter(Boolean))];
  if (!uniqueIds.length) {
    return { unsubscribe: () => undefined };
  }

  const channelName = `presence:${uniqueIds.slice().sort().join("-").slice(0, 120)}`;
  let channel = getSupabase().channel(channelName);

  for (const profileId of uniqueIds) {
    channel = channel.on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "profiles",
        filter: `id=eq.${profileId}`,
      },
      (payload) => {
        const row = payload.new as Record<string, unknown>;
        if (typeof row.id !== "string") return;

        const showOnline =
          row.show_online_status == null ? true : row.show_online_status === true;

        onUpdate({
          id: row.id,
          is_online: showOnline && row.is_online === true,
          last_seen_at:
            showOnline && typeof row.last_seen_at === "string" ? row.last_seen_at : null,
        });
      }
    );
  }

  channel.subscribe();

  return {
    unsubscribe: () => {
      void getSupabase().removeChannel(channel);
    },
  };
}
