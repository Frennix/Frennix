// Edge Function: fan-out push notifications via Expo Push API
// Deploy with: supabase functions deploy send-push
// Wired via DB trigger dispatch_push_notification (pg_net) or Database Webhook on notifications INSERT

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

const DEFAULT_PREFERENCES = {
  follow: true,
  like: true,
  comment: true,
  comment_reply: true,
  message: true,
  match: true,
  trainer_connection_request: true,
  trainer_connection_accepted: true,
  event_join: true,
  event_invite: true,
  challenge_join: true,
  challenge_invite: true,
  post_share: true,
};

type PreferenceKey = keyof typeof DEFAULT_PREFERENCES;

function actorIdFromPayload(type: string, payload: Record<string, unknown>): string | null {
  switch (type) {
    case "follow":
      return (payload.follower_id as string) ?? null;
    case "like":
      return (payload.user_id as string) ?? null;
    case "reaction":
      return (payload.user_id as string) ?? null;
    case "comment":
    case "comment_reply":
      return (payload.author_id as string) ?? null;
    case "message":
      return (payload.sender_id as string) ?? null;
    case "match":
      return (payload.matched_user_id as string) ?? null;
    case "trainer_connection_request":
      return (payload.client_id as string) ?? null;
    case "trainer_connection_accepted":
      return (payload.trainer_id as string) ?? null;
    case "event_join":
    case "challenge_join":
      return (payload.user_id as string) ?? null;
    case "event_invite":
      return (payload.inviter_id as string) ?? null;
    case "challenge_invite":
      return (payload.inviter_id as string) ?? null;
    case "post_share":
      return (payload.sharer_id as string) ?? null;
    default:
      return null;
  }
}

function pushTitle(type: string, payload: Record<string, unknown>): string {
  switch (type) {
    case "message":
      return payload.from_training_match === true
        ? "Training partner message"
        : payload.from_trainer_connection === true
          ? "Coach message"
          : "New message";
    case "match":
      return "New Training Match";
    case "trainer_connection_request":
      return "New coaching request";
    case "trainer_connection_accepted":
      return "Coaching request accepted";
    case "follow":
      return "New follower";
    case "like":
      return "New like";
    case "reaction":
      return "New reaction";
    case "comment":
      return "New comment";
    case "comment_reply":
      return "New reply";
    case "event_join":
      return "Event join";
    case "event_invite":
      return "Event invitation";
    case "challenge_join":
      return "Challenge join";
    case "challenge_invite":
      return "Challenge invitation";
    case "post_share":
      return "Post shared";
    default:
      return "Frennix";
  }
}

function pushBody(
  type: string,
  payload: Record<string, unknown>,
  actorName: string
): string {
  switch (type) {
    case "message": {
      const preview = payload.preview as string | undefined;
      if (payload.from_training_match === true) {
        return preview
          ? `${actorName}: ${preview}`
          : `New message from training partner ${actorName}`;
      }
      if (payload.from_trainer_connection === true) {
        return preview
          ? `${actorName}: ${preview}`
          : `New message from coach ${actorName}`;
      }
      return preview ? `${actorName}: ${preview}` : `${actorName} sent you a message`;
    }
    case "match":
      return `You and ${actorName} are ready to train together.`;
    case "trainer_connection_request":
      return `${actorName} requested to connect for coaching.`;
    case "trainer_connection_accepted":
      return `${actorName} accepted your coaching request.`;
    case "follow":
      return `${actorName} started following you`;
    case "like":
      return `${actorName} liked your post`;
    case "reaction": {
      const emoji = (payload.emoji as string) ?? "😊";
      return `${actorName} reacted ${emoji} to your post`;
    }
    case "comment":
      return `${actorName} commented on your post`;
    case "comment_reply":
      return `${actorName} replied to your comment`;
    case "event_join": {
      const title = payload.event_title as string | undefined;
      return title
        ? `${actorName} joined your event "${title}"`
        : `${actorName} joined your workout event`;
    }
    case "event_invite": {
      const title = payload.event_title as string | undefined;
      return title
        ? `${actorName} invited you to "${title}"`
        : `${actorName} invited you to a workout event`;
    }
    case "challenge_join": {
      const title = payload.challenge_title as string | undefined;
      return title
        ? `${actorName} joined your challenge "${title}"`
        : `${actorName} joined your challenge`;
    }
    case "challenge_invite": {
      const title = payload.challenge_title as string | undefined;
      const username = payload.inviter_username as string | undefined;
      const who = username ? `@${username}` : actorName;
      return title
        ? `${who} invited you to join "${title}".`
        : `${who} invited you to join a challenge.`;
    }
    case "post_share": {
      const dest = payload.destination as string | undefined;
      const destName = payload.destination_name as string | undefined;
      if (dest === "message") return `${actorName} shared your post in a message`;
      if (destName) return `${actorName} shared your post in ${destName}`;
      return `${actorName} shared your post`;
    }
    default:
      return "You have a new notification";
  }
}

function isPushEnabled(
  type: string,
  preferences: Record<string, boolean> | null | undefined
): boolean {
  const preferenceKey = type === "reaction" ? "like" : type;
  if (!(preferenceKey in DEFAULT_PREFERENCES)) return true;
  const prefs = { ...DEFAULT_PREFERENCES, ...(preferences ?? {}) };
  return prefs[preferenceKey as PreferenceKey] !== false;
}

Deno.serve(async (req) => {
  try {
    const { record } = await req.json();
    if (!record?.user_id) {
      return new Response(JSON.stringify({ ok: true, skipped: true }), { status: 200 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: profile } = await supabase
      .from("profiles")
      .select("notification_preferences, push_token")
      .eq("id", record.user_id)
      .single();

    if (!isPushEnabled(record.type, profile?.notification_preferences)) {
      return new Response(JSON.stringify({ ok: true, skipped: "disabled" }), { status: 200 });
    }

    const { data: tokens } = await supabase
      .from("push_tokens")
      .select("expo_token, platform")
      .eq("user_id", record.user_id)
      .in("platform", ["ios", "android"]);

    let pushTokens = (tokens ?? []).map((t) => t.expo_token);

    if (!pushTokens.length && profile?.push_token) {
      pushTokens = [profile.push_token];
    }

    if (!pushTokens.length) {
      return new Response(JSON.stringify({ ok: true, no_token: true }), { status: 200 });
    }

    const payload = (record.payload ?? {}) as Record<string, unknown>;
    const actorId = actorIdFromPayload(record.type, payload);
    let actorName = "Someone";
    let actorUsername: string | null = null;

    if (actorId) {
      const { data: actor } = await supabase
        .from("profiles")
        .select("display_name, username")
        .eq("id", actorId)
        .maybeSingle();
      if (actor?.display_name) actorName = actor.display_name;
      if (actor?.username) actorUsername = actor.username;
    }

    const { count: unreadCount } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", record.user_id)
      .is("read_at", null);

    const title = pushTitle(record.type, payload);
    const body = pushBody(record.type, payload, actorName);

    const pushResponse = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(
        pushTokens.map((to) => ({
          to,
          title,
          body,
          sound: "default",
          badge: unreadCount ?? 1,
          priority: "high",
          channelId: "default",
          data: {
            ...payload,
            type: record.type,
            notification_id: record.id,
            actor_username: actorUsername,
          },
        }))
      ),
    });

    const pushResult = await pushResponse.json().catch(() => null);

    // Remove invalid Expo tokens so we stop sending to dead devices
    if (pushResult && typeof pushResult === "object" && "data" in pushResult) {
      const tickets = (pushResult as { data: Array<{ status: string; details?: { error?: string } }> }).data;
      for (let i = 0; i < tickets.length; i++) {
        const ticket = tickets[i];
        const token = pushTokens[i];
        if (
          token &&
          ticket?.status === "error" &&
          ticket.details?.error === "DeviceNotRegistered"
        ) {
          await supabase.from("push_tokens").delete().eq("expo_token", token);
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, pushResult }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
