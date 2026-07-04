import type { WhatsNewKnownIssue, WhatsNewKnownIssueStatus } from "@/features/releases/whats-new";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "@frennix/ui";

const STATUS_LABELS: Record<WhatsNewKnownIssueStatus, string> = {
  under_maintenance: "Under Maintenance",
  coming_soon: "Coming Soon",
  temporary_issue: "Temporary Issue",
};

const STATUS_STYLES: Record<
  WhatsNewKnownIssueStatus,
  { background: string; text: string; border: string }
> = {
  under_maintenance: {
    background: "rgba(251, 191, 36, 0.12)",
    text: "#FCD34D",
    border: "rgba(251, 191, 36, 0.35)",
  },
  coming_soon: {
    background: "rgba(34, 197, 94, 0.1)",
    text: colors.accent,
    border: "rgba(34, 197, 94, 0.3)",
  },
  temporary_issue: {
    background: "rgba(248, 113, 113, 0.1)",
    text: "#FCA5A5",
    border: "rgba(248, 113, 113, 0.3)",
  },
};

type WhatsNewKnownIssuesSectionProps = {
  issues: WhatsNewKnownIssue[];
  intro?: string;
};

function KnownIssueCard({ issue }: { issue: WhatsNewKnownIssue }) {
  const statusStyle = STATUS_STYLES[issue.status];

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.featureName}>{issue.feature}</Text>
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor: statusStyle.background,
              borderColor: statusStyle.border,
            },
          ]}
        >
          <Text style={[styles.statusText, { color: statusStyle.text }]}>
            {STATUS_LABELS[issue.status]}
          </Text>
        </View>
      </View>
      <Text style={styles.explanation}>{issue.explanation}</Text>
      {issue.expectedFixVersion ? (
        <Text style={styles.fixVersion}>Expected fix: {issue.expectedFixVersion}</Text>
      ) : null}
    </View>
  );
}

export function WhatsNewKnownIssuesSection({ issues, intro }: WhatsNewKnownIssuesSectionProps) {
  if (!issues.length) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Known Issues</Text>
      <Text style={styles.intro}>
        {intro ??
          "Some features may be temporarily limited. Check here before reporting a bug — we're likely already on it."}
      </Text>
      {issues.map((issue) => (
        <KnownIssueCard key={issue.feature} issue={issue} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  title: {
    ...typography.body,
    color: colors.text,
    fontWeight: "800",
  },
  intro: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 18,
  },
  card: {
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  featureName: {
    ...typography.body,
    color: colors.text,
    fontWeight: "700",
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusText: {
    ...typography.caption,
    fontWeight: "800",
  },
  explanation: {
    ...typography.bodySmall,
    color: colors.textMuted,
    lineHeight: 20,
  },
  fixVersion: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: "600",
  },
});
