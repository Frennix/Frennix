import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing, touchTarget, typography } from "@frennix/ui";

type FavoritePartnerQuickActionsProps = {
  hasStory: boolean;
  inviteLoading?: boolean;
  onMessage: () => void;
  onProfile: () => void;
  onStory: () => void;
  onInviteWorkout: () => void;
  onInviteEvent: () => void;
};

type QuickAction = {
  key: string;
  emoji: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

function ActionChip({
  emoji,
  label,
  onPress,
  disabled,
  loading,
}: {
  emoji: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Pressable
      style={[styles.chip, disabled && styles.chipDisabled]}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {loading ? (
        <ActivityIndicator color={colors.accent} size="small" />
      ) : (
        <Text style={styles.emoji}>{emoji}</Text>
      )}
    </Pressable>
  );
}

export function FavoritePartnerQuickActions({
  hasStory,
  inviteLoading = false,
  onMessage,
  onProfile,
  onStory,
  onInviteWorkout,
  onInviteEvent,
}: FavoritePartnerQuickActionsProps) {
  const actions: QuickAction[] = [
    { key: "message", emoji: "💬", label: "Send Message", onPress: onMessage },
    { key: "profile", emoji: "👤", label: "View Profile", onPress: onProfile },
    {
      key: "story",
      emoji: "📖",
      label: "View Story",
      onPress: onStory,
      disabled: !hasStory,
    },
    { key: "workout", emoji: "🤝", label: "Invite to Workout", onPress: onInviteWorkout },
    { key: "event", emoji: "📅", label: "Invite to Event", onPress: onInviteEvent },
  ];

  return (
    <View style={styles.row}>
      {actions.map((action) => (
        <ActionChip
          key={action.key}
          emoji={action.emoji}
          label={action.label}
          onPress={action.onPress}
          disabled={action.disabled}
          loading={
            inviteLoading && (action.key === "workout" || action.key === "event")
          }
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 4,
    marginTop: spacing.xs,
  },
  chip: {
    width: 30,
    height: touchTarget - 12,
    minHeight: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipDisabled: {
    opacity: 0.35,
  },
  emoji: {
    fontSize: 14,
    lineHeight: 16,
  },
});
