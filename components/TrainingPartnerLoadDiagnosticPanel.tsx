import { useCallback, useMemo } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import {
  formatMatchCandidatesLoadDiagnosticText,
  type MatchCandidatesLoadDiagnostic,
} from "@frennix/api";
import { showAlert, showSuccess } from "@/lib/alerts";
import { TRAINING_PARTNER_LOAD_DEBUG_STORAGE_KEY } from "@/lib/training-partner-load-diagnostics";
import { colors, spacing, typography } from "@frennix/ui";

type TrainingPartnerLoadDiagnosticPanelProps = {
  diagnostic: MatchCandidatesLoadDiagnostic;
};

export function TrainingPartnerLoadDiagnosticPanel({
  diagnostic,
}: TrainingPartnerLoadDiagnosticPanelProps) {
  const reportText = useMemo(
    () => formatMatchCandidatesLoadDiagnosticText(diagnostic),
    [diagnostic]
  );

  const copyReport = useCallback(async () => {
    if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(reportText);
      showSuccess("Error details copied");
      return;
    }
    showAlert("Training Partners diagnostic", reportText);
  }, [reportText]);

  return (
    <View
      style={styles.panel}
      nativeID="training-partner-load-diagnostic-panel"
      accessibilityLabel="Training partner load diagnostic details"
    >
      <Text style={styles.heading}>Developer diagnostic (temporary)</Text>
      <Text style={styles.line}>Failed step: {diagnostic.step}</Text>
      <Text style={styles.line}>
        HTTP status: {diagnostic.httpStatus ?? "unknown"}
      </Text>
      <Text style={styles.line}>
        Supabase code: {diagnostic.supabaseCode ?? "none"}
      </Text>
      <Text style={styles.message}>Message: {diagnostic.message}</Text>
      <Text style={styles.muted}>Captured: {diagnostic.capturedAt}</Text>
      <Pressable style={styles.button} onPress={() => void copyReport()}>
        <Text style={styles.buttonText}>Copy Error Details</Text>
      </Pressable>
      <Text style={styles.hint}>
        Admin/founder only, or enable debug with{" "}
        {TRAINING_PARTNER_LOAD_DEBUG_STORAGE_KEY}=1 in localStorage.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.xs,
    maxWidth: 360,
    width: "100%",
  },
  heading: {
    ...typography.bodySmall,
    fontWeight: "800",
    color: colors.text,
  },
  line: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 18,
  },
  message: {
    ...typography.caption,
    color: colors.text,
    lineHeight: 18,
  },
  muted: {
    ...typography.caption,
    color: colors.textMuted,
    opacity: 0.85,
    lineHeight: 16,
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
    opacity: 0.75,
    lineHeight: 16,
    marginTop: spacing.xs,
  },
  button: {
    alignSelf: "flex-start",
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  buttonText: {
    ...typography.caption,
    color: colors.background,
    fontWeight: "700",
  },
});
