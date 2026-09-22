import { createElement, useEffect, useReducer, useRef } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { STORY_QUICK_REACTIONS, type StoryQuickReactionEmoji } from "@frennix/types";
import { colors, overlays, radius, spacing, typography } from "@frennix/ui";
import {
  applyStoryReactionConfirmedFromServer,
  applyStoryReactionFailure,
  applyStoryReactionSuccess,
  applyStoryReactionTap,
  createStoryReactionSelection,
  REACTION_DELIVER_ERROR,
  type StoryReactionSelectionState,
} from "@/lib/story-reaction-selection";

type StoryReactionRowProps = {
  disabled?: boolean;
  selectedEmoji?: StoryQuickReactionEmoji | null;
  onReact: (emoji: StoryQuickReactionEmoji) => void | Promise<void>;
  onConfirmed?: (emoji: StoryQuickReactionEmoji) => void;
  onFailed?: () => void;
};

function logReactionUi(event: string, extra: Record<string, unknown> = {}) {
  console.info("[story-reaction-ui]", { event, ...extra, t: Date.now() });
}

function reduceSelection(
  state: StoryReactionSelectionState,
  action:
    | { type: "sync"; emoji: StoryQuickReactionEmoji | null }
    | { type: "replace"; state: StoryReactionSelectionState }
): StoryReactionSelectionState {
  if (action.type === "sync") {
    return applyStoryReactionConfirmedFromServer(state, action.emoji);
  }
  return action.state;
}

export function StoryReactionRow({
  disabled,
  selectedEmoji = null,
  onReact,
  onConfirmed,
  onFailed,
}: StoryReactionRowProps) {
  const [state, dispatch] = useReducer(
    reduceSelection,
    selectedEmoji,
    createStoryReactionSelection
  );
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    dispatch({ type: "sync", emoji: selectedEmoji });
  }, [selectedEmoji]);

  async function handlePress(emoji: StoryQuickReactionEmoji) {
    const current = stateRef.current;
    const next = applyStoryReactionTap(current, emoji);
    dispatch({ type: "replace", state: next.state });
    stateRef.current = next.state;
    logReactionUi("tap-received", {
      emoji,
      requestId: next.requestId,
      selected: next.state.selected,
      disabled: Boolean(disabled),
    });

    if (!next.shouldSend) {
      logReactionUi("unsupported-emoji", { emoji });
      return;
    }
    if (disabled) {
      const failed = applyStoryReactionFailure(stateRef.current, next.requestId);
      dispatch({ type: "replace", state: failed });
      stateRef.current = failed;
      logReactionUi("tap-blocked", { emoji, requestId: next.requestId, disabled: true });
      return;
    }

    logReactionUi("request-started", {
      emoji: next.state.selected,
      requestId: next.requestId,
    });

    try {
      await onReact(next.state.selected!);
      const latest = applyStoryReactionSuccess(stateRef.current, next.requestId, next.state.selected!);
      dispatch({ type: "replace", state: latest });
      stateRef.current = latest;
      if (latest.status === "sent" && latest.confirmed) {
        onConfirmed?.(latest.confirmed);
        logReactionUi("request-succeeded", {
          emoji: latest.confirmed,
          requestId: next.requestId,
        });
      } else {
        logReactionUi("stale-success-ignored", {
          emoji: next.state.selected,
          requestId: next.requestId,
          latestRequestId: latest.latestRequestId,
        });
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : REACTION_DELIVER_ERROR;
      const latest = applyStoryReactionFailure(stateRef.current, next.requestId);
      dispatch({ type: "replace", state: latest });
      stateRef.current = latest;
      logReactionUi(
        latest.status === "error" ? "request-failed" : "stale-failure-ignored",
        { emoji: next.state.selected, requestId: next.requestId, message }
      );
      if (latest.status === "error") onFailed?.();
    }
  }

  return (
    <View style={styles.wrap} pointerEvents="auto" collapsable={false}>
      <View style={styles.row} pointerEvents="auto">
        {STORY_QUICK_REACTIONS.map((reaction) => {
          const selected = state.selected === reaction.emoji;
          const pending = state.status === "pending" && selected;
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
      {state.status === "sent" ? <Text style={styles.statusText}>Reaction sent.</Text> : null}
      {state.status === "error" && state.error ? (
        <Text style={styles.errorText}>{state.error}</Text>
      ) : null}
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
