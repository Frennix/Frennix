import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import type { FrennixStory, StoryPrivacy, StorySlideMediaType } from "@frennix/types";
import { getStoryPrivacyOption } from "@frennix/types";
import { deleteStory, updateStoryControls } from "@frennix/api";
import { BottomOverlayShell } from "@/components/BottomOverlayShell";
import { StoryPrivacySelector } from "@/components/story/StoryPrivacySelector";
import { saveStoryMediaToDevice } from "@/lib/save-story-media";
import { writeLastStoryPrivacy } from "@/lib/story-privacy-preferences";
import { OVERLAY_Z_INDEX } from "@/lib/overlay-z-index";
import { colors, spacing, typography } from "@frennix/ui";

type SheetView = "menu" | "privacy" | "delete" | "error";

type StoryControlsSheetProps = {
  visible: boolean;
  story: FrennixStory | null;
  mediaType: StorySlideMediaType | null;
  mediaUrl: string | null;
  userId: string;
  onClose: () => void;
  onUpdated: (story: FrennixStory) => void;
  onDeleted: (storyId: string) => void;
  onSaveResult: (result: "shared" | "downloaded", kind: "photo" | "video") => void;
};

export function StoryControlsSheet({
  visible,
  story,
  mediaType,
  mediaUrl,
  userId,
  onClose,
  onUpdated,
  onDeleted,
  onSaveResult,
}: StoryControlsSheetProps) {
  const [view, setView] = useState<SheetView>("menu");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [retryAction, setRetryAction] = useState<"delete" | "save" | "privacy" | "commenting" | null>(
    null
  );
  const [pendingPrivacy, setPendingPrivacy] = useState<StoryPrivacy | null>(null);
  const deletingRef = useRef(false);

  useEffect(() => {
    if (!visible) {
      setView("menu");
      setBusy(false);
      setProgress("");
      setErrorMessage("");
      setRetryAction(null);
      setPendingPrivacy(null);
      deletingRef.current = false;
    }
  }, [visible]);

  if (!story) return null;

  const saveLabel = mediaType === "video" ? "Save video" : "Save photo";
  const canSave = Boolean(mediaUrl) && (mediaType === "photo" || mediaType === "video");
  const commentingLabel = story.commenting_enabled ? "Turn commenting off" : "Turn commenting on";

  function showError(message: string, action: typeof retryAction) {
    setErrorMessage(message);
    setRetryAction(action);
    setView("error");
    setBusy(false);
    setProgress("");
  }

  async function handleSave() {
    if (!mediaUrl || busy) return;
    setBusy(true);
    setProgress(mediaType === "video" ? "Preparing video…" : "Preparing photo…");
    try {
      const result = await saveStoryMediaToDevice({
        url: mediaUrl,
        kind: mediaType === "video" ? "video" : "photo",
        filenameStem: `frennix-story-${story.id.slice(0, 8)}`,
        onProgress: setProgress,
      });
      setBusy(false);
      setProgress("");
      onSaveResult(result, mediaType === "video" ? "video" : "photo");
      onClose();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setBusy(false);
        setProgress("");
        return;
      }
      showError(
        error instanceof Error ? error.message : "Could not save this story. Try again.",
        "save"
      );
    }
  }

  async function handleCommentingToggle() {
    if (busy) return;
    setBusy(true);
    try {
      const updated = await updateStoryControls(story.id, userId, {
        commenting_enabled: !story.commenting_enabled,
      });
      onUpdated(updated);
      setBusy(false);
    } catch (error) {
      showError(
        error instanceof Error ? error.message : "Could not update commenting. Try again.",
        "commenting"
      );
    }
  }

  async function handlePrivacySave(privacy: StoryPrivacy) {
    if (busy) return;
    setBusy(true);
    setPendingPrivacy(privacy);
    try {
      const updated = await updateStoryControls(story.id, userId, { privacy });
      await writeLastStoryPrivacy(privacy);
      onUpdated(updated);
      setBusy(false);
      setPendingPrivacy(null);
      setView("menu");
    } catch (error) {
      showError(
        error instanceof Error ? error.message : "Could not update story privacy. Try again.",
        "privacy"
      );
    }
  }

  async function handleDelete() {
    if (busy || deletingRef.current) return;
    deletingRef.current = true;
    setBusy(true);
    try {
      await deleteStory(story.id, userId);
      onDeleted(story.id);
    } catch (error) {
      deletingRef.current = false;
      showError(
        error instanceof Error ? error.message : "Could not delete this story. Try again.",
        "delete"
      );
    }
  }

  function retry() {
    if (retryAction === "delete") {
      setView("delete");
      void handleDelete();
      return;
    }
    if (retryAction === "save") {
      setView("menu");
      void handleSave();
      return;
    }
    if (retryAction === "privacy" && pendingPrivacy) {
      setView("privacy");
      void handlePrivacySave(pendingPrivacy);
      return;
    }
    if (retryAction === "commenting") {
      setView("menu");
      void handleCommentingToggle();
    }
  }

  return (
    <BottomOverlayShell
      visible={visible}
      onClose={busy ? () => undefined : onClose}
      dismissOnBackdrop={!busy}
      rootPortal
      webZIndex={OVERLAY_Z_INDEX.commentOptions}
      backdropColor="rgba(10, 10, 11, 0.92)"
      accessibilityViewIsModal
    >
      <View style={styles.sheet}>
        <Text style={styles.title}>
          {view === "privacy"
            ? "Story privacy"
            : view === "delete"
              ? "Delete this story?"
              : view === "error"
                ? "Something went wrong"
                : "Story controls"}
        </Text>

        {view === "menu" ? (
          <>
            <Pressable
              style={styles.option}
              onPress={() => setView("privacy")}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Story privacy"
            >
              <Text style={styles.optionText}>Story privacy</Text>
              <Text style={styles.optionHint}>{getStoryPrivacyOption(story.privacy).label}</Text>
            </Pressable>
            {canSave ? (
              <Pressable
                style={styles.option}
                onPress={() => void handleSave()}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={saveLabel}
              >
                <Text style={styles.optionText}>{saveLabel}</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={styles.option}
              onPress={() => void handleCommentingToggle()}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={commentingLabel}
            >
              <Text style={styles.optionText}>{commentingLabel}</Text>
            </Pressable>
            <Pressable
              style={styles.option}
              onPress={() => setView("delete")}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Delete story"
            >
              <Text style={styles.dangerText}>Delete story</Text>
            </Pressable>
            <Pressable style={[styles.option, styles.cancel]} onPress={onClose} disabled={busy}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </>
        ) : null}

        {view === "privacy" ? (
          <>
            <StoryPrivacySelector
              value={pendingPrivacy ?? story.privacy}
              onChange={(privacy) => void handlePrivacySave(privacy)}
              disabled={busy}
            />
            <Pressable style={[styles.option, styles.cancel]} onPress={() => setView("menu")} disabled={busy}>
              <Text style={styles.cancelText}>Back</Text>
            </Pressable>
          </>
        ) : null}

        {view === "delete" ? (
          <>
            <Text style={styles.message}>This story will be permanently removed.</Text>
            <Pressable
              style={styles.option}
              onPress={() => void handleDelete()}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Delete"
            >
              <Text style={styles.dangerText}>Delete</Text>
            </Pressable>
            <Pressable
              style={[styles.option, styles.cancel]}
              onPress={() => setView("menu")}
              disabled={busy}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </>
        ) : null}

        {view === "error" ? (
          <>
            <Text style={styles.message}>{errorMessage}</Text>
            <Pressable style={styles.option} onPress={retry} disabled={busy}>
              <Text style={styles.optionText}>Retry</Text>
            </Pressable>
            <Pressable style={[styles.option, styles.cancel]} onPress={onClose} disabled={busy}>
              <Text style={styles.cancelText}>Close</Text>
            </Pressable>
          </>
        ) : null}

        {busy ? (
          <View style={styles.busyRow}>
            <ActivityIndicator color={colors.text} size="small" />
            <Text style={styles.progress}>{progress || "Working…"}</Text>
          </View>
        ) : null}
      </View>
    </BottomOverlayShell>
  );
}

const styles = StyleSheet.create({
  sheet: {
    paddingBottom: spacing.lg,
    gap: spacing.xs,
  },
  title: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: "center",
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    fontWeight: "700",
  },
  option: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: "center",
    minHeight: 48,
    justifyContent: "center",
  },
  optionText: {
    ...typography.body,
    fontWeight: "600",
    color: colors.text,
  },
  optionHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  dangerText: {
    ...typography.body,
    fontWeight: "700",
    color: colors.danger,
  },
  cancel: {
    backgroundColor: colors.surfaceElevated,
  },
  cancelText: {
    ...typography.body,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  message: {
    ...typography.body,
    color: colors.text,
    textAlign: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  busyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  progress: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
