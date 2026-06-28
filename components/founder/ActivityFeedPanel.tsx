import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import type { FounderActivityEvent } from "@frennix/types";
import { ACTIVITY_KIND_EMOJI } from "@frennix/types";
import { formatActivityTime } from "@/lib/founder/utils";
import { colors, spacing, typography } from "@frennix/ui";

type ActivityFeedListProps = {
  items: FounderActivityEvent[];
  compact?: boolean;
  onEndReached?: () => void;
  ListFooterComponent?: React.ReactElement | null;
};

function ActivityRow({ item, compact }: { item: FounderActivityEvent; compact?: boolean }) {
  const emoji = ACTIVITY_KIND_EMOJI[item.kind] ?? "•";
  return (
    <View style={[styles.row, compact && styles.rowCompact]}>
      <Text style={styles.emoji}>{emoji}</Text>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={compact ? 1 : 2}>
          {item.title}
          {item.summary ? ` — ${item.summary}` : ""}
        </Text>
        {!compact ? (
          <Text style={styles.meta}>
            {item.category} · {formatActivityTime(item.created_at)}
          </Text>
        ) : (
          <Text style={styles.meta}>{formatActivityTime(item.created_at)}</Text>
        )}
      </View>
    </View>
  );
}

export function ActivityFeedList({
  items,
  compact,
  onEndReached,
  ListFooterComponent,
}: ActivityFeedListProps) {
  if (!items.length) {
    return <Text style={styles.empty}>No activity in this range.</Text>;
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <ActivityRow item={item} compact={compact} />}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.4}
      ListFooterComponent={ListFooterComponent}
      scrollEnabled={!compact}
      style={compact ? styles.compactList : undefined}
    />
  );
}

type PaginationBarProps = {
  page: number;
  hasMore: boolean;
  total: number;
  onPrev: () => void;
  onNext: () => void;
};

export function ActivityPaginationBar({ page, hasMore, total, onPrev, onNext }: PaginationBarProps) {
  return (
    <View style={styles.pagination}>
      <Pressable
        accessibilityRole="button"
        disabled={page <= 1}
        onPress={onPrev}
        style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}
      >
        <Text style={styles.pageBtnText}>Prev</Text>
      </Pressable>
      <Text style={styles.pageMeta}>
        Page {page} · {total.toLocaleString()} events
      </Text>
      <Pressable
        accessibilityRole="button"
        disabled={!hasMore}
        onPress={onNext}
        style={[styles.pageBtn, !hasMore && styles.pageBtnDisabled]}
      >
        <Text style={styles.pageBtnText}>Next</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowCompact: { paddingVertical: spacing.xs },
  emoji: { width: 24, fontSize: 16, marginTop: 2 },
  body: { flex: 1, minWidth: 0 },
  title: { ...typography.bodySmall, color: colors.text },
  meta: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  empty: { ...typography.bodySmall, color: colors.textMuted, paddingVertical: spacing.md },
  compactList: { maxHeight: 220 },
  pagination: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  pageBtn: {
    minHeight: 40,
    minWidth: 64,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
  },
  pageBtnDisabled: { opacity: 0.4 },
  pageBtnText: { ...typography.caption, color: colors.accent, fontWeight: "600" },
  pageMeta: { ...typography.caption, color: colors.textSecondary, flex: 1, textAlign: "center" },
});
