import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Post } from "@frennix/types";
import { getErrorMessage, sendStoryInviteToTrain } from "@frennix/api";
import { PostInteractionSheet } from "@/components/PostInteractionSheet";
import {
  POST_INTERACTION_FITNESS_MESSAGES,
  POST_INTERACTION_REACTION_EMOJI,
  isReactionAction,
  type PostInteractionActionId,
} from "@/lib/post-interaction-actions";
import {
  readLastReactionAction,
  writeLastReactionAction,
} from "@/lib/post-interaction-preferences";
import { showAlert } from "@/lib/alerts";
import { hapticLight } from "@/lib/haptics";
import { pushScreen } from "@/lib/press-utils";
import { getSharedPostTargetId } from "@frennix/ui";

type UsePostInteractionOptions = {
  userId: string;
  onLike: (post: Post) => void;
  onReaction: (post: Post, emoji: string) => void;
  onReply: (post: Post, draft?: string) => void;
  onShare: (post: Post) => void;
  onSave: (post: Post) => void;
  onViewProfile: (post: Post) => void;
  onViewMedia: (post: Post, mediaIndex: number) => void;
};

export function usePostInteraction({
  userId,
  onLike,
  onReaction,
  onReply,
  onShare,
  onSave,
  onViewProfile,
  onViewMedia,
}: UsePostInteractionOptions) {
  const [activePost, setActivePost] = useState<Post | null>(null);
  const [mediaIndex, setMediaIndex] = useState(0);
  const [panel, setPanel] = useState<"primary" | "more">("primary");
  const [lastReactionId, setLastReactionId] = useState<PostInteractionActionId | null>(null);
  const visible = activePost != null;

  useEffect(() => {
    void readLastReactionAction().then(setLastReactionId);
  }, []);

  const openInteraction = useCallback((post: Post, index = 0) => {
    hapticLight();
    setActivePost(post);
    setMediaIndex(index);
    setPanel("primary");
  }, []);

  const closeInteraction = useCallback(() => {
    setActivePost(null);
    setPanel("primary");
  }, []);

  const rememberReaction = useCallback((actionId: PostInteractionActionId) => {
    if (!isReactionAction(actionId)) return;
    setLastReactionId(actionId);
    void writeLastReactionAction(actionId);
  }, []);

  const handleAction = useCallback(
    async (actionId: PostInteractionActionId): Promise<boolean> => {
      if (!activePost) return false;

      const targetPost = activePost.shared_post ?? activePost;
      const authorId = activePost.author_id;

      switch (actionId) {
        case "like":
          onLike(activePost);
          rememberReaction(actionId);
          return true;
        case "strong_work":
          onReaction(activePost, POST_INTERACTION_REACTION_EMOJI.strong_work ?? "💪");
          rememberReaction(actionId);
          return true;
        case "reply":
          onReply(activePost);
          return true;
        case "reaction_fire":
        case "reaction_nice_work": {
          const emoji = POST_INTERACTION_REACTION_EMOJI[actionId];
          if (emoji) onReaction(activePost, emoji);
          rememberReaction(actionId);
          return true;
        }
        case "fitness_join":
          onReply(activePost, POST_INTERACTION_FITNESS_MESSAGES.fitness_join);
          return true;
        case "fitness_challenge_accepted":
          onReply(activePost, POST_INTERACTION_FITNESS_MESSAGES.fitness_challenge_accepted);
          return true;
        case "fitness_rematch":
          onReply(activePost, POST_INTERACTION_FITNESS_MESSAGES.fitness_rematch);
          return true;
        case "fitness_invite_train":
          if (!userId || !authorId || userId === authorId) {
            showAlert("Cannot invite", "You cannot invite yourself to train.");
            return false;
          }
          try {
            await sendStoryInviteToTrain(userId, authorId, targetPost.id);
            showAlert("Invite sent", "They'll get a notification to train with you.");
            return true;
          } catch (error) {
            showAlert("Could not send invite", getErrorMessage(error));
            return false;
          }
        case "view_profile":
          onViewProfile(activePost);
          return true;
        case "view_media":
          onViewMedia(activePost, mediaIndex);
          return true;
        case "share":
          onShare(activePost);
          return true;
        case "save":
          onSave(activePost);
          return true;
        default:
          return true;
      }
    },
    [
      activePost,
      mediaIndex,
      onLike,
      onReaction,
      onReply,
      onSave,
      onShare,
      onViewMedia,
      onViewProfile,
      rememberReaction,
      userId,
    ]
  );

  const interactionSheet: ReactNode = (
    <PostInteractionSheet
      visible={visible}
      post={activePost}
      panel={panel}
      lastReactionId={lastReactionId}
      onPanelChange={setPanel}
      liked={Boolean(activePost?.liked_by_me)}
      myReaction={activePost?.my_reaction}
      saved={Boolean(activePost?.saved_by_me)}
      onAction={(actionId) => handleAction(actionId)}
      onClose={closeInteraction}
    />
  );

  return useMemo(
    () => ({
      activePost,
      interactionVisible: visible,
      openInteraction,
      closeInteraction,
      interactionSheet,
    }),
    [activePost, closeInteraction, interactionSheet, openInteraction, visible]
  );
}

export function postReplyHref(post: Post, draft?: string) {
  const id = getSharedPostTargetId(post);
  if (!draft) return `/post/${id}` as const;
  return `/post/${id}?draft=${encodeURIComponent(draft)}` as const;
}
