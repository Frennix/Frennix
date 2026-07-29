import {
  buildPartnershipTimeline,
  formatMatchScoreImprovementStory,
  getNextPartnershipLevel,
  getPartnershipLevel,
  resolvePartnershipLevelId,
} from "@frennix/matching";
import type {
  PartnershipMilestoneRecord,
  TrainingPartnerJourneyRouteResult,
  TrainingPartnershipJourney,
  TrainingPartnershipRecord,
} from "@frennix/types";
import { getProfile } from "./profiles";
import { formatSupabaseError } from "./profile-utils";
import { getSupabase } from "./supabase";

function parsePartnershipRow(value: unknown): TrainingPartnershipRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as TrainingPartnershipRecord;
  if (typeof row.match_id !== "string") return null;
  return row;
}

function parseMilestoneRows(value: unknown): PartnershipMilestoneRecord[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return [];
    const record = row as PartnershipMilestoneRecord;
    if (typeof record.milestone_code !== "string" || typeof record.occurred_at !== "string") {
      return [];
    }
    return [
      {
        id: typeof record.id === "string" ? record.id : `${record.match_id}-${record.milestone_code}`,
        match_id: typeof record.match_id === "string" ? record.match_id : "",
        milestone_code: record.milestone_code,
        occurred_at: record.occurred_at,
        metadata:
          record.metadata && typeof record.metadata === "object" && !Array.isArray(record.metadata)
            ? record.metadata
            : {},
      },
    ];
  });
}

function applyMatchScoreTimelineStory(
  journey: TrainingPartnershipJourney
): TrainingPartnershipJourney {
  const start = journey.partnership.match_score_at_start;
  const current = journey.partnership.match_score_current;
  if (start == null || current == null || current <= start) {
    return journey;
  }

  return {
    ...journey,
    timeline: journey.timeline.map((entry) =>
      entry.code === "match_score_improved" && entry.status === "achieved"
        ? {
            ...entry,
            storyText: formatMatchScoreImprovementStory(start, current),
          }
        : entry
    ),
  };
}

function buildJourneyFromPayload(
  payload: Record<string, unknown>,
  partner: TrainingPartnershipJourney["partner"]
): TrainingPartnershipJourney {
  const partnership = parsePartnershipRow(payload.partnership);
  if (!partnership) {
    throw new Error("Training partnership not found");
  }

  const milestones = parseMilestoneRows(payload.milestones);
  const level = getPartnershipLevel(partnership.engagement_points);

  return applyMatchScoreTimelineStory({
    partnership: {
      ...partnership,
      level_id: resolvePartnershipLevelId(partnership.level_id, partnership.engagement_points),
    },
    partner,
    level,
    nextLevel: getNextPartnershipLevel(partnership.engagement_points),
    timeline: buildPartnershipTimeline(milestones),
    introCompleted: payload.intro_completed === true,
  });
}

export async function resolveTrainingPartnerJourneyRoute(
  matchId: string
): Promise<TrainingPartnerJourneyRouteResult> {
  const { data, error } = await getSupabase().rpc("resolve_training_partner_journey_route", {
    p_match_id: matchId,
  });

  if (error) {
    return {
      accessible: false,
      fallbackHref: "/matching/matches",
      message: formatSupabaseError(error, "Could not open training partner journey").message,
    };
  }

  const payload =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : null;

  if (!payload) {
    return {
      accessible: false,
      fallbackHref: "/matching/matches",
      message: "This training partner journey is unavailable.",
    };
  }

  if (payload.accessible === true) {
    const href = typeof payload.href === "string" ? payload.href : null;
    const route = payload.route === "intro" || payload.route === "timeline" ? payload.route : null;
    if (!href || !route) {
      return {
        accessible: false,
        fallbackHref: "/matching/matches",
        message: "This training partner journey is unavailable.",
      };
    }
    return { accessible: true, route, href };
  }

  return {
    accessible: false,
    fallbackHref:
      typeof payload.fallback_href === "string" ? payload.fallback_href : "/matching/matches",
    message:
      typeof payload.message === "string"
        ? payload.message
        : "This training partner journey is unavailable.",
  };
}

export async function getTrainingPartnershipJourney(
  matchId: string,
  userId: string
): Promise<TrainingPartnershipJourney> {
  const { data, error } = await getSupabase().rpc("get_training_partnership_journey", {
    p_match_id: matchId,
  });
  if (error) {
    throw formatSupabaseError(error, "Failed to load training partner journey");
  }

  const payload =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : null;
  if (!payload) {
    throw new Error("Invalid training partner journey response");
  }

  const partnerId = typeof payload.partner_id === "string" ? payload.partner_id : "";
  if (!partnerId) {
    throw new Error("Training partnership not found");
  }

  const partner = await getProfile(partnerId);
  if (!partner) {
    throw new Error("Training partner profile not found");
  }

  return buildJourneyFromPayload(payload, {
    id: partner.id,
    display_name: partner.display_name,
    username: partner.username,
    avatar_url: partner.avatar_url,
  });
}

export async function bootstrapTrainingPartnership(
  matchId: string,
  matchScoreAtStart?: number | null
): Promise<TrainingPartnershipRecord> {
  const { data, error } = await getSupabase().rpc("get_or_create_training_partnership", {
    p_match_id: matchId,
    p_match_score_at_start:
      typeof matchScoreAtStart === "number" ? Math.round(matchScoreAtStart) : null,
  });
  if (error) {
    throw formatSupabaseError(error, "Failed to create training partnership");
  }
  const partnership = parsePartnershipRow(data);
  if (!partnership) {
    throw new Error("Invalid training partnership response");
  }
  return partnership;
}

export async function completeTrainingPartnershipIntro(matchId: string): Promise<void> {
  const { error } = await getSupabase().rpc("complete_training_partnership_intro", {
    p_match_id: matchId,
  });
  if (error) {
    throw formatSupabaseError(error, "Failed to complete training partner intro");
  }
}
