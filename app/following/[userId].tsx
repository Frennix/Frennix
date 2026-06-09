import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, router } from "expo-router";
import { FlatList, StyleSheet, View } from "react-native";
import { getFollowing } from "@frennix/api";
import { EmptyState, UserRow, colors, spacing } from "@frennix/ui";

export default function FollowingScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();

  const { data: following = [], isLoading } = useQuery({
    queryKey: ["following", userId],
    queryFn: () => getFollowing(userId!),
    enabled: !!userId,
  });

  return (
    <View style={styles.container}>
      <FlatList
        data={following}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState title="Not following anyone" description="People this user follows will show up here." />
          ) : null
        }
        renderItem={({ item }) => (
          <UserRow
            profile={item}
            subtitle={item.city ?? undefined}
            onPress={() => router.push(`/user/${item.username}`)}
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
