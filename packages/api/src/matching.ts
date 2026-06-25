import type {
  Match,
  MatchSwipe,
  Profile,
  RecordMatchSwipeResult,
  SwipeDirection,
} from "@frennix/types";
import { formatSupabaseError } from "./profile-utils";
import { getProfilesByIds, updateProfile } from "./profiles";
import { getSupabase } from "./supabase";

const DEFAULT_CANDIDATE_LIMIT = 20;
const MAX_CANDIDATE_LIMIT = 50;

function clampCandidateLimit(limit: number) {
  return Math.max(1, Math.min(limit, MAX_CANDIDATE_LIMIT));
}

function coerceStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.length > 0);
  }
  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }
  return [];
}

function normalizeMatchCandidate(row: unknown): Profile {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    throw new Error("Invalid match candidate profile");
  }

  const profile = row as Profile;
  return {
    ...profile,
    fitness_goals: coerceStringArray(profile.fitness_goals),
    activities: coerceStringArray(profile.activities),
  };
}

function parseMatchCandidates(value: unknown): Profile[] {
  if (value == null) return [];
  const rows = Array.isArray(value) ? value : [value];

  return rows.flatMap((row) => {
    try {
      return [normalizeMatchCandidate(row)];
    } catch {
      return [];
    }
  });
}

function parseSwipeDirection(value: unknown): SwipeDirection {
  if (value === "left" || value === "right") return value;
  throw new Error("Invalid swipe direction in match swipe response");
}

function parseMatchStatus(value: unknown): Match["status"] {
  if (value === "pending" || value === "matched" || value === "unmatched") return value;
  throw new Error("Invalid match status in match response");
}

function parseMatchSwipe(value: unknown): MatchSwipe {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid match swipe response");
  }

  const row = value as Record<string, unknown>;
  const swiperId = row.swiper_id;
  const swipeeId = row.swipee_id;
  const createdAt = row.created_at;

  if (typeof swiperId !== "string" || typeof swipeeId !== "string" || typeof createdAt !== "string") {
    throw new Error("Invalid match swipe response");
  }

  return {
    swiper_id: swiperId,
    swipee_id: swipeeId,
    direction: parseSwipeDirection(row.direction),
    created_at: createdAt,
  };
}

function parseMatch(value: unknown): Match | null {
  if (value == null) return null;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid match response");
  }

  const row = value as Record<string, unknown>;
  const id = row.id;
  const userA = row.user_a;
  const userB = row.user_b;
  const createdAt = row.created_at;

  if (typeof id !== "string" || typeof userA !== "string" || typeof userB !== "string") {
    throw new Error("Invalid match response");
  }
  if (typeof createdAt !== "string") {
    throw new Error("Invalid match created_at in match response");
  }

  return {
    id,
    user_a: userA,
    user_b: userB,
    status: parseMatchStatus(row.status),
    created_at: createdAt,
  };
}

function parseRecordMatchSwipeResult(value: unknown): RecordMatchSwipeResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid record_match_swipe response");
  }

  const row = value as Record<string, unknown>;
  return {
    swipe: parseMatchSwipe(row.swipe),
    match: parseMatch(row.match),
    is_mutual: row.is_mutual === true,
  };
}

export async function getMatchCandidates(limit = DEFAULT_CANDIDATE_LIMIT): Promise<Profile[]> {
  const { data, error } = await getSupabase().rpc("get_match_candidates", {
    p_limit: clampCandidateLimit(limit),
  });

  if (error) {
    throw formatSupabaseError(error, "Failed to load match candidates");
  }

  return parseMatchCandidates(data);
}

export async function recordMatchSwipe(
  swipeeId: string,
  direction: SwipeDirection
): Promise<RecordMatchSwipeResult> {
  const { data, error } = await getSupabase().rpc("record_match_swipe", {
    p_swipee_id: swipeeId,
    p_direction: direction,
  });

  if (error) {
    throw formatSupabaseError(error, "Failed to record swipe");
  }

  return parseRecordMatchSwipeResult(data);
}

export async function getMatches(userId: string): Promise<Match[]> {
  const { data, error } = await getSupabase().rpc("get_training_matches");

  if (error) {
    throw formatSupabaseError(error, "Failed to load matches");
  }

  const matches = (data ?? []) as Match[];
  if (!matches.length) return [];

  const otherUserIds = matches.map((match) =>
    match.user_a === userId ? match.user_b : match.user_a
  );
  const profiles = await getProfilesByIds(otherUserIds);
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

  return matches.map((match) => ({
    ...match,
    other_user: profileById.get(match.user_a === userId ? match.user_b : match.user_a),
  }));
}

export async function removeTrainingMatch(matchId: string): Promise<Match> {
  const { data, error } = await getSupabase().rpc("remove_training_match", {
    p_match_id: matchId,
  });

  if (error) {
    throw formatSupabaseError(error, "Failed to remove training match");
  }

  const match = parseMatch(data);
  if (!match) {
    throw new Error("Invalid remove training match response");
  }

  return match;
}

export async function setMatchingEnabled(userId: string, enabled: boolean): Promise<Profile> {
  return updateProfile(userId, { matching_enabled: enabled });
}
