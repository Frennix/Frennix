import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  dismissBetaMotivationSurvey,
  getBetaMotivationSurveyPrompt,
  submitBetaMotivationSurvey,
} from "@frennix/api";
import type { BetaMotivationSurveyAnswer } from "@frennix/types";
import { BETA_MOTIVATION_SURVEY_OPTIONS } from "@frennix/types";
import { useAuth } from "@/providers/AuthProvider";
import { useCenterOverlaySafeArea } from "@/components/BottomOverlayShell";
import { Button, colors, spacing, typography } from "@frennix/ui";

/** One-time 30-day motivation/connection survey for beta traction measurement. */
export function BetaMotivationSurveyPrompt() {
  const { session, authReady } = useAuth();
  const [visible, setVisible] = useState(false);
  const [checking, setChecking] = useState(true);
  const [selected, setSelected] = useState<BetaMotivationSurveyAnswer | null>(null);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authReady || !session?.user.id) {
      setChecking(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const prompt = await getBetaMotivationSurveyPrompt();
        if (!cancelled && prompt.show) {
          setVisible(true);
        }
      } catch {
        // Non-blocking — survey should never break the app shell.
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authReady, session?.user.id]);

  const dismiss = useCallback(async () => {
    setVisible(false);
    try {
      await dismissBetaMotivationSurvey();
    } catch {
      // Best-effort dismiss tracking.
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!selected) {
      setError("Please choose an answer.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await submitBetaMotivationSurvey(selected, feedback);
      setVisible(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit survey.");
    } finally {
      setSubmitting(false);
    }
  }, [feedback, selected]);

  const { backdropStyle } = useCenterOverlaySafeArea(visible);

  if (checking || !visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={() => void dismiss()}
      accessibilityViewIsModal
    >
      <View style={[styles.backdrop, ...backdropStyle]}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>Beta check-in</Text>
          <Text style={styles.title}>
            Has Frennix helped you feel more motivated or connected this month?
          </Text>

          <View style={styles.options}>
            {BETA_MOTIVATION_SURVEY_OPTIONS.map((option) => {
              const active = selected === option.value;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  onPress={() => setSelected(option.value)}
                  style={[styles.option, active && styles.optionActive]}
                >
                  <Text style={[styles.optionText, active && styles.optionTextActive]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.feedbackLabel}>What has Frennix helped you with most? (optional)</Text>
          <TextInput
            value={feedback}
            onChangeText={setFeedback}
            placeholder="Share a quick note…"
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={500}
            style={styles.feedbackInput}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.actions}>
            <Button
              title={submitting ? "Submitting…" : "Submit"}
              onPress={() => void handleSubmit()}
              disabled={submitting}
            />
            {submitting ? <ActivityIndicator color={colors.accent} /> : null}
            <Pressable onPress={() => void dismiss()} style={styles.laterButton}>
              <Text style={styles.laterText}>Not now</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    padding: spacing.lg,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  eyebrow: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  title: {
    ...typography.heading,
    color: colors.text,
    fontWeight: "800",
    fontSize: 20,
    lineHeight: 28,
  },
  options: { gap: spacing.xs, paddingTop: spacing.xs },
  option: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  optionActive: {
    borderColor: colors.accent,
    backgroundColor: colors.surface,
  },
  optionText: { ...typography.bodySmall, color: colors.textSecondary },
  optionTextActive: { color: colors.text, fontWeight: "600" },
  feedbackLabel: {
    ...typography.caption,
    color: colors.textMuted,
    paddingTop: spacing.xs,
  },
  feedbackInput: {
    minHeight: 72,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.sm,
    ...typography.bodySmall,
    color: colors.text,
    textAlignVertical: "top",
  },
  error: { ...typography.caption, color: colors.warning },
  actions: { gap: spacing.sm, paddingTop: spacing.sm },
  laterButton: { alignItems: "center", paddingVertical: spacing.sm },
  laterText: {
    ...typography.bodySmall,
    color: colors.textMuted,
    fontWeight: "600",
  },
});
