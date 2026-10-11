export type PublishPhase = "idle" | "publishing" | "leaving";

/**
 * One in-flight publish, then a locked departure.
 * A second tap during a slow request stays rejected.
 * Failure returns to idle so the same draft can be sent again.
 * The next post uses a new composer, which starts idle.
 */
export function beginPublish(phase: PublishPhase): PublishPhase | null {
  if (phase !== "idle") return null;
  return "publishing";
}

export function failPublish(phase: PublishPhase): PublishPhase {
  if (phase !== "publishing") return phase;
  return "idle";
}

export function succeedPublish(phase: PublishPhase): PublishPhase {
  if (phase !== "publishing") return phase;
  return "leaving";
}

/** The open composer keeps its category while publishing, even if the stored draft resets. */
export function visibleComposerCategory<T extends string>(locked: T | null, draft: T): T {
  return locked ?? draft;
}
