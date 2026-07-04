import { useCallback, useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@/providers/AuthProvider";
import {
  getLatestWhatsNewRelease,
  getWhatsNewLaunchPromptVersion,
  markWhatsNewLaunchPromptSeen,
  shouldShowWhatsNewLaunchPrompt,
} from "@/lib/whats-new";
import { pushScreen } from "@/lib/press-utils";
import { Button, colors, spacing, typography } from "@frennix/ui";

/** One-time prompt after a major update — routes users to Release Notes. */
export function WhatsNewLaunchPrompt() {
  const { session, authReady } = useAuth();
  const [visible, setVisible] = useState(false);
  const [checking, setChecking] = useState(true);

  const promptVersion = getWhatsNewLaunchPromptVersion();
  const latestRelease = getLatestWhatsNewRelease();

  useEffect(() => {
    if (!authReady || !session?.user.id || !promptVersion) {
      setChecking(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      const show = await shouldShowWhatsNewLaunchPrompt();
      if (!cancelled && show) {
        setVisible(true);
      }
      if (!cancelled) setChecking(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [authReady, session?.user.id, promptVersion]);

  const dismiss = useCallback(async () => {
    setVisible(false);
    if (promptVersion) {
      await markWhatsNewLaunchPromptSeen(promptVersion);
    }
  }, [promptVersion]);

  const handleViewReleaseNotes = useCallback(async () => {
    await dismiss();
    pushScreen("/whats-new");
  }, [dismiss]);

  if (checking || !visible || !promptVersion || !latestRelease) {
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
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>What&apos;s New · {promptVersion}</Text>
          <Text style={styles.title}>{latestRelease.title}</Text>
          <Text style={styles.summary}>{latestRelease.summary}</Text>
          <Text style={styles.hint}>
            See new features, known issues, and what we&apos;re building next.
          </Text>
          <View style={styles.actions}>
            <Button title="View Release Notes" onPress={() => void handleViewReleaseNotes()} />
            <Pressable onPress={() => void dismiss()} style={styles.laterButton}>
              <Text style={styles.laterText}>Later</Text>
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
    maxWidth: 400,
    padding: spacing.lg,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accent,
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
  },
  summary: {
    ...typography.bodySmall,
    color: colors.text,
    lineHeight: 22,
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 18,
    paddingTop: spacing.xs,
  },
  actions: { gap: spacing.sm, paddingTop: spacing.sm },
  laterButton: { alignItems: "center", paddingVertical: spacing.sm },
  laterText: {
    ...typography.bodySmall,
    color: colors.textMuted,
    fontWeight: "600",
  },
});
