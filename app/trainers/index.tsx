import { useQuery } from "@tanstack/react-query";
import { AppIcon } from "@/components/AppIcon";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { searchTrainers } from "@frennix/api";
import type { TrainerSearchFilters } from "@frennix/types";
import { TrainerDiscoveryCard } from "@/components/TrainerDiscoveryCard";
import { TrainerFilterSheet } from "@/components/TrainerFilterSheet";
import { FrennixLogo } from "@/components/FrennixLogo";
import { ReportIssueLink } from "@/components/ReportIssueLink";
import { pushScreen } from "@/lib/press-utils";
import { useAuth } from "@/providers/AuthProvider";
import { EmptyState, Input, colors, spacing, typography } from "@frennix/ui";

export default function TrainerDiscoveryScreen() {
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<TrainerSearchFilters>({});
  const [draftFilters, setDraftFilters] = useState<TrainerSearchFilters>({});
  const [filtersOpen, setFiltersOpen] = useState(false);

  const activeFilters: TrainerSearchFilters = { ...filters, query: query.trim() || undefined };

  const { data: results = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["trainer-search", userId, activeFilters],
    queryFn: () => searchTrainers(activeFilters),
    enabled: !!userId,
  });

  const openFilters = useCallback(() => {
    setDraftFilters(filters);
    setFiltersOpen(true);
  }, [filters]);

  const applyFilters = useCallback(() => {
    setFilters(draftFilters);
    setFiltersOpen(false);
  }, [draftFilters]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <View style={styles.container}>
      <FrennixLogo variant="icon" height={24} style={styles.logo} />
      <Text style={styles.subtitle}>Professional coaches — separate from Training Partners</Text>

      <View style={styles.searchRow}>
        <View style={styles.searchInput}>
          <Input
            placeholder="Search trainers by name or bio..."
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
          />
        </View>
        <Pressable style={styles.filterButton} onPress={openFilters} accessibilityLabel="Filter trainers">
          <AppIcon name="sliders" color={colors.accent} size={22} />
          {activeFilterCount > 0 ? (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      <Pressable onPress={() => pushScreen("/trainers/connections")}>
        <Text style={styles.link}>View trainer connections</Text>
      </Pressable>

      <FlatList
        data={results}
        keyExtractor={(item) => item.profile.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent} />
        }
        ListHeaderComponent={
          isLoading ? <ActivityIndicator color={colors.accent} style={styles.loader} /> : null
        }
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              title="No trainers found"
              description="Try adjusting filters or check back as more coaches join Frennix."
            />
          ) : null
        }
        renderItem={({ item }) => <TrainerDiscoveryCard result={item} />}
      />

      <TrainerFilterSheet
        visible={filtersOpen}
        filters={draftFilters}
        onChange={setDraftFilters}
        onClose={() => setFiltersOpen(false)}
        onApply={applyFilters}
      />

      <ReportIssueLink area="trainer_matching" from="/trainers" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  logo: { marginBottom: spacing.xs },
  subtitle: { ...typography.bodySmall, color: colors.textMuted, marginBottom: spacing.md },
  searchRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, marginBottom: spacing.sm },
  searchInput: { flex: 1 },
  filterButton: {
    marginTop: spacing.sm,
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: colors.accent,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBadgeText: { ...typography.caption, color: colors.background, fontSize: 10, fontWeight: "700" },
  link: { ...typography.body, color: colors.accent, marginBottom: spacing.md },
  list: { gap: spacing.md, paddingBottom: spacing.xxl },
  loader: { marginVertical: spacing.lg },
});
