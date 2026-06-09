import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { getGroup, getGroupMembers, getGroupPosts, joinGroup, leaveGroup, isGroupMember } from "@frennix/api";
import { useAuth } from "@/providers/AuthProvider";
import { Button, PostCard, UserRow, colors, spacing, typography } from "@frennix/ui";

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const queryClient = useQueryClient();

  const { data: group } = useQuery({
    queryKey: ["group", id],
    queryFn: () => getGroup(id!),
    enabled: !!id,
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
    queryFn: () => getGroupPosts(id!),
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

  if (!group) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{group.name}</Text>
      {group.description ? <Text style={styles.desc}>{group.description}</Text> : null}
      <Text style={styles.meta}>{group.member_count} members · {group.sport_tags.join(", ")}</Text>

      <Button
        title={isMember ? "Leave group" : "Join group"}
        variant={isMember ? "secondary" : "primary"}
        onPress={() => membershipMutation.mutate()}
        loading={membershipMutation.isPending}
      />

      <Text style={styles.section}>Members</Text>
      {members.slice(0, 5).map((m) => (
        <UserRow key={m.user_id} profile={m.profile!} />
      ))}

      <Text style={styles.section}>Group feed</Text>
      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => <PostCard post={item} />}
        ListEmptyComponent={<Text style={styles.empty}>No posts in this group yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  title: { ...typography.title, fontSize: 24 },
  desc: { ...typography.bodySmall, marginTop: spacing.sm },
  meta: { ...typography.caption, marginBottom: spacing.md },
  section: { ...typography.heading, fontSize: 18, marginTop: spacing.lg, marginBottom: spacing.sm },
  empty: { color: colors.textMuted },
});
