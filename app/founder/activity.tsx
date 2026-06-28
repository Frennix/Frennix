import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { FounderShell } from "@/components/founder/FounderShell";
import { FounderWidget } from "@/components/founder/FounderWidget";
import {
  ActivityFeedList,
  ActivityPaginationBar,
} from "@/components/founder/ActivityFeedPanel";
import { FounderFilterBar } from "@/components/founder/FounderFilterBar";
import { useFounderActivityFeed } from "@/lib/founder/useFounderActivityFeed";
import { downloadTextFile, rowsToCsv } from "@/lib/founder/utils";
import { spacing } from "@frennix/ui";

export default function FounderActivityScreen() {
  const feed = useFounderActivityFeed();

  const handleExport = async (format: "csv" | "json") => {
    const { rows } = await feed.exportFeed(format);
    const flat = rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      category: row.category,
      title: row.title,
      summary: row.summary ?? "",
      severity: row.severity,
      created_at: row.created_at,
    }));
    if (format === "csv") {
      downloadTextFile("frennix-activity.csv", rowsToCsv(flat), "text/csv");
    } else {
      downloadTextFile("frennix-activity.json", JSON.stringify(flat, null, 2), "application/json");
    }
  };

  return (
    <FounderShell title="Live Activity Feed">
      <View style={styles.container}>
        <FounderWidget
          title="Operations center"
          subtitle="Real-time · filterable · exportable"
          loading={feed.isLoading && !feed.data}
          error={feed.isError ? "Could not load activity feed" : null}
          onRefresh={() => void feed.refetch()}
          exportEnabled
          onExport={(format) => void handleExport(format)}
          filterSlot={
            <FounderFilterBar
              datePreset={feed.state.preset}
              onDatePresetChange={(preset) => feed.setState((s) => ({ ...s, preset, page: 1 }))}
              category={feed.state.category}
              onCategoryChange={(category) => feed.setState((s) => ({ ...s, category, page: 1 }))}
              search={feed.state.search}
              onSearchChange={(search) => feed.setState((s) => ({ ...s, search, page: 1 }))}
              sortDir={feed.state.sortDir}
              onSortDirToggle={() =>
                feed.setState((s) => ({
                  ...s,
                  sortDir: s.sortDir === "desc" ? "asc" : "desc",
                  page: 1,
                }))
              }
              showCategoryFilters
            />
          }
        >
          <ScrollView style={styles.listWrap} contentContainerStyle={styles.listContent}>
            <ActivityFeedList
              items={feed.data?.items ?? []}
              ListFooterComponent={
                feed.isFetching ? <ActivityIndicator style={{ marginVertical: spacing.md }} /> : null
              }
            />
            <ActivityPaginationBar
              page={feed.state.page}
              hasMore={feed.data?.hasMore ?? false}
              total={feed.data?.total ?? 0}
              onPrev={() => feed.setState((s) => ({ ...s, page: Math.max(1, s.page - 1) }))}
              onNext={() => feed.setState((s) => ({ ...s, page: s.page + 1 }))}
            />
          </ScrollView>
        </FounderWidget>
      </View>
    </FounderShell>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listWrap: { flex: 1, maxHeight: 600 },
  listContent: { paddingBottom: spacing.xl },
});
