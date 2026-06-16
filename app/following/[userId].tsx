import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { getFollowing, getFollowingIds } from "@frennix/api";
import { useAuth } from "@/providers/AuthProvider";
import { UserFollowRow } from "@/components/UserFollowRow";
import { EmptyState, colors, spacing } from "@frennix/ui";

export default function FollowingScreen() {
  const { userId: profileUserId } = useLocalSearchParams<{ userId: string }>();
  const { session } = useAuth();
  const currentUserId = session?.user.id ?? "";

  const { data: following = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["following", profileUserId],
    queryFn: () => getFollowing(profileUserId!),
    enabled: !!profileUserId,
  });

  const { data: followingIds = [] } = useQuery({
    queryKey: ["following-ids", currentUserId],
    queryFn: () => getFollowingIds(currentUserId),
    enabled: !!currentUserId,
  });

  const followingSet = new Set(followingIds);

  return (
    <View style={styles.container}>
      <FlatList
        data={following}
        keyExtractor={(profile) => profile.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent} />
        }
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              title="Not following anyone"
              description="People this user follows will show up here."
            />
          ) : null
        }
        renderItem={({ item }) => (
          <UserFollowRow
            profile={item}
            currentUserId={currentUserId}
            isFollowing={followingSet.has(item.id)}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.md, flexGrow: 1 },
});
