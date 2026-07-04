import type {
  TrainingSessionInvite,
  TrainingSessionInviteStatus,
} from "@frennix/types";
import { getSupabase } from "./supabase";

export async function getPendingTrainingSessionInvites(
  userId: string
): Promise<TrainingSessionInvite[]> {
  const { data, error } = await getSupabase()
    .from("training_session_invites")
    .select(
      `
      *,
      session:training_calendar_items!training_session_invites_calendar_item_id_fkey(title, starts_at),
      inviter:profiles!training_session_invites_inviter_id_fkey(id, display_name, username, avatar_url)
    `
    )
    .eq("invitee_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => mapInviteRow(row as Record<string, unknown>));
}

export async function getTrainingSessionInvite(
  inviteId: string,
  userId: string
): Promise<TrainingSessionInvite | null> {
  const { data, error } = await getSupabase()
    .from("training_session_invites")
    .select(
      `
      *,
      session:training_calendar_items!training_session_invites_calendar_item_id_fkey(title, starts_at),
      inviter:profiles!training_session_invites_inviter_id_fkey(id, display_name, username, avatar_url)
    `
    )
    .eq("id", inviteId)
    .or(`invitee_id.eq.${userId},inviter_id.eq.${userId}`)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return mapInviteRow(data as Record<string, unknown>);
}

export async function getPendingInviteForCalendarItem(
  calendarItemId: string,
  inviteeId: string
): Promise<TrainingSessionInvite | null> {
  const { data, error } = await getSupabase()
    .from("training_session_invites")
    .select(
      `
      *,
      session:training_calendar_items!training_session_invites_calendar_item_id_fkey(title, starts_at),
      inviter:profiles!training_session_invites_inviter_id_fkey(id, display_name, username, avatar_url)
    `
    )
    .eq("calendar_item_id", calendarItemId)
    .eq("invitee_id", inviteeId)
    .eq("status", "pending")
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return mapInviteRow(data as Record<string, unknown>);
}

export async function respondTrainingSessionInvite(
  inviteId: string,
  inviteeId: string,
  status: Exclude<TrainingSessionInviteStatus, "pending">
): Promise<TrainingSessionInvite> {
  const { data, error } = await getSupabase()
    .from("training_session_invites")
    .update({
      status,
      responded_at: new Date().toISOString(),
    })
    .eq("id", inviteId)
    .eq("invitee_id", inviteeId)
    .select(
      `
      *,
      session:training_calendar_items!training_session_invites_calendar_item_id_fkey(title, starts_at),
      inviter:profiles!training_session_invites_inviter_id_fkey(id, display_name, username, avatar_url)
    `
    )
    .single();

  if (error) throw error;
  return mapInviteRow(data as Record<string, unknown>);
}

function mapInviteRow(row: Record<string, unknown>): TrainingSessionInvite {
  const session = row.session as Record<string, unknown> | null;
  const inviter = row.inviter as Record<string, unknown> | null;

  return {
    id: row.id as string,
    calendar_item_id: row.calendar_item_id as string,
    inviter_id: row.inviter_id as string,
    invitee_id: row.invitee_id as string,
    status: row.status as TrainingSessionInvite["status"],
    created_at: row.created_at as string,
    responded_at: (row.responded_at as string | null) ?? null,
    session_title: session ? (session.title as string) : undefined,
    session_starts_at: session ? (session.starts_at as string) : undefined,
    inviter: inviter
      ? {
          id: inviter.id as string,
          display_name: inviter.display_name as string,
          username: inviter.username as string,
          avatar_url: (inviter.avatar_url as string | null) ?? null,
        }
      : undefined,
  };
}
