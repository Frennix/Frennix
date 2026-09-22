export const STORY_REACTION_TRACE_STAGES = [
  "tap received",
  "viewer handler",
  "page callback",
  "reaction write",
  "conversation",
  "message write",
  "confirmed",
] as const;

export type StoryReactionTraceStageName = (typeof STORY_REACTION_TRACE_STAGES)[number];
export type StoryReactionTraceStatus = "pending" | "ok" | "fail";

export type StoryReactionTraceLine = {
  stage: string;
  status: StoryReactionTraceStatus;
  detail?: string;
};

export type StoryReactionTraceSnapshot = {
  requestId: number;
  emoji: string;
  lines: StoryReactionTraceLine[];
  failingStage: string | null;
};

export function createStoryReactionTrace(
  requestId: number,
  emoji: string
): StoryReactionTraceSnapshot {
  return {
    requestId,
    emoji,
    lines: [{ stage: "tap received", status: "ok" }],
    failingStage: null,
  };
}

export function applyStoryReactionTraceStage(
  trace: StoryReactionTraceSnapshot,
  stage: string,
  status: StoryReactionTraceStatus,
  detail?: string
): StoryReactionTraceSnapshot {
  const lines = trace.lines.filter((line) => line.stage !== stage);
  lines.push({ stage, status, detail });
  return {
    ...trace,
    lines,
    failingStage: status === "fail" ? stage : status === "ok" && trace.failingStage === stage ? null : trace.failingStage,
  };
}

type StoryReactionTraceListener = (
  requestId: number,
  emoji: string | null,
  stage: string,
  status: StoryReactionTraceStatus,
  detail?: string
) => void;

let storyReactionTraceListener: StoryReactionTraceListener | null = null;

export function subscribeStoryReactionTrace(listener: StoryReactionTraceListener) {
  storyReactionTraceListener = listener;
  return () => {
    if (storyReactionTraceListener === listener) storyReactionTraceListener = null;
  };
}

export function publishStoryReactionTrace(
  requestId: number,
  emoji: string | null,
  stage: string,
  status: StoryReactionTraceStatus,
  detail?: string
) {
  storyReactionTraceListener?.(requestId, emoji, stage, status, detail);
}

export function formatStoryReactionTrace(trace: StoryReactionTraceSnapshot) {
  return [
    `request ${trace.requestId}  ${trace.emoji}`,
    ...trace.lines.map((line) => {
      const mark = line.status === "ok" ? "OK" : line.status === "fail" ? "FAIL" : "...";
      return `${mark}  ${line.stage}${line.detail ? `  ${line.detail}` : ""}`;
    }),
    trace.failingStage ? `failing stage: ${trace.failingStage}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
