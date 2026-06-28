import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import type { Post } from "@frennix/types";
import {
  getConversations,
  getErrorMessage,
  getMyChallenges,
  getMyGroups,
  sharePostToChallenge,
  sharePostToConversation,
  sharePostToGroup,
} from "@frennix/api";
import { showAlert, showSuccess } from "@/lib/alerts";
import { SharePostSheet } from "@/components/SharePostSheet";

export function useSharePost(userId: string) {
  const queryClient = useQueryClient();
  const [post, setPost] = useState<Post | null>(null);
  const visible = Boolean(post);

  const { data: conversations = [], isLoading: conversationsLoading } = useQuery({
    queryKey: ["conversations", userId],
    queryFn: () => getConversations(userId),
    enabled: visible && !!userId,
  });

  const { data: groups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ["my-groups", userId],
    queryFn: () => getMyGroups(userId),
    enabled: visible && !!userId,
  });

  const { data: challenges = [], isLoading: challengesLoading } = useQuery({
    queryKey: ["my-challenges", userId],
    queryFn: () => getMyChallenges(userId),
    enabled: visible && !!userId,
  });

  const shareMutation = useMutation({
    mutationFn: async ({
      destination,
      targetId,
    }: {
      destination: "message" | "group" | "challenge";
      targetId: string;
    }) => {
      if (!post) throw new Error("No post selected");
      if (destination === "message") {
        return sharePostToConversation(post.id, targetId, userId);
      }
      if (destination === "group") {
        return sharePostToGroup(post.id, targetId, userId);
      }
      return sharePostToChallenge(post.id, targetId, userId);
    },
    onSuccess: (_data, variables) => {
      showSuccess("Post shared");
      setPost(null);

      if (variables.destination === "message") {
        queryClient.invalidateQueries({ queryKey: ["messages", variables.targetId] });
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
      }
      if (variables.destination === "group") {
        queryClient.invalidateQueries({ queryKey: ["group-posts", variables.targetId] });
      }
      if (variables.destination === "challenge") {
        queryClient.invalidateQueries({ queryKey: ["challenge-posts", variables.targetId] });
      }
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (error) => showAlert("Could not share", getErrorMessage(error)),
  });

  const openShare = useCallback((selected: Post) => {
    setPost(selected);
  }, []);

  const closeShare = useCallback(() => {
    if (!shareMutation.isPending) setPost(null);
  }, [shareMutation.isPending]);

  const shareSheet = (
    <SharePostSheet
      visible={visible}
      post={post}
      onClose={closeShare}
      conversations={conversations}
      groups={groups}
      challenges={challenges}
      loading={conversationsLoading || groupsLoading || challengesLoading}
      sharing={shareMutation.isPending}
      onShare={(destination, targetId) => shareMutation.mutate({ destination, targetId })}
    />
  );

  return { openShare, shareSheet, shareVisible: visible };
}
