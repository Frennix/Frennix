import {
  canonicalizeStoryReaction,
  STORY_QUICK_REACTIONS,
  type StoryQuickReactionEmoji,
} from "@frennix/types";

export const REACTION_DELIVER_ERROR = "Reaction couldn’t be delivered. Try again.";

export type StoryReactionUiStatus = "idle" | "pending" | "sent" | "error";

export type StoryReactionSelectionState = {
  confirmed: StoryQuickReactionEmoji | null;
  selected: StoryQuickReactionEmoji | null;
  latestRequestId: number;
  status: StoryReactionUiStatus;
  error: string | null;
};

export function createStoryReactionSelection(
  confirmed: StoryQuickReactionEmoji | null = null
): StoryReactionSelectionState {
  const normalized = canonicalizeStoryReaction(confirmed)?.emoji ?? null;
  return {
    confirmed: normalized,
    selected: normalized,
    latestRequestId: 0,
    status: "idle",
    error: null,
  };
}

export function selectedStoryReactions(state: StoryReactionSelectionState): StoryQuickReactionEmoji[] {
  return state.selected ? [state.selected] : [];
}

export function applyStoryReactionTap(
  state: StoryReactionSelectionState,
  emoji: string
): { state: StoryReactionSelectionState; requestId: number; shouldSend: boolean } {
  const canonical = canonicalizeStoryReaction(emoji);
  if (!canonical) {
    return {
      state: {
        ...state,
        status: "error",
        error: REACTION_DELIVER_ERROR,
      },
      requestId: state.latestRequestId,
      shouldSend: false,
    };
  }

  if (state.status === "pending" && state.selected === canonical.emoji && state.latestRequestId > 0) {
    return {
      state,
      requestId: state.latestRequestId,
      shouldSend: false,
    };
  }

  const requestId = state.latestRequestId + 1;
  return {
    state: {
      confirmed: state.confirmed,
      selected: canonical.emoji,
      latestRequestId: requestId,
      status: "pending",
      error: null,
    },
    requestId,
    shouldSend: true,
  };
}

export function applyStoryReactionSuccess(
  state: StoryReactionSelectionState,
  requestId: number,
  emoji: string
): StoryReactionSelectionState {
  if (requestId !== state.latestRequestId) return state;
  const canonical = canonicalizeStoryReaction(emoji);
  if (!canonical) {
    return {
      ...state,
      selected: state.confirmed,
      status: "error",
      error: REACTION_DELIVER_ERROR,
    };
  }
  return {
    confirmed: canonical.emoji,
    selected: canonical.emoji,
    latestRequestId: state.latestRequestId,
    status: "sent",
    error: null,
  };
}

export function applyStoryReactionFailure(
  state: StoryReactionSelectionState,
  requestId: number,
  error: string = REACTION_DELIVER_ERROR
): StoryReactionSelectionState {
  if (requestId !== state.latestRequestId) return state;
  return {
    ...state,
    selected: state.confirmed,
    status: "error",
    error: error || REACTION_DELIVER_ERROR,
  };
}

export function applyStoryReactionConfirmedFromServer(
  state: StoryReactionSelectionState,
  value: string | null | undefined
): StoryReactionSelectionState {
  if (state.status === "pending") return state;
  const normalized = canonicalizeStoryReaction(value)?.emoji ?? null;
  if (normalized && normalized === state.confirmed && state.status === "sent") {
    return { ...state, selected: normalized };
  }
  return {
    ...state,
    confirmed: normalized,
    selected: normalized,
    status: state.status === "error" ? state.status : "idle",
    error: state.status === "error" ? state.error : null,
  };
}

export function displayedStoryReactionValues(): StoryQuickReactionEmoji[] {
  return STORY_QUICK_REACTIONS.map((reaction) => reaction.emoji);
}

export async function runLatestStoryReactionSend(
  state: StoryReactionSelectionState,
  requestId: number,
  send: () => Promise<void>
): Promise<{
  state: StoryReactionSelectionState;
  invoked: boolean;
  discardedBeforeSend: boolean;
}> {
  if (requestId !== state.latestRequestId) {
    return { state, invoked: false, discardedBeforeSend: true };
  }
  try {
    await send();
    return {
      state: applyStoryReactionSuccess(state, requestId, state.selected ?? ""),
      invoked: true,
      discardedBeforeSend: false,
    };
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : REACTION_DELIVER_ERROR;
    return {
      state: applyStoryReactionFailure(state, requestId, message),
      invoked: true,
      discardedBeforeSend: false,
    };
  }
}
