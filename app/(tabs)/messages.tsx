import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { getConversations } from "@frennix/api";
import { useAuth } from "@/providers/AuthProvider";
import { Avatar, EmptyState, colors, spacing, typography } from "@frennix/ui";

export default function MessagesScreen() {
  const { session } = useAuth();
  const userId = session?.user.id ?? "";

  const { data: conversations = [] } = useQuery({
    queryKey: ["conversations", userId],
    queryFn: () => getConversations(userId),
    enabled: !!userId,
    refetchInterval: 10_000,
  });

  function previewText(content: string | undefined, mediaUrl: string | null | undefined) {
    if (mediaUrl && (!content || content === "📷 Photo")) return "📷 Photo";
    return content ?? "Start the conversation";
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={conversations}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState
            title="No messages yet"
            description="Message someone from their profile to find a workout partner or training buddy."
            actionLabel="Discover people"
            onAction={() => router.push("/(tabs)/discover")}
          />
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => router.push(`/chat/${item.id}`)}
          >
            <Avatar
              uri={item.other_participant?.avatar_url}
              name={item.other_participant?.display_name}
              size={52}
            />
            <View style={styles.info}>
              <Text style={styles.name}>{item.other_participant?.display_name ?? "Chat"}</Text>
              <Text style={[styles.preview, (item.unread_count ?? 0) > 0 && styles.previewUnread]} numberOfLines={1}>
                {previewText(item.last_message?.content, item.last_message?.media_url)}
              </Text>
            </View>
            {(item.unread_count ?? 0) > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {item.unread_count! > 99 ? "99+" : item.unread_count}
                </Text>
              </View>
            ) : null}
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.md, flexGrow: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  info: { flex: 1 },
  name: { ...typography.body, fontWeight: "600" },
  preview: { ...typography.caption, marginTop: 4 },
  previewUnread: { color: colors.text, fontWeight: "600" },
  badge: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: colors.black, fontSize: 12, fontWeight: "700" },
});
