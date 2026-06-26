import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import {
  getChallenge,
  getChallengePosts,
  joinChallenge,
  isChallengeParticipant,
} from "@frennix/api";
import { useAuth } from "@/providers/AuthProvider";
import { usePostActions } from "@/lib/usePostActions";
import { useChallengeActions } from "@/lib/useChallengeActions";
import { useSharePost } from "@/lib/useSharePost";
import { useSavePost } from "@/lib/useSavePost";
import { refetchQueryKeys } from "@/lib/refreshQueries";
import { DetailLoading } from "@/components/DetailLoading";
import { Button, CachedImage, EmptyState, PostCard, getSharedPostTargetId, colors, radius, spacing, typography } from "@frennix/ui";

import { isChallengeClosed } from "@/lib/challenge-actions";

export default function ChallengeDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const { openShare, shareSheet } = useSharePost(userId);
  const { openPostActions, postActionSheets } = usePostActions({
    userId,
    onShareInApp: (post) => openShare(post.shared_post ?? post),
  });
  const { toggleSavePost } = useSavePost(userId);

  const { data: challenge, isLoading: challengeLoading } = useQuery({
    queryKey: ["challenge", id],
    queryFn: () => getChallenge(id!),
    enabled: !!id,
  });

  const { openChallengeActions, challengeActionSheets } = useChallengeActions({
    userId,
    challenge,
    onDeleted: () => router.replace("/(tabs)/discover"),
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

  const closed = isChallengeClosed(challenge);

  return (
    <View style={styles.container}>
      {postActionSheets}
      {challengeActionSheets}
      {shareSheet}
      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>{challenge.title}</Text>
              {userId ? (
                <Pressable
                  style={styles.menuButton}
                  onPress={openChallengeActions}
                  hitSlop={8}
                  accessibilityLabel="Challenge options"
                >
                  <Text style={styles.menuIcon}>⋯</Text>
                </Pressable>
              ) : null}
            </View>

            {closed ? (
              <View style={styles.closedBanner}>
                <Text style={styles.closedText}>This challenge has ended</Text>
              </View>
            ) : null}

            {challenge.cover_image_url ? (
              <CachedImage
                uri={challenge.cover_image_url}
                style={styles.cover}
                contentFit="cover"
                recyclingKey={`challenge-cover-${challenge.id}`}
              />
            ) : null}

            {challenge.description ? <Text style={styles.desc}>{challenge.description}</Text> : null}
            {challenge.rules ? (
              <View style={styles.rulesBlock}>
                <Text style={styles.rulesLabel}>Rules</Text>
                <Text style={styles.rulesText}>{challenge.rules}</Text>
              </View>
            ) : null}
            <Text style={styles.dates}>
              {new Date(challenge.start_date).toLocaleDateString()} –{" "}
              {new Date(challenge.end_date).toLocaleDateString()}
            </Text>
            <Text style={styles.participants}>{challenge.participant_count} participants</Text>

            {!closed && !joined ? (
              <Button
                title="Join challenge"
                onPress={() => joinMutation.mutate()}
                loading={joinMutation.isPending}
              />
            ) : null}
            {!closed && joined ? (
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
            ) : null}

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
            onModerationPress={() => openPostActions(item)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            title="No posts yet"
            description={
              joined
                ? "Share your first check-in to stay accountable with the group."
                : closed
                  ? "This challenge has ended."
                  : "Join this challenge to see posts and share your progress."
            }
            actionLabel={
              !closed && joined ? "Share post" : !closed && !joined ? "Join challenge" : undefined
            }
            onAction={
              !closed && joined
                ? () => router.push({ pathname: "/create-post", params: { challengeId: id! } })
                : !closed && !joined
                  ? () => joinMutation.mutate()
                  : undefined
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
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  title: { ...typography.title, flex: 1 },
  menuButton: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  menuIcon: { fontSize: 22, lineHeight: 24, color: colors.textSecondary, fontWeight: "700" },
  closedBanner: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  closedText: { ...typography.bodySmall, color: colors.textMuted, textAlign: "center" },
  cover: {
    width: "100%",
    height: 180,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
  },
  desc: { ...typography.body, lineHeight: 24 },
  rulesBlock: { gap: spacing.xs },
  rulesLabel: { ...typography.bodySmall, fontWeight: "600", color: colors.textSecondary },
  rulesText: { ...typography.body, lineHeight: 22 },
  dates: { color: colors.accent, fontWeight: "600" },
  participants: { ...typography.caption },
  joined: { ...typography.body, color: colors.accent },
  section: { ...typography.heading, fontSize: 18, marginTop: spacing.md, marginBottom: spacing.sm },
  emptyWrap: { flex: 1, backgroundColor: colors.background, justifyContent: "center" },
});
