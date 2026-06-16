import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { getFollowers, getFollowingIds } from "@frennix/api";
import { useAuth } from "@/providers/AuthProvider";
import { UserFollowRow } from "@/components/UserFollowRow";
import { EmptyState, colors, spacing } from "@frennix/ui";

export default function FollowersScreen() {
  const { userId: profileUserId } = useLocalSearchParams<{ userId: string }>();
  const { session } = useAuth();
  const currentUserId = session?.user.id ?? "";

  const { data: followers = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["followers", profileUserId],
    queryFn: () => getFollowers(profileUserId!),
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
        data={followers}
        keyExtractor={(profile) => profile.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent} />
        }
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              title="No followers yet"
              description="When people follow this user, they'll show up here."
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
