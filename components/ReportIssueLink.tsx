import { Pressable, StyleSheet, Text } from "react-native";
import type { FeedbackFeatureArea } from "@frennix/types";
import { feedbackHref } from "@/lib/feedback-context";
import { pushScreen } from "@/lib/press-utils";
import { colors, spacing, typography } from "@frennix/ui";

type ReportIssueLinkProps = {
  area: FeedbackFeatureArea;
  from?: string;
  label?: string;
};

export function ReportIssueLink({ area, from, label = "Report an issue" }: ReportIssueLinkProps) {
  return (
    <Pressable style={styles.link} onPress={() => pushScreen(feedbackHref(area, from))}>
      <Text style={styles.linkText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: { paddingVertical: spacing.sm, alignItems: "center" },
  linkText: { ...typography.caption, color: colors.accent, fontWeight: "600" },
});
