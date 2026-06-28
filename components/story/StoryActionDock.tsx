import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  STORY_CHALLENGE_RESPONSES,
  STORY_QUICK_REACTIONS,
  type StoryChallengeKey,
  type StoryQuickReactionEmoji,
} from "@frennix/types";
import { colors, overlays, radius, spacing, touchTarget, typography } from "@frennix/ui";
import { hapticLight } from "@/lib/haptics";
import {
  readLastStoryReaction,
  writeLastStoryReaction,
} from "@/lib/story-interaction-preferences";
import { StoryReplyBar } from "./StoryReplyBar";

type StoryPanel = "primary" | "more";

type PrimaryActionId =
  | "like"
  | "strong_work"
  | "reaction_fire"
  | "reaction_nice_work"
  | "reply"
  | "more";

type PrimaryAction = {
  id: PrimaryActionId;
  emoji: string;
  label: string;
  reactionEmoji?: StoryQuickReactionEmoji;
};

const DEFAULT_REACTION_SLOT: PrimaryAction = {
  id: "strong_work",
  emoji: "💪",
  label: "Strong Work",
  reactionEmoji: "💪",
};

function buildPrimaryActions(lastReaction: StoryQuickReactionEmoji | null): PrimaryAction[] {
  const like: PrimaryAction = {
    id: "like",
    emoji: "❤️",
    label: "Like",
    reactionEmoji: "❤️",
  };
  const reply: PrimaryAction = { id: "reply", emoji: "💬", label: "Reply" };
  const more: PrimaryAction = { id: "more", emoji: "⋯", label: "More" };

  let reactionSlot = DEFAULT_REACTION_SLOT;
  if (lastReaction === "🔥") {
    reactionSlot = {
      id: "reaction_fire",
      emoji: "🔥",
      label: "Fire",
      reactionEmoji: "🔥",
    };
  } else if (lastReaction === "👏") {
    reactionSlot = {
      id: "reaction_nice_work",
      emoji: "👏",
      label: "Nice Work",
      reactionEmoji: "👏",
    };
  } else if (lastReaction === "💪") {
    reactionSlot = DEFAULT_REACTION_SLOT;
  }

  return [like, reactionSlot, reply, more];
}

const MORE_REACTIONS = STORY_QUICK_REACTIONS.filter(
  (reaction) => reaction.emoji !== "❤️" && reaction.emoji !== "💪"
);

interface StoryActionDockProps {
  disabled?: boolean;
  isFollowing: boolean;
  followLoading?: boolean;
  inviteLoading?: boolean;
  resetKey?: string;
  onInteractionLockChange?: (locked: boolean) => void;
  onReact: (emoji: StoryQuickReactionEmoji) => void | Promise<void>;
  onChallenge: (key: StoryChallengeKey) => void | Promise<void>;
  onReply: (text: string) => void | Promise<void>;
  onFollow: () => void;
  onInviteToTrain: () => void;
  onViewProfile: () => void;
}

function PrimaryTile({
  emoji,
  label,
  active,
  disabled,
  onPress,
}: {
  emoji: string;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[
        styles.primaryTile,
        active && styles.primaryTileActive,
        disabled && styles.primaryTileDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={label === "More" ? "Opens additional story actions" : `Send ${label}`}
      accessibilityState={{ selected: Boolean(active) }}
    >
      <Text style={styles.primaryEmoji}>{emoji}</Text>
      <Text style={styles.primaryLabel} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function MoreRow({
  emoji,
  label,
  active,
  loading,
  disabled,
  onPress,
}: {
  emoji: string;
  label: string;
  active?: boolean;
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.moreRow, active && styles.moreRowActive, disabled && styles.moreRowDisabled]}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: Boolean(active) }}
    >
      <Text style={styles.moreEmoji}>{emoji}</Text>
      <Text style={styles.moreLabel} numberOfLines={1}>
        {label}
      </Text>
      {loading ? <ActivityIndicator color={colors.text} size="small" /> : null}
    </Pressable>
  );
}

/** Compact story actions — 4 primary tiles with More panel and inline reply. */
export function StoryActionDock({
  disabled,
  isFollowing,
  followLoading,
  inviteLoading,
  resetKey,
  onInteractionLockChange,
  onReact,
  onChallenge,
  onReply,
  onFollow,
  onInviteToTrain,
  onViewProfile,
}: StoryActionDockProps) {
  const [panel, setPanel] = useState<StoryPanel>("primary");
  const [showReply, setShowReply] = useState(false);
  const [replyFocused, setReplyFocused] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [lastReaction, setLastReaction] = useState<StoryQuickReactionEmoji | null>(null);
  const [sessionReaction, setSessionReaction] = useState<StoryQuickReactionEmoji | null>(null);
  const [sentChallenge, setSentChallenge] = useState<StoryChallengeKey | null>(null);

  const expandAnim = useRef(new Animated.Value(0)).current;
  const mountAnim = useRef(new Animated.Value(0)).current;

  const primaryActions = useMemo(() => buildPrimaryActions(lastReaction), [lastReaction]);
  const highlightedReaction = sessionReaction ?? lastReaction;

  const interactionLocked = panel === "more" || showReply || replyFocused || keyboardVisible;

  useEffect(() => {
    void readLastStoryReaction().then(setLastReaction);
  }, []);

  useEffect(() => {
    setPanel("primary");
    setShowReply(false);
    setReplyFocused(false);
    setKeyboardVisible(false);
    setSentChallenge(null);
    mountAnim.setValue(0);
    Animated.spring(mountAnim, {
      toValue: 1,
      useNativeDriver: true,
      damping: 24,
      stiffness: 280,
      mass: 0.9,
    }).start();
  }, [resetKey, mountAnim]);

  useEffect(() => {
    if (!showReply) {
      setReplyFocused(false);
      setKeyboardVisible(false);
    }
  }, [showReply]);

  useEffect(() => {
    if (Platform.OS === "web" || !showReply) return;

    const showSub = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [showReply]);

  useEffect(() => {
    onInteractionLockChange?.(interactionLocked);
  }, [interactionLocked, onInteractionLockChange]);

  useEffect(() => {
    Animated.spring(expandAnim, {
      toValue: panel === "more" || showReply ? 1 : 0,
      useNativeDriver: true,
      damping: 22,
      stiffness: 290,
      mass: 0.88,
    }).start();
  }, [expandAnim, panel, showReply]);

  const replyActive = showReply;

  async function rememberReaction(emoji: StoryQuickReactionEmoji) {
    setSessionReaction(emoji);
    setLastReaction(emoji);
    await writeLastStoryReaction(emoji);
  }

  async function handleReact(emoji: StoryQuickReactionEmoji) {
    await rememberReaction(emoji);
    await onReact(emoji);
  }

  async function handlePrimary(action: PrimaryAction) {
    if (disabled) return;
    hapticLight();

    if (action.reactionEmoji) {
      await handleReact(action.reactionEmoji);
      return;
    }

    switch (action.id) {
      case "reply":
        setPanel("primary");
        setShowReply(true);
        return;
      case "more":
        setShowReply(false);
        setPanel((current) => (current === "more" ? "primary" : "more"));
        return;
      default:
        return;
    }
  }

  async function handleSendReply(text: string) {
    await onReply(text);
    setShowReply(false);
    setPanel("primary");
  }

  const moreSections = useMemo(
    () => [
      {
        title: "Quick Reactions",
        rows: MORE_REACTIONS.map((reaction) => ({
          key: reaction.emoji,
          emoji: reaction.emoji,
          label: reaction.label,
          active: highlightedReaction === reaction.emoji,
          onPress: async () => handleReact(reaction.emoji),
        })),
      },
      {
        title: "Challenges",
        rows: STORY_CHALLENGE_RESPONSES.map((challenge) => ({
          key: challenge.key,
          emoji: "🎯",
          label: challenge.label,
          active: sentChallenge === challenge.key,
          onPress: async () => {
            setSentChallenge(challenge.key);
            await onChallenge(challenge.key);
          },
        })),
      },
      {
        title: "Connect",
        rows: [
          {
            key: "invite",
            emoji: "🤝",
            label: "Invite to Train",
            loading: inviteLoading,
            onPress: onInviteToTrain,
          },
          {
            key: "follow",
            emoji: "➕",
            label: isFollowing ? "Following" : "Follow",
            disabled: isFollowing,
            loading: followLoading,
            onPress: onFollow,
          },
          {
            key: "profile",
            emoji: "👤",
            label: "View Profile",
            onPress: onViewProfile,
          },
        ],
      },
    ],
    [
      followLoading,
      highlightedReaction,
      inviteLoading,
      isFollowing,
      onChallenge,
      onFollow,
      onInviteToTrain,
      onViewProfile,
      sentChallenge,
    ]
  );

  const expandTranslateY = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [28, 0],
  });
  const expandOpacity = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const dockTranslateY = mountAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [48, 0],
  });
  const dockOpacity = mountAnim;

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          opacity: dockOpacity,
          transform: [{ translateY: dockTranslateY }],
        },
      ]}
    >
      {panel === "more" ? (
        <Animated.View
          style={[
            styles.morePanel,
            {
              opacity: expandOpacity,
              transform: [{ translateY: expandTranslateY }],
            },
          ]}
        >
          <View style={styles.moreHeader}>
            <Pressable
              onPress={() => setPanel("primary")}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Back to primary actions"
            >
              <Text style={styles.moreBack}>‹ Back</Text>
            </Pressable>
            <Text style={styles.moreTitle}>More actions</Text>
          </View>
          <ScrollView
            style={styles.moreScroll}
            contentContainerStyle={styles.moreScrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {moreSections.map((section) => (
              <View key={section.title} style={styles.moreSection}>
                <Text style={styles.moreSectionTitle}>{section.title}</Text>
                {section.rows.map((row) => (
                  <MoreRow
                    key={row.key}
                    emoji={row.emoji}
                    label={row.label}
                    active={"active" in row ? row.active : false}
                    loading={"loading" in row ? row.loading : false}
                    disabled={"disabled" in row ? row.disabled : false}
                    onPress={() => void row.onPress()}
                  />
                ))}
              </View>
            ))}
          </ScrollView>
        </Animated.View>
      ) : null}

      {showReply ? (
        <Animated.View
          style={{
            opacity: expandOpacity,
            transform: [{ translateY: expandTranslateY }],
          }}
        >
          <StoryReplyBar
            disabled={disabled}
            compact
            onFocusChange={(focused) => {
              setReplyFocused(focused);
              if (Platform.OS === "web") setKeyboardVisible(focused);
            }}
            onCancel={() => {
              setShowReply(false);
              setPanel("primary");
            }}
            onSend={(text) => handleSendReply(text)}
          />
        </Animated.View>
      ) : null}

      <View style={styles.primaryRow}>
        {primaryActions.map((action) => (
          <PrimaryTile
            key={action.id}
            emoji={action.emoji}
            label={action.label}
            active={
              (action.reactionEmoji && highlightedReaction === action.reactionEmoji) ||
              (action.id === "reply" && replyActive) ||
              (action.id === "more" && panel === "more")
            }
            onPress={() => void handlePrimary(action)}
            disabled={disabled}
          />
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
  },
  primaryRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  primaryTile: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 56,
    maxHeight: 64,
    paddingHorizontal: 2,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: overlays.glass,
    borderWidth: 1,
    borderColor: overlays.glassBorder,
    gap: 2,
  },
  primaryTileActive: {
    borderColor: colors.accent,
    backgroundColor: overlays.accentTint,
  },
  primaryTileDisabled: {
    opacity: 0.55,
  },
  primaryEmoji: {
    fontSize: 20,
    lineHeight: 22,
  },
  primaryLabel: {
    ...typography.caption,
    fontSize: 10,
    lineHeight: 12,
    color: colors.text,
    fontWeight: "700",
    textAlign: "center",
  },
  morePanel: {
    borderRadius: radius.md,
    backgroundColor: "rgba(10, 10, 11, 0.88)",
    borderWidth: 1,
    borderColor: overlays.glassBorder,
    overflow: "hidden",
    maxHeight: 220,
  },
  moreHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: overlays.glassBorder,
  },
  moreBack: {
    ...typography.bodySmall,
    color: colors.accent,
    fontWeight: "700",
  },
  moreTitle: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: "700",
  },
  moreScroll: {
    maxHeight: 180,
  },
  moreScrollContent: {
    padding: spacing.xs,
    gap: spacing.sm,
  },
  moreSection: {
    gap: 4,
  },
  moreSectionTitle: {
    ...typography.caption,
    color: "rgba(255,255,255,0.62)",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    paddingHorizontal: spacing.xs,
  },
  moreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: touchTarget,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: overlays.glass,
  },
  moreRowActive: {
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: overlays.accentTint,
  },
  moreRowDisabled: {
    opacity: 0.55,
  },
  moreEmoji: {
    fontSize: 18,
    lineHeight: 20,
    width: 24,
    textAlign: "center",
  },
  moreLabel: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: "600",
    flex: 1,
  },
});
