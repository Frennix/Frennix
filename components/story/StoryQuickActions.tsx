import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, overlays, spacing, typography } from "@frennix/ui";

interface StoryQuickActionsProps {
  isFollowing: boolean;
  followLoading?: boolean;
  messageLoading?: boolean;
  disabled?: boolean;
  onFollow: () => void;
  onMessage: () => void;
  onInviteToTrain: () => void;
  onViewProfile: () => void;
}

export function StoryQuickActions({
  isFollowing,
  followLoading,
  messageLoading,
  disabled,
  onFollow,
  onMessage,
  onInviteToTrain,
  onViewProfile,
}: StoryQuickActionsProps) {
  return (
    <View style={styles.wrap}>
      <ActionChip
        label={isFollowing ? "Following" : "Follow"}
        onPress={onFollow}
        disabled={disabled || followLoading || isFollowing}
        loading={followLoading}
        active={isFollowing}
      />
      <ActionChip
        label="Message"
        onPress={onMessage}
        disabled={disabled || messageLoading}
        loading={messageLoading}
      />
      <ActionChip label="Invite to Train" onPress={onInviteToTrain} disabled={disabled} />
      <ActionChip label="Profile" onPress={onViewProfile} disabled={disabled} />
    </View>
  );
}

function ActionChip({
  label,
  onPress,
  disabled,
  loading,
  active,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  active?: boolean;
}) {
  return (
    <Pressable
      style={[styles.chip, active && styles.chipActive, disabled && styles.chipDisabled]}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {loading ? (
        <ActivityIndicator color={colors.text} size="small" />
      ) : (
        <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: overlays.glassMedium,
    borderWidth: 1,
    borderColor: overlays.glassBorderEmphasis,
    minHeight: 32,
    justifyContent: "center",
  },
  chipActive: {
    borderColor: colors.accent,
    backgroundColor: overlays.accentTintSoft,
  },
  chipDisabled: {
    opacity: 0.55,
  },
  chipText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: "700",
  },
  chipTextActive: {
    color: colors.accent,
  },
});
