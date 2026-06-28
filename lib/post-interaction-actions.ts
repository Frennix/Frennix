/** Extensible post interaction actions — add entries here without redesigning the sheet UI. */

export type PostInteractionCategory =
  | "primary"
  | "quick_reaction"
  | "fitness"
  | "profile"
  | "future_reaction";

export type PostInteractionActionId =
  | "like"
  | "strong_work"
  | "reply"
  | "more"
  | "reaction_fire"
  | "reaction_nice_work"
  | "fitness_join"
  | "fitness_invite_train"
  | "fitness_challenge_accepted"
  | "fitness_rematch"
  | "view_profile"
  | "view_media"
  | "share"
  | "save";

export type PostInteractionAction = {
  id: PostInteractionActionId;
  category: PostInteractionCategory;
  emoji: string;
  label: string;
  hint?: string;
};

export type PostInteractionSection = {
  title: string;
  actions: PostInteractionAction[];
};

export const POST_INTERACTION_PRIMARY: PostInteractionAction[] = [
  { id: "like", category: "primary", emoji: "❤️", label: "Like" },
  { id: "strong_work", category: "primary", emoji: "💪", label: "Strong Work" },
  { id: "reply", category: "primary", emoji: "💬", label: "Reply" },
  { id: "more", category: "primary", emoji: "⋯", label: "More" },
];

export const POST_INTERACTION_MORE_SECTIONS: PostInteractionSection[] = [
  {
    title: "Quick Reactions",
    actions: [
      { id: "reaction_fire", category: "quick_reaction", emoji: "🔥", label: "Fire" },
      { id: "reaction_nice_work", category: "quick_reaction", emoji: "👏", label: "Nice Work" },
    ],
  },
  {
    title: "Fitness Actions",
    actions: [
      { id: "fitness_join", category: "fitness", emoji: "🤝", label: "I'll Join" },
      { id: "fitness_invite_train", category: "fitness", emoji: "🏃", label: "Invite to Train" },
      {
        id: "fitness_challenge_accepted",
        category: "fitness",
        emoji: "🎯",
        label: "Challenge Accepted",
      },
      { id: "fitness_rematch", category: "fitness", emoji: "🔄", label: "Rematch" },
    ],
  },
  {
    title: "Profile & Communication",
    actions: [
      { id: "view_profile", category: "profile", emoji: "👤", label: "View Profile" },
      { id: "view_media", category: "profile", emoji: "🖼️", label: "View Full Screen" },
      { id: "share", category: "profile", emoji: "↗", label: "Share" },
      { id: "save", category: "profile", emoji: "🔖", label: "Save Post" },
    ],
  },
];

/** Ready to enable in a future release — append to Quick Reactions when backend supports them. */
export const POST_INTERACTION_FUTURE_REACTIONS: PostInteractionAction[] = [
  { id: "reaction_laugh", category: "future_reaction", emoji: "😂", label: "Laugh" },
  { id: "reaction_impressive", category: "future_reaction", emoji: "😮", label: "Impressive" },
  { id: "reaction_beast", category: "future_reaction", emoji: "💯", label: "Beast Mode" },
  { id: "reaction_keep_going", category: "future_reaction", emoji: "👏", label: "Keep Going" },
  { id: "reaction_congrats", category: "future_reaction", emoji: "🎉", label: "Congratulations" },
];

export const POST_INTERACTION_FITNESS_MESSAGES: Record<
  Extract<
    PostInteractionActionId,
    "fitness_join" | "fitness_challenge_accepted" | "fitness_rematch"
  >,
  string
> = {
  fitness_join: "I'll join your next workout! 💪",
  fitness_challenge_accepted: "Challenge accepted! Let's go 🔥",
  fitness_rematch: "Rematch soon? I'm in! 💪",
};

export const POST_INTERACTION_REACTION_EMOJI: Partial<Record<PostInteractionActionId, string>> = {
  strong_work: "💪",
  reaction_fire: "🔥",
  reaction_nice_work: "👏",
};

const REACTION_PRIMARY_SLOT_IDS = new Set<PostInteractionActionId>([
  "strong_work",
  "reaction_fire",
  "reaction_nice_work",
]);

const ALL_ACTIONS: PostInteractionAction[] = [
  ...POST_INTERACTION_PRIMARY,
  ...POST_INTERACTION_MORE_SECTIONS.flatMap((section) => section.actions),
];

export function getPostInteractionAction(id: PostInteractionActionId): PostInteractionAction | undefined {
  return ALL_ACTIONS.find((action) => action.id === id);
}

/** Primary row: Like · (last reaction or Strong Work) · Reply · More */
export function buildPrimaryActions(
  lastReactionId: PostInteractionActionId | null
): PostInteractionAction[] {
  const like = POST_INTERACTION_PRIMARY.find((action) => action.id === "like")!;
  const reply = POST_INTERACTION_PRIMARY.find((action) => action.id === "reply")!;
  const more = POST_INTERACTION_PRIMARY.find((action) => action.id === "more")!;
  const defaultReaction = POST_INTERACTION_PRIMARY.find((action) => action.id === "strong_work")!;

  let reactionSlot = defaultReaction;
  if (
    lastReactionId &&
    lastReactionId !== "like" &&
    REACTION_PRIMARY_SLOT_IDS.has(lastReactionId)
  ) {
    reactionSlot = getPostInteractionAction(lastReactionId) ?? defaultReaction;
  }

  return [like, reactionSlot, reply, more];
}

export function isReactionAction(id: PostInteractionActionId): boolean {
  return (
    id === "like" ||
    id === "strong_work" ||
    id === "reaction_fire" ||
    id === "reaction_nice_work"
  );
}

export function isLightHapticAction(id: PostInteractionActionId): boolean {
  return isReactionAction(id);
}

export function isMediumHapticAction(id: PostInteractionActionId): boolean {
  return (
    id === "fitness_invite_train" ||
    id === "fitness_challenge_accepted" ||
    id === "fitness_join" ||
    id === "fitness_rematch" ||
    id === "reply" ||
    id === "view_profile" ||
    id === "share" ||
    id === "save" ||
    id === "view_media"
  );
}

export function countMoreActions(): number {
  return POST_INTERACTION_MORE_SECTIONS.reduce((total, section) => total + section.actions.length, 0);
}

export const MORE_ACTIONS_SCROLL_THRESHOLD = 6;
