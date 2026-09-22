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
  onReact: (emoji: StoryQuickReactionEmoji, requestId: number) => void | Promise<void>;
  onConfirmed?: (emoji: StoryQuickReactionEmoji, requestId: number) => void;
  onFailed?: (message: string, requestId: number) => void;
  onTrace?: (stage: string, requestId: number, emoji: StoryQuickReactionEmoji) => void;
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
  onTrace,
}: StoryReactionRowProps) {
  const [state, dispatch] = useReducer(
    reduceSelection,
    selectedEmoji,
    createStoryReactionSelection
  );
  const stateRef = useRef(state);
  stateRef.current = state;
  const latestRequestIdRef = useRef(state.latestRequestId);

  useEffect(() => {
    dispatch({ type: "sync", emoji: selectedEmoji });
  }, [selectedEmoji]);

  async function handlePress(emoji: StoryQuickReactionEmoji) {
    const current = stateRef.current;
    const next = applyStoryReactionTap(current, emoji);
    dispatch({ type: "replace", state: next.state });
    stateRef.current = next.state;
    if (next.shouldSend) {
      latestRequestIdRef.current = next.requestId;
    }
    logReactionUi("tap-received", {
      emoji,
      requestId: next.requestId,
      selected: next.state.selected,
      shouldSend: next.shouldSend,
      disabled: Boolean(disabled),
    });
    onTrace?.("tap received", next.requestId, next.state.selected ?? emoji);

    if (!next.shouldSend) {
      logReactionUi(
        next.state.status === "error" ? "unsupported-emoji" : "duplicate-in-flight-ignored",
        { emoji, requestId: next.requestId }
      );
      if (next.state.status === "error" && next.state.error) {
        onFailed?.(next.state.error, next.requestId);
      }
      return;
    }
    if (disabled) {
      const failed = applyStoryReactionFailure(
        stateRef.current,
        next.requestId,
        REACTION_DELIVER_ERROR
      );
      dispatch({ type: "replace", state: failed });
      stateRef.current = failed;
      logReactionUi("tap-blocked", { emoji, requestId: next.requestId, disabled: true });
      onFailed?.(REACTION_DELIVER_ERROR, next.requestId);
      return;
    }

    logReactionUi("handler-invoked", {
      emoji: next.state.selected,
      requestId: next.requestId,
    });

    try {
      await Promise.resolve(onReact(next.state.selected!, next.requestId));
      const stillLatest = latestRequestIdRef.current === next.requestId;
      if (!stillLatest) {
        logReactionUi("stale-success-ignored", {
          emoji: next.state.selected,
          requestId: next.requestId,
          latestRequestId: latestRequestIdRef.current,
        });
        return;
      }
      const latest = applyStoryReactionSuccess(
        {
          ...stateRef.current,
          latestRequestId: next.requestId,
        },
        next.requestId,
        next.state.selected!
      );
      dispatch({ type: "replace", state: latest });
      stateRef.current = latest;
      if (latest.confirmed) {
        onConfirmed?.(latest.confirmed, next.requestId);
        logReactionUi("request-succeeded", {
          emoji: latest.confirmed,
          requestId: next.requestId,
        });
      }
    } catch (caught) {
      const message = caught instanceof Error && caught.message
        ? caught.message
        : REACTION_DELIVER_ERROR;
      const stillLatest = latestRequestIdRef.current === next.requestId;
      if (!stillLatest) {
        logReactionUi("stale-failure-ignored", {
          emoji: next.state.selected,
          requestId: next.requestId,
          latestRequestId: latestRequestIdRef.current,
          message,
        });
        return;
      }
      const latest = applyStoryReactionFailure(
        {
          ...stateRef.current,
          latestRequestId: next.requestId,
        },
        next.requestId,
        message
      );
      dispatch({ type: "replace", state: latest });
      stateRef.current = latest;
      logReactionUi("request-failed", {
        emoji: next.state.selected,
        requestId: next.requestId,
        message,
      });
      onFailed?.(message, next.requestId);
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
