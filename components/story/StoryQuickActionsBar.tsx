import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, overlays, radius, spacing, touchTarget, typography } from "@frennix/ui";

type QuickAction = {
  key: string;
  emoji: string;
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
};

type StoryQuickActionsBarProps = {
  disabled?: boolean;
  hasChallenge?: boolean;
  followLoading?: boolean;
  inviteLoading?: boolean;
  isFollowing?: boolean;
  onMessage: () => void;
  onInviteWorkout: () => void;
  onInviteEvent: () => void;
  onJoinChallenge?: () => void;
  onViewProfile: () => void;
  showMessage?: boolean;
};

function ActionTile({
  emoji,
  label,
  onPress,
  loading,
  disabled,
}: {
  emoji: string;
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={[styles.tile, disabled && styles.tileDisabled]}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {loading ? (
        <ActivityIndicator color={colors.text} size="small" />
      ) : (
        <Text style={styles.emoji}>{emoji}</Text>
      )}
      <Text style={styles.label} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Frennix-specific story quick actions — message, invites, challenge, profile. */
export function StoryQuickActionsBar({
  disabled,
  hasChallenge,
  inviteLoading,
  onMessage,
  onInviteWorkout,
  onInviteEvent,
  onJoinChallenge,
  onViewProfile,
  showMessage = true,
}: StoryQuickActionsBarProps) {
  const actions: QuickAction[] = [
    ...(showMessage ? [{ key: "message", emoji: "💬", label: "Message", onPress: onMessage }] : []),
    { key: "workout", emoji: "🤝", label: "Invite to Workout", onPress: onInviteWorkout },
    { key: "event", emoji: "📅", label: "Invite to Event", onPress: onInviteEvent, loading: inviteLoading },
    ...(hasChallenge && onJoinChallenge
      ? [{ key: "challenge", emoji: "🎯", label: "I'm In", onPress: onJoinChallenge }]
      : []),
    { key: "profile", emoji: "👤", label: "View Profile", onPress: onViewProfile },
  ];

  return (
    <View style={styles.row}>
      {actions.map((action) => (
        <ActionTile
          key={action.key}
          emoji={action.emoji}
          label={action.label}
          onPress={action.onPress}
          loading={action.loading}
          disabled={disabled}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    gap: spacing.xs,
  },
  tile: {
    flexGrow: 1,
    flexBasis: "31%",
    maxWidth: "32%",
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    minHeight: touchTarget,
    paddingHorizontal: 4,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: overlays.glass,
    borderWidth: 1,
    borderColor: overlays.glassBorder,
    gap: 2,
  },
  tileDisabled: {
    opacity: 0.55,
  },
  emoji: {
    fontSize: 18,
    lineHeight: 20,
  },
  label: {
    ...typography.caption,
    fontSize: 9,
    lineHeight: 12,
    color: colors.text,
    fontWeight: "700",
    textAlign: "center",
  },
});
