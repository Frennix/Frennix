import type { Profile, WorkoutEvent } from "@frennix/types";
import { WORKOUT_INTERESTS } from "@frennix/types";
import { getBlockedIds } from "./moderation";
import { searchProfiles } from "./profiles";
import { getSupabase } from "./supabase";

export type FeedSearchWorkoutResult = {
  id: string;
  label: string;
  slug: string;
};

export type FeedSearchResults = {
  athletes: Profile[];
  workouts: FeedSearchWorkoutResult[];
  events: WorkoutEvent[];
};

function escapeIlike(value: string) {
  return value.replace(/[%_\\]/g, "\\$&");
}

function formatWorkoutLabel(slug: string) {
  return slug.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function collectWorkoutMatches(query: string, posts: { workout_types?: string[] | null; workout_type?: string | null }[]) {
  const needle = query.trim().toLowerCase();
  if (needle.length < 2) return [];

  const seen = new Set<string>();
  const results: FeedSearchWorkoutResult[] = [];

  const add = (slug: string, label: string) => {
    const key = slug.toLowerCase();
    if (!slug || seen.has(key)) return;
    seen.add(key);
    results.push({ id: slug, slug, label });
  };

  for (const interest of WORKOUT_INTERESTS) {
    const label = formatWorkoutLabel(interest);
    if (interest.includes(needle) || label.toLowerCase().includes(needle)) {
      add(interest, label);
    }
  }

  for (const post of posts) {
    for (const type of post.workout_types ?? []) {
      const label = formatWorkoutLabel(type);
      if (type.toLowerCase().includes(needle) || label.toLowerCase().includes(needle)) {
        add(type, label);
      }
    }
    if (post.workout_type) {
      const label = formatWorkoutLabel(post.workout_type);
      if (
        post.workout_type.toLowerCase().includes(needle) ||
        label.toLowerCase().includes(needle)
      ) {
        add(post.workout_type, label);
      }
    }
  }

  return results.slice(0, 8);
}

/** Unified Home Feed search — reuses profile search RPC and existing tables. */
export async function searchFeedContent(
  query: string,
  viewerId: string
): Promise<FeedSearchResults> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return { athletes: [], workouts: [], events: [] };
  }

  const escaped = escapeIlike(trimmed);
  const ilike = `%${escaped}%`;

  const [athletes, eventsRes, postsRes] = await Promise.all([
    searchProfiles(trimmed, 8, viewerId),
    getSupabase()
      .from("events")
      .select(`*, creator:profiles!events_created_by_fkey(*)`)
      .eq("status", "active")
      .gte("starts_at", new Date().toISOString())
      .or(
        `title.ilike.${ilike},description.ilike.${ilike},workout_type.ilike.${ilike},location.ilike.${ilike}`
      )
      .order("starts_at", { ascending: true })
      .limit(6),
    getSupabase()
      .from("posts")
      .select("workout_types, workout_type")
      .order("created_at", { ascending: false })
      .limit(60),
  ]);

  if (eventsRes.error) throw eventsRes.error;
  if (postsRes.error) throw postsRes.error;

  let events = (eventsRes.data ?? []) as WorkoutEvent[];
  if (viewerId) {
    const blockedIds = new Set(await getBlockedIds(viewerId));
    events = events.filter((event) => !blockedIds.has(event.created_by));
  }

  const workouts = collectWorkoutMatches(trimmed, postsRes.data ?? []);

  return {
    athletes,
    workouts,
    events,
  };
}
