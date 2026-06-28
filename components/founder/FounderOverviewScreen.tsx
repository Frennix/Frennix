import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { FounderShell } from "@/components/founder/FounderShell";
import { FounderWidget } from "@/components/founder/FounderWidget";
import { ExecutiveKpiGrid } from "@/components/founder/ExecutiveKpiGrid";
import { ActivityFeedList } from "@/components/founder/ActivityFeedPanel";
import { FounderFilterBar } from "@/components/founder/FounderFilterBar";
import { useExecutiveDashboard } from "@/lib/founder/useExecutiveDashboard";
import { useFounderActivityFeed } from "@/lib/founder/useFounderActivityFeed";
import { downloadTextFile, rowsToCsv } from "@/lib/founder/utils";
import { colors, spacing, typography } from "@frennix/ui";

export default function FounderOverviewScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const executive = useExecutiveDashboard();
  const activity = useFounderActivityFeed({ preset: "15m", pageSize: 8 });

  const computedAt = executive.data?.computed_at ? new Date(executive.data.computed_at) : null;

  return (
    <FounderShell title="Executive Dashboard">
      <ScrollView contentContainerStyle={styles.scroll}>
        <FounderWidget
          title="Executive KPIs"
          subtitle={executive.data?.release?.version ? `Release ${executive.data.release.version}` : "Live metrics"}
          loading={executive.isLoading && !executive.data}
          error={executive.isError ? "Could not load KPIs" : null}
          updatedAt={computedAt}
          onRefresh={() => void executive.refetch()}
          exportEnabled
          onExport={(format) => {
            const rows = (executive.data?.kpis ?? []).map((kpi) => ({
              key: kpi.key,
              label: kpi.label,
              value: kpi.value ?? "",
            }));
            if (format === "csv") {
              downloadTextFile("frennix-executive-kpis.csv", rowsToCsv(rows), "text/csv");
            } else {
              downloadTextFile("frennix-executive-kpis.json", JSON.stringify(rows, null, 2), "application/json");
            }
          }}
        >
          {executive.data?.kpis ? <ExecutiveKpiGrid kpis={executive.data.kpis} /> : null}
        </FounderWidget>

        <FounderWidget
          title="Live Activity"
          subtitle="Last 15 minutes · real-time"
          loading={activity.isLoading && !activity.data}
          error={activity.isError ? "Could not load activity" : null}
          onRefresh={() => void activity.refetch()}
          filterSlot={
            <FounderFilterBar
              datePreset={activity.state.preset}
              onDatePresetChange={(preset) =>
                activity.setState((s) => ({ ...s, preset, page: 1 }))
              }
              search={activity.state.search}
              onSearchChange={(search) => activity.setState((s) => ({ ...s, search, page: 1 }))}
            />
          }
        >
          <ActivityFeedList items={activity.data?.items ?? []} compact />
          <Text
            style={styles.link}
            onPress={() => router.push("/founder/activity")}
            accessibilityRole="link"
          >
            Open full activity feed →
          </Text>
        </FounderWidget>

        <FounderWidget title="Analytics domains" subtitle="Drill-down modules">
          <View style={styles.domainGrid}>
            {[
              ["Revenue", "/founder/analytics/revenue"],
              ["Subscriptions", "/founder/analytics/subscriptions"],
              ["Matchmaking", "/founder/analytics/matchmaking"],
              ["Crashes", "/founder/analytics/crashes"],
            ].map(([label, href]) => (
              <Text
                key={href}
                style={styles.domainLink}
                onPress={() => router.push(href as never)}
                accessibilityRole="link"
              >
                {label} →
              </Text>
            ))}
          </View>
          <Text style={styles.hint}>
            {width < 768 ? "Tap KPI cards or domain links for detailed views." : "Click any KPI card to drill down."}
          </Text>
        </FounderWidget>
      </ScrollView>
    </FounderShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl, gap: spacing.md },
  link: { ...typography.caption, color: colors.accent, fontWeight: "600", marginTop: spacing.sm },
  domainGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  domainLink: { ...typography.bodySmall, color: colors.accent, minWidth: "45%" },
  hint: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm },
});
