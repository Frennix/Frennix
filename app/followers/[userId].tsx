import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, router } from "expo-router";
import { FlatList, StyleSheet, View } from "react-native";
import { getFollowers } from "@frennix/api";
import { EmptyState, UserRow, colors, spacing } from "@frennix/ui";

export default function FollowersScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();

  const { data: followers = [], isLoading } = useQuery({
    queryKey: ["followers", userId],
    queryFn: () => getFollowers(userId!),
    enabled: !!userId,
  });

  return (
    <View style={styles.container}>
      <FlatList
        data={followers}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState title="No followers yet" description="When people follow this user, they'll show up here." />
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
