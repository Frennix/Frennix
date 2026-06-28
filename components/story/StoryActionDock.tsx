import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  STORY_CHALLENGE_RESPONSES,
  STORY_QUICK_REACTIONS,
  type StoryChallengeKey,
  type StoryQuickReactionEmoji,
} from "@frennix/types";
import { colors, overlays, spacing, typography } from "@frennix/ui";
import { StoryReplyBar } from "./StoryReplyBar";

interface StoryActionDockProps {
  disabled?: boolean;
  isFollowing: boolean;
  followLoading?: boolean;
  inviteLoading?: boolean;
  onReact: (emoji: StoryQuickReactionEmoji) => void | Promise<void>;
  onChallenge: (key: StoryChallengeKey) => void | Promise<void>;
  onReply: (text: string) => void | Promise<void>;
  onFollow: () => void;
  onInviteToTrain: () => void;
  onViewProfile: () => void;
}

/** Unified story engagement: reactions, challenges, and connection actions. */
export function StoryActionDock({
  disabled,
  isFollowing,
  followLoading,
  inviteLoading,
  onReact,
  onChallenge,
  onReply,
  onFollow,
  onInviteToTrain,
  onViewProfile,
}: StoryActionDockProps) {
  const [sentReaction, setSentReaction] = useState<string | null>(null);
  const [sentChallenge, setSentChallenge] = useState<StoryChallengeKey | null>(null);
  const [showReply, setShowReply] = useState(false);

  const challengeItems = useMemo(() => STORY_CHALLENGE_RESPONSES, []);

  return (
    <View style={styles.wrap}>
      <View style={styles.reactionRow}>
        {STORY_QUICK_REACTIONS.map((reaction) => (
          <Pressable
            key={reaction.emoji}
            style={[styles.reactionButton, sentReaction === reaction.emoji && styles.sent]}
            disabled={disabled}
            onPress={async () => {
              setSentReaction(reaction.emoji);
              await onReact(reaction.emoji);
            }}
            accessibilityRole="button"
            accessibilityLabel={reaction.label}
          >
            <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
            <Text style={styles.reactionLabel} numberOfLines={1}>
              {reaction.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.challengeRow}
      >
        {challengeItems.map((challenge) => (
          <Pressable
            key={challenge.key}
            style={[styles.challengeChip, sentChallenge === challenge.key && styles.sent]}
            disabled={disabled}
            onPress={async () => {
              setSentChallenge(challenge.key);
              await onChallenge(challenge.key);
            }}
            accessibilityRole="button"
            accessibilityLabel={challenge.label}
          >
            <Text style={styles.challengeText}>{challenge.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.actionRow}>
        <IconAction
          icon="🤝"
          label="Invite to Train"
          onPress={onInviteToTrain}
          disabled={disabled}
          loading={inviteLoading}
        />
        <IconAction
          icon="💬"
          label="Reply"
          onPress={() => setShowReply((current) => !current)}
          disabled={disabled}
          active={showReply}
        />
        <IconAction
          icon="👤"
          label={isFollowing ? "Following" : "Follow"}
          onPress={onFollow}
          disabled={disabled || isFollowing}
          loading={followLoading}
          active={isFollowing}
        />
        <IconAction icon="📄" label="Profile" onPress={onViewProfile} disabled={disabled} />
      </View>

      {showReply ? (
        <StoryReplyBar disabled={disabled} onSend={(text) => onReply(text)} />
      ) : null}
    </View>
  );
}

function IconAction({
  icon,
  label,
  onPress,
  disabled,
  loading,
  active,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  active?: boolean;
}) {
  return (
    <Pressable
      style={[styles.iconAction, active && styles.sent, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {loading ? (
        <ActivityIndicator color={colors.text} size="small" />
      ) : (
        <>
          <Text style={styles.iconActionEmoji}>{icon}</Text>
          <Text style={styles.iconActionLabel} numberOfLines={1}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  reactionRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  reactionButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xs,
    borderRadius: 12,
    backgroundColor: overlays.glass,
    borderWidth: 1,
    borderColor: overlays.glassBorder,
    gap: 2,
  },
  reactionEmoji: {
    fontSize: 20,
    lineHeight: 22,
  },
  reactionLabel: {
    ...typography.caption,
    fontSize: 9,
    lineHeight: 11,
    color: colors.text,
    fontWeight: "700",
    textAlign: "center",
  },
  challengeRow: {
    gap: spacing.xs,
    paddingRight: spacing.sm,
  },
  challengeChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: overlays.glass,
    borderWidth: 1,
    borderColor: overlays.glassBorder,
  },
  challengeText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: "700",
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  iconAction: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: 4,
    borderRadius: 12,
    backgroundColor: overlays.glass,
    borderWidth: 1,
    borderColor: overlays.glassBorder,
    gap: 2,
  },
  iconActionEmoji: {
    fontSize: 16,
    lineHeight: 18,
  },
  iconActionLabel: {
    ...typography.caption,
    fontSize: 9,
    lineHeight: 11,
    color: colors.text,
    fontWeight: "700",
    textAlign: "center",
  },
  sent: {
    borderColor: colors.accent,
    backgroundColor: overlays.accentTint,
  },
  disabled: {
    opacity: 0.55,
  },
});
