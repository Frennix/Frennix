import type { Profile, Post, WorkoutEvent } from "@frennix/types";
import { enrichPostsWithInteractions } from "./posts";
import { formatSupabaseError } from "./profile-utils";
import { getSupabase } from "./supabase";

async function enrichEvents(events: WorkoutEvent[], userId: string): Promise<WorkoutEvent[]> {
  if (!events.length) return [];

  const eventIds = events.map((event) => event.id);

  const [{ data: attendees }, { data: myAttendees }] = await Promise.all([
    getSupabase().from("event_attendees").select("event_id").in("event_id", eventIds),
    getSupabase()
      .from("event_attendees")
      .select("event_id")
      .eq("user_id", userId)
      .in("event_id", eventIds),
  ]);

  const attendeeCounts = new Map<string, number>();
  for (const row of attendees ?? []) {
    attendeeCounts.set(row.event_id, (attendeeCounts.get(row.event_id) ?? 0) + 1);
  }

  const joinedSet = new Set((myAttendees ?? []).map((row) => row.event_id));

  return events.map((event) => {
    const count = attendeeCounts.get(event.id) ?? 0;
    const max = event.max_attendees;
    return {
      ...event,
      attendee_count: count,
      joined_by_me: joinedSet.has(event.id),
      is_full: max != null && count >= max,
    };
  });
}

export async function getWorkoutEvents(userId: string): Promise<WorkoutEvent[]> {
  const { data, error } = await getSupabase()
    .from("events")
    .select(`*, creator:profiles!events_created_by_fkey(*)`)
    .eq("status", "active")
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(50);

  if (error) {
    console.error("[events] getWorkoutEvents failed", error);
    throw formatSupabaseError(error, "Failed to load events");
  }

  const events = ((data ?? []) as WorkoutEvent[]).map((row) => ({
    ...row,
    creator: (row as WorkoutEvent & { creator?: Profile }).creator,
  }));

  return enrichEvents(events, userId);
}

export async function getWorkoutEvent(eventId: string, userId: string): Promise<WorkoutEvent | null> {
  const { data, error } = await getSupabase()
    .from("events")
    .select(`*, creator:profiles!events_created_by_fkey(*)`)
    .eq("id", eventId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const [enriched] = await enrichEvents([data as WorkoutEvent], userId);
  return enriched ?? null;
}

export async function createWorkoutEvent(input: {
  title: string;
  description?: string | null;
  workout_type?: string | null;
  starts_at: string;
  location?: string | null;
  max_attendees?: number | null;
  created_by: string;
}) {
  const { data, error } = await getSupabase()
    .from("events")
    .insert({
      title: input.title,
      description: input.description ?? null,
      workout_type: input.workout_type ?? null,
      starts_at: input.starts_at,
      location: input.location ?? null,
      max_attendees: input.max_attendees ?? null,
      created_by: input.created_by,
      status: "active",
    })
    .select(`*, creator:profiles!events_created_by_fkey(*)`)
    .single();

  if (error) throw formatSupabaseError(error, "Failed to create event");
  if (!data) throw new Error("Event created but no data returned");

  return data as WorkoutEvent;
}

export async function updateWorkoutEvent(
  eventId: string,
  userId: string,
  patch: {
    title?: string;
    description?: string | null;
    workout_type?: string | null;
    starts_at?: string;
    location?: string | null;
    max_attendees?: number | null;
  }
) {
  const { data, error } = await getSupabase()
    .from("events")
    .update(patch)
    .eq("id", eventId)
    .eq("created_by", userId)
    .eq("status", "active")
    .select(`*, creator:profiles!events_created_by_fkey(*)`)
    .single();

  if (error) throw formatSupabaseError(error, "Failed to update event");
  if (!data) throw new Error("Event update did not return a row");

  return data as WorkoutEvent;
}

export async function cancelWorkoutEvent(eventId: string, userId: string) {
  const { error } = await getSupabase()
    .from("events")
    .update({ status: "cancelled" })
    .eq("id", eventId)
    .eq("created_by", userId);

  if (error) throw formatSupabaseError(error, "Failed to cancel event");
}

export async function joinWorkoutEvent(eventId: string, userId: string) {
  const event = await getWorkoutEvent(eventId, userId);
  if (!event) throw new Error("Event not found");
  if (event.status === "cancelled") throw new Error("This event was cancelled");
  if (event.is_full && !event.joined_by_me) throw new Error("This event is full");

  const { error } = await getSupabase()
    .from("event_attendees")
    .insert({ event_id: eventId, user_id: userId });

  if (error) throw formatSupabaseError(error, "Failed to join event");
}

export async function leaveWorkoutEvent(eventId: string, userId: string) {
  const { error } = await getSupabase()
    .from("event_attendees")
    .delete()
    .eq("event_id", eventId)
    .eq("user_id", userId);

  if (error) throw formatSupabaseError(error, "Failed to leave event");
}

export async function inviteToWorkoutEvent(eventId: string, inviterId: string, inviteeId: string) {
  if (inviterId === inviteeId) throw new Error("You cannot invite yourself");

  const event = await getWorkoutEvent(eventId, inviterId);
  if (!event) throw new Error("Event not found");
  if (event.status === "cancelled") throw new Error("This event was cancelled");
  if (event.created_by !== inviterId) throw new Error("Only the event host can send invitations");

  const { error } = await getSupabase().from("event_invitations").insert({
    event_id: eventId,
    inviter_id: inviterId,
    invitee_id: inviteeId,
  });

  if (error) {
    if (error.code === "23505") throw new Error("This athlete was already invited");
    throw formatSupabaseError(error, "Failed to send invitation");
  }
}

export async function getEventInviteeIds(eventId: string, inviterId: string): Promise<string[]> {
  const { data, error } = await getSupabase()
    .from("event_invitations")
    .select("invitee_id")
    .eq("event_id", eventId)
    .eq("inviter_id", inviterId);

  if (error) throw error;
  return (data ?? []).map((row) => row.invitee_id as string);
}

export async function getEventAttendees(eventId: string): Promise<Profile[]> {
  const { data, error } = await getSupabase()
    .from("event_attendees")
    .select(`user:profiles!event_attendees_user_id_fkey(*)`)
    .eq("event_id", eventId)
    .order("joined_at", { ascending: true });

  if (error) throw error;

  return (data ?? [])
    .map((row) => {
      const user = (row as { user: unknown }).user;
      if (!user || typeof user !== "object" || Array.isArray(user)) return null;
      return user as Profile;
    })
    .filter((profile): profile is Profile => Boolean(profile));
}

export async function getEventPosts(eventId: string, viewerId?: string) {
  const { data, error } = await getSupabase()
    .from("posts")
    .select(`*, author:profiles!posts_author_id_fkey(*)`)
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const posts = (data ?? []) as Post[];
  if (viewerId) return enrichPostsWithInteractions(posts, viewerId);
  return posts;
}
