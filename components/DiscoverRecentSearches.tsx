import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppIcon } from "@/components/AppIcon";
import type { DiscoverRecentSearch } from "@/lib/discover-search-history";
import { colors, spacing, typography } from "@frennix/ui";

type DiscoverRecentSearchesProps = {
  searches: DiscoverRecentSearch[];
  onSelect: (query: string) => void;
  onRemove: (query: string) => void;
  onClearAll: () => void;
};

export function DiscoverRecentSearches({
  searches,
  onSelect,
  onRemove,
  onClearAll,
}: DiscoverRecentSearchesProps) {
  if (!searches.length) return null;

  return (
    <View style={styles.root}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Recent searches</Text>
        <Pressable onPress={onClearAll} hitSlop={8}>
          <Text style={styles.clearAll}>Clear all</Text>
        </Pressable>
      </View>
      <View style={styles.list}>
        {searches.map((entry) => (
          <View key={entry.query} style={styles.item}>
            <Pressable style={styles.queryPress} onPress={() => onSelect(entry.query)}>
              <AppIcon name="circle" size={14} color={colors.textMuted} />
              <Text style={styles.query} numberOfLines={1}>
                {entry.query}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => onRemove(entry.query)}
              hitSlop={8}
              accessibilityLabel={`Remove ${entry.query} from recent searches`}
            >
              <AppIcon name="close" size={16} color={colors.textMuted} />
            </Pressable>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.xs },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { ...typography.caption, fontWeight: "700", color: colors.textSecondary, textTransform: "uppercase" },
  clearAll: { ...typography.caption, color: colors.accent, fontWeight: "600" },
  list: { gap: spacing.xs },
  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  queryPress: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  query: { ...typography.bodySmall, color: colors.text, flex: 1 },
});
