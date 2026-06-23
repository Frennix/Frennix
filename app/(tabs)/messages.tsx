import { useQuery } from "@tanstack/react-query";
import { useIsFocused } from "@react-navigation/native";
import { usePathname } from "expo-router";
import { memo, useCallback, useMemo } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { getConversations } from "@frennix/api";
import type { Conversation } from "@frennix/types";
import { useAuth } from "@/providers/AuthProvider";
import { ReportIssueLink } from "@/components/ReportIssueLink";
import { pushScreen, switchTab } from "@/lib/press-utils";
import { useProfilesPresence } from "@/lib/useProfilesPresence";
import { Avatar, EmptyState, colors, isProfileOnline, spacing, typography } from "@frennix/ui";

function previewText(
  content: string | undefined,
  mediaUrl: string | null | undefined,
  postId: string | null | undefined
) {
  if (postId) return "↗ Shared a post";
  if (mediaUrl && (!content || content === "📷 Photo")) return "📷 Photo";
  return content ?? "Start the conversation";
}

const ConversationRow = memo(function ConversationRow({
  item,
  onPress,
}: {
  item: Conversation;
  onPress: (id: string) => void;
}) {
  return (
    <Pressable style={styles.row} onPress={() => onPress(item.id)}>
      <Avatar
        uri={item.other_participant?.avatar_url}
        name={item.other_participant?.display_name}
        size={52}
        showOnline
        isOnline={isProfileOnline(item.other_participant)}
      />
      <View style={styles.info}>
        <Text style={styles.name}>{item.other_participant?.display_name ?? "Chat"}</Text>
        <Text
          style={[styles.preview, (item.unread_count ?? 0) > 0 && styles.previewUnread]}
          numberOfLines={1}
        >
          {previewText(
            item.last_message?.content,
            item.last_message?.media_url,
            item.last_message?.post_id
          )}
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
  );
});

export default function MessagesScreen() {
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const isFocused = useIsFocused();
  const pathname = usePathname();
  const isListActive = isFocused && !pathname.startsWith("/chat/");

  const { data: conversations = [], refetch, isRefetching, isLoading } = useQuery({
    queryKey: ["conversations", userId],
    queryFn: () => getConversations(userId),
    enabled: !!userId && isListActive,
    staleTime: 30_000,
    refetchInterval: isListActive ? 30_000 : false,
    refetchIntervalInBackground: false,
  });

  const partnerIds = useMemo(
    () =>
      conversations
        .map((conversation) => conversation.other_participant?.id)
        .filter((id): id is string => Boolean(id)),
    [conversations]
  );

  useProfilesPresence(userId, partnerIds);

  const handlePress = useCallback((id: string) => {
    pushScreen(`/chat/${id}`);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: Conversation }) => <ConversationRow item={item} onPress={handlePress} />,
    [handlePress]
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={conversations}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.list}
        initialNumToRender={12}
        maxToRenderPerBatch={8}
        windowSize={7}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent} />
        }
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              title="No messages yet"
              description="Message someone from their profile to find a workout partner or training buddy."
              actionLabel="Discover people"
              onAction={() => switchTab("/(tabs)/discover")}
            />
          ) : null
        }
        ListFooterComponent={<ReportIssueLink area="messages" from="/(tabs)/messages" />}
        renderItem={renderItem}
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
