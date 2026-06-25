import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import {
  getChallenge,
  getChallengePosts,
  joinChallenge,
  isChallengeParticipant,
} from "@frennix/api";
import { useAuth } from "@/providers/AuthProvider";
import { usePostOwnerActions } from "@/lib/usePostOwnerActions";
import { useSharePost } from "@/lib/useSharePost";
import { useSavePost } from "@/lib/useSavePost";
import { useModeration } from "@/lib/useModeration";
import { usePostViewerActions } from "@/lib/usePostViewerActions";
import { refetchQueryKeys } from "@/lib/refreshQueries";
import { PostActionSheet } from "@/components/PostActionSheet";
import { DetailLoading } from "@/components/DetailLoading";
import { Button, EmptyState, PostCard, getSharedPostTargetId, colors, spacing, typography } from "@frennix/ui";

export default function ChallengeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const { openPostActions, actionSheetProps } = usePostOwnerActions({ userId });
  const { openShare, shareSheet } = useSharePost(userId);
  const { toggleSavePost } = useSavePost(userId);
  const { moderationSheets, startPostReport } = useModeration(userId);
  const { openViewerActions, viewerActionSheet } = usePostViewerActions({
    userId,
    onShare: (post) => openShare(post.shared_post ?? post),
    onReport: startPostReport,
  });

  const { data: challenge, isLoading: challengeLoading } = useQuery({
    queryKey: ["challenge", id],
    queryFn: () => getChallenge(id!),
    enabled: !!id,
  });

  const { data: joined } = useQuery({
    queryKey: ["challenge-joined", id, userId],
    queryFn: () => isChallengeParticipant(id!, userId),
    enabled: !!id && !!userId,
  });

  const { data: posts = [] } = useQuery({
    queryKey: ["challenge-posts", id],
    queryFn: () => getChallengePosts(id!, userId),
    enabled: !!id,
  });

  const joinMutation = useMutation({
    mutationFn: () => joinChallenge(id!, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["challenge-joined"] }),
  });

  const onRefresh = useCallback(async () => {
    if (!id) return;
    setRefreshing(true);
    try {
      await refetchQueryKeys(queryClient, [
        ["challenge", id],
        ["challenge-joined", id, userId],
        ["challenge-posts", id],
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [id, userId, queryClient]);

  if (challengeLoading) return <DetailLoading />;
  if (!challenge) {
    return (
      <View style={styles.emptyWrap}>
        <EmptyState
          title="Challenge not found"
          description="This challenge may have ended or been removed."
          actionLabel="Go back"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <PostActionSheet {...actionSheetProps} />
      {viewerActionSheet}
      {shareSheet}
      {moderationSheets}
      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>{challenge.title}</Text>
            {challenge.description ? <Text style={styles.desc}>{challenge.description}</Text> : null}
            <Text style={styles.dates}>
              {new Date(challenge.start_date).toLocaleDateString()} –{" "}
              {new Date(challenge.end_date).toLocaleDateString()}
            </Text>
            <Text style={styles.participants}>{challenge.participant_count} participants</Text>

            {!joined ? (
              <Button
                title="Join challenge"
                onPress={() => joinMutation.mutate()}
                loading={joinMutation.isPending}
              />
            ) : (
              <>
                <Text style={styles.joined}>You're in! Stay accountable and check in daily.</Text>
                <Button
                  title="Share post"
                  variant="secondary"
                  onPress={() =>
                    router.push({ pathname: "/create-post", params: { challengeId: id! } })
                  }
                />
              </>
            )}

            <Text style={styles.section}>Challenge feed</Text>
          </View>
        }
        renderItem={({ item }) => (
          <PostCard
            post={item}
            isOwn={item.author_id === userId}
            onPress={() => router.push(`/post/${getSharedPostTargetId(item)}`)}
            onOwnerActionsPress={() => openPostActions(item)}
            onShare={() => openShare(item.shared_post ?? item)}
            onSave={() => toggleSavePost(item.id, !!item.saved_by_me)}
            onModerationPress={() => openViewerActions(item)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            title="No posts yet"
            description={
              joined
                ? "Share your first check-in to stay accountable with the group."
                : "Join this challenge to see posts and share your progress."
            }
            actionLabel={joined ? "Share post" : "Join challenge"}
            onAction={
              joined
                ? () => router.push({ pathname: "/create-post", params: { challengeId: id! } })
                : () => joinMutation.mutate()
            }
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.md, flexGrow: 1 },
  header: { gap: spacing.sm, marginBottom: spacing.sm },
  title: { ...typography.title },
  desc: { ...typography.body, lineHeight: 24 },
  dates: { color: colors.accent, fontWeight: "600" },
  participants: { ...typography.caption },
  joined: { ...typography.body, color: colors.accent },
  section: { ...typography.heading, fontSize: 18, marginTop: spacing.md, marginBottom: spacing.sm },
  emptyWrap: { flex: 1, backgroundColor: colors.background, justifyContent: "center" },
});
