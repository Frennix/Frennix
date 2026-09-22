import { createElement, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import {
  canonicalizeStoryReaction,
  STORY_QUICK_REACTIONS,
  type StoryQuickReactionEmoji,
} from "@frennix/types";
import { colors, overlays, radius, spacing, typography } from "@frennix/ui";

const REACTION_TAP_LOCK_MS = 450;
const REACTION_DELIVER_ERROR = "Reaction couldn’t be delivered. Try again.";

type StoryReactionRowProps = {
  disabled?: boolean;
  selectedEmoji?: StoryQuickReactionEmoji | null;
  onReact: (emoji: StoryQuickReactionEmoji) => void | Promise<void>;
};

function logReactionUi(event: string, extra: Record<string, unknown> = {}) {
  console.info("[story-reaction-ui]", { event, ...extra, t: Date.now() });
}

export function StoryReactionRow({ disabled, selectedEmoji = null, onReact }: StoryReactionRowProps) {
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pendingEmoji, setPendingEmoji] = useState<StoryQuickReactionEmoji | null>(null);
  const inFlightRef = useRef(false);
  const lastTapAtRef = useRef(0);

  async function handlePress(emoji: StoryQuickReactionEmoji) {
    const canonical = canonicalizeStoryReaction(emoji);
    logReactionUi("tap-received", {
      emoji,
      reactionKey: canonical?.key ?? null,
      disabled: Boolean(disabled),
      selectedEmoji,
    });
    if (!canonical) {
      setError(REACTION_DELIVER_ERROR);
      setStatus(null);
      logReactionUi("unsupported-emoji", { emoji });
      return;
    }
    if (disabled || inFlightRef.current) {
      logReactionUi("tap-blocked", {
        emoji,
        reactionKey: canonical.key,
        disabled: Boolean(disabled),
        inFlight: inFlightRef.current,
      });
      return;
    }
    const now = Date.now();
    if (now - lastTapAtRef.current < REACTION_TAP_LOCK_MS) {
      logReactionUi("tap-debounced", { emoji, reactionKey: canonical.key });
      return;
    }
    lastTapAtRef.current = now;

    inFlightRef.current = true;
    setPendingEmoji(canonical.emoji);
    setError(null);
    setStatus(null);
    logReactionUi("request-started", { emoji: canonical.emoji, reactionKey: canonical.key });

    try {
      await onReact(canonical.emoji);
      setStatus("Reaction sent.");
      logReactionUi("request-succeeded", { emoji: canonical.emoji, reactionKey: canonical.key });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : REACTION_DELIVER_ERROR;
      setError(REACTION_DELIVER_ERROR);
      setStatus(null);
      logReactionUi("request-failed", { emoji: canonical.emoji, reactionKey: canonical.key, message });
    } finally {
      inFlightRef.current = false;
      setPendingEmoji(null);
    }
  }

  return (
    <View style={styles.wrap} pointerEvents="auto" collapsable={false}>
      <View style={styles.row} pointerEvents="auto">
        {STORY_QUICK_REACTIONS.map((reaction) => {
          const selected = selectedEmoji === reaction.emoji || pendingEmoji === reaction.emoji;
          const pending = pendingEmoji === reaction.emoji;
          const chipStyle = [
            styles.chip,
            selected && styles.chipSelected,
            pending && styles.chipPressed,
            disabled && styles.chipDisabled,
          ];

          if (Platform.OS === "web") {
            return createElement(
              "button",
              {
                key: reaction.emoji,
                type: "button",
                disabled: Boolean(disabled),
                "aria-label": reaction.label,
                "aria-pressed": selected,
                onClick: (event: { stopPropagation?: () => void; preventDefault?: () => void }) => {
                  event.preventDefault?.();
                  event.stopPropagation?.();
                  logReactionUi("web-click", { emoji: reaction.emoji, reactionKey: reaction.key });
                  void handlePress(reaction.emoji);
                },
                style: {
                  width: "22%",
                  minWidth: 48,
                  minHeight: 48,
                  paddingLeft: 8,
                  paddingRight: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 12,
                  backgroundColor: selected ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.12)",
                  borderWidth: 1,
                  borderStyle: "solid",
                  borderColor: selected ? colors.accent : "rgba(255,255,255,0.18)",
                  flexGrow: 0,
                  flexShrink: 0,
                  cursor: disabled ? "default" : "pointer",
                  touchAction: "manipulation",
                  WebkitUserSelect: "none",
                  userSelect: "none",
                  opacity: disabled ? 0.55 : pending ? 0.82 : 1,
                  pointerEvents: "auto",
                  position: "relative",
                  zIndex: 50,
                },
              },
              createElement(Text, { style: styles.emoji }, reaction.emoji)
            );
          }

          return (
            <Pressable
              key={reaction.emoji}
              style={({ pressed }) => [...chipStyle, pressed && styles.chipPressed]}
              onPressIn={() => logReactionUi("press-in", { emoji: reaction.emoji })}
              onPress={() => void handlePress(reaction.emoji)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={reaction.label}
              accessibilityState={{ selected, disabled: Boolean(disabled) }}
            >
              <Text style={styles.emoji}>{reaction.emoji}</Text>
            </Pressable>
          );
        })}
      </View>
      {status ? <Text style={styles.statusText}>{status}</Text> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    zIndex: 40,
    elevation: 40,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.xs,
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
  },
  chip: {
    width: "22%",
    minWidth: 48,
    minHeight: 48,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: overlays.glass,
    borderWidth: 1,
    borderColor: overlays.glassBorder,
    flexGrow: 0,
    flexShrink: 0,
    zIndex: 50,
  },
  chipSelected: {
    borderColor: colors.accent,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  chipPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.96 }],
  },
  chipDisabled: {
    opacity: 0.55,
  },
  emoji: {
    fontSize: 20,
    lineHeight: 22,
  },
  statusText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: "700",
    marginTop: spacing.xs,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    fontWeight: "700",
    marginTop: spacing.xs,
  },
});
