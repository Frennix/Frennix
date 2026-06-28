import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { frennixRefreshControlProps } from '@/lib/screen-shell';
import { getGroup, getGroupMembers, getGroupPosts, joinGroup, leaveGroup, isGroupMember } from "@frennix/api";
import { useAuth } from "@/providers/AuthProvider";
import { usePostActions } from "@/lib/usePostActions";
import { useGroupActions } from "@/lib/useGroupActions";
import { useSharePost } from "@/lib/useSharePost";
import { useSavePost } from "@/lib/useSavePost";
import { refetchQueryKeys } from "@/lib/refreshQueries";
import { DetailLoading } from "@/components/DetailLoading";
import { Button, EmptyState, MenuIconButton, PostCard, getSharedPostTargetId, UserRow, colors, radius, spacing, typography } from "@frennix/ui";

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
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

  const { data: group, isLoading: groupLoading } = useQuery({
    queryKey: ["group", id],
    queryFn: () => getGroup(id!),
    enabled: !!id,
  });

  const { openGroupActions, groupActionSheets } = useGroupActions({
    userId,
    group,
    onDeleted: () => router.replace("/(tabs)/discover"),
  });

  const { data: isMember } = useQuery({
    queryKey: ["group-member", id, userId],
    queryFn: () => isGroupMember(id!, userId),
    enabled: !!id && !!userId,
  });

  const { data: members = [] } = useQuery({
    queryKey: ["group-members", id],
    queryFn: () => getGroupMembers(id!),
    enabled: !!id,
  });

  const { data: posts = [] } = useQuery({
    queryKey: ["group-posts", id],
    queryFn: () => getGroupPosts(id!, userId),
    enabled: !!id,
  });

  const membershipMutation = useMutation({
    mutationFn: async () => {
      if (!id) return;
      if (isMember) await leaveGroup(id, userId);
      else await joinGroup(id, userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-member"] });
      queryClient.invalidateQueries({ queryKey: ["group-members"] });
    },
  });

  const onRefresh = useCallback(async () => {
    if (!id) return;
    setRefreshing(true);
    try {
      await refetchQueryKeys(queryClient, [
        ["group", id],
        ["group-member", id, userId],
        ["group-members", id],
        ["group-posts", id],
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [id, userId, queryClient]);

  if (groupLoading) return <DetailLoading />;
  if (!group) {
    return (
      <View style={styles.emptyWrap}>
        <EmptyState
          title="Group not found"
          description="This group may have been removed or you don't have access."
          actionLabel="Go back"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {postActionSheets}
      {groupActionSheets}
      {shareSheet}
      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} {...frennixRefreshControlProps} />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>{group.name}</Text>
              {userId ? (
                <MenuIconButton onPress={openGroupActions} accessibilityLabel="Group options" />
              ) : null}
            </View>
            {group.description ? <Text style={styles.desc}>{group.description}</Text> : null}
            <Text style={styles.meta}>
              {group.member_count} members · {group.sport_tags.join(", ")}
            </Text>

            <Button
              title={isMember ? "Leave group" : "Join group"}
              variant={isMember ? "secondary" : "primary"}
              onPress={() => membershipMutation.mutate()}
              loading={membershipMutation.isPending}
            />

            {isMember ? (
              <Button
                title="Share post"
                variant="secondary"
                onPress={() =>
                  router.push({ pathname: "/create-post", params: { groupId: id! } })
                }
              />
            ) : null}

            <Text style={styles.section}>Members</Text>
            {members.slice(0, 5).map((m) => (
              <UserRow key={m.user_id} profile={m.profile!} />
            ))}

            <Text style={styles.section}>Group feed</Text>
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
              isMember
                ? "Be the first to share a workout or update with this group."
                : "Join this group to see posts and share your own."
            }
            actionLabel={isMember ? "Share post" : undefined}
            onAction={
              isMember
                ? () => router.push({ pathname: "/create-post", params: { groupId: id! } })
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
  title: { ...typography.screenTitle, flex: 1 },
  desc: { ...typography.bodySmall },
  meta: { ...typography.caption, marginBottom: spacing.sm },
  section: { ...typography.section, marginTop: spacing.lg, marginBottom: spacing.sm },
  emptyWrap: { flex: 1, backgroundColor: colors.background, justifyContent: "center" },
});
