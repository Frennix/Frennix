import { StyleSheet, Text, View } from "react-native";
import type { Profile } from "@frennix/types";
import { Avatar } from "./Avatar";
import { Button } from "./Button";
import { ScalePressable } from "./ScalePressable";
import { formatPresenceStatus, isProfileOnline } from "./presence";
import { colors, spacing, typography } from "./theme";

interface UserRowProps {
  profile: Profile;
  subtitle?: string;
  showPresence?: boolean;
  actionLabel?: string;
  onPress?: () => void;
  onAction?: () => void;
  actionLoading?: boolean;
}

export function UserRow({
  profile,
  subtitle,
  showPresence = false,
  actionLabel,
  onPress,
  onAction,
  actionLoading,
}: UserRowProps) {
  const online = isProfileOnline(profile);
  const presenceLabel = showPresence ? formatPresenceStatus(profile) : null;
  const line3 = presenceLabel ?? subtitle;

  return (
    <ScalePressable style={styles.row} onPress={onPress} disabled={!onPress}>
      <Avatar
        uri={profile.avatar_url}
        name={profile.display_name}
        size={48}
        showOnline={showPresence}
        isOnline={online}
      />
      <View style={styles.info}>
        <Text style={styles.name}>{profile.display_name}</Text>
        <Text style={styles.username}>@{profile.username}</Text>
        {line3 ? (
          <Text
            style={[styles.subtitle, online && showPresence && styles.subtitleOnline]}
            numberOfLines={1}
          >
            {line3}
          </Text>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <Button
          title={actionLabel}
          variant="secondary"
          onPress={onAction}
          loading={actionLoading}
          style={styles.action}
        />
      ) : null}
    </ScalePressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  info: { flex: 1 },
  name: { ...typography.body, fontWeight: "600" },
  username: { ...typography.caption },
  subtitle: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  subtitleOnline: { color: colors.accent, fontWeight: "600" },
  action: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, minHeight: 36 },
});
