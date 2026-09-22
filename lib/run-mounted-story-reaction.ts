import type { StoryQuickReactionEmoji } from "@frennix/types";
import type { StoryReactionTraceStatus } from "./story-reaction-trace";

export type MountedStoryReactionPageHandler = (
  storyUserId: string,
  storyId: string,
  emoji: StoryQuickReactionEmoji,
  slideId?: string | null,
  requestId?: number
) => void | Promise<void>;

/** Exact viewer-to-page bridge used by the mounted Story Viewer. */
export async function runMountedStoryReaction(input: {
  emoji: StoryQuickReactionEmoji;
  requestId: number;
  storyId: string | null;
  viewerId: string | null;
  ownerId: string;
  slideId: string | null;
  pageOnReact?: MountedStoryReactionPageHandler;
  onStage?: (stage: string, status: StoryReactionTraceStatus, detail?: string) => void;
}) {
  input.onStage?.("viewer handler", "pending");
  if (!input.storyId || !input.viewerId) {
    input.onStage?.("viewer handler", "fail", "missing storyId or viewerId");
    throw new Error("Reaction couldn’t be delivered. Try again.");
  }
  if (!input.pageOnReact) {
    input.onStage?.("page callback", "fail", "page onReact was not provided");
    throw new Error("Reaction couldn’t be delivered. Try again.");
  }

  input.onStage?.("viewer handler", "ok", "StoryReactionRow reached WorkoutStoryViewer");
  input.onStage?.("page callback", "pending");
  try {
    await input.pageOnReact(
      input.ownerId,
      input.storyId,
      input.emoji,
      input.slideId,
      input.requestId
    );
    input.onStage?.("page callback", "ok", "Home handleStoryReact awaited");
  } catch (error) {
    const detail = error instanceof Error ? error.message : "page callback failed";
    input.onStage?.("page callback", "fail", detail);
    throw error;
  }
}
