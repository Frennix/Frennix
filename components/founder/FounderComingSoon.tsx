import { ScrollView, StyleSheet, Text, View } from "react-native";
import { FounderShell } from "@/components/founder/FounderShell";
import { FounderWidget } from "@/components/founder/FounderWidget";
import { colors, spacing, typography } from "@frennix/ui";

export function FounderComingSoon({
  title,
  milestone,
  description,
}: {
  title: string;
  milestone: string;
  description: string;
}) {
  return (
    <FounderShell title={title}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <FounderWidget title={title} subtitle={`Planned for ${milestone}`}>
          <Text style={styles.body}>{description}</Text>
          <Text style={styles.note}>
            M7.1 delivers the database schema, security model, and dashboard shell. Data widgets,
            charts, and live feeds arrive in upcoming milestones — each built with pagination,
            filtering, search, export, and real-time updates from the start.
          </Text>
        </FounderWidget>
      </ScrollView>
    </FounderShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl },
  body: { ...typography.bodySmall, color: colors.textSecondary, lineHeight: 22 },
  note: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm, lineHeight: 18 },
});
