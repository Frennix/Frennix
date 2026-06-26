import { StyleSheet, Text, View } from "react-native";
import type { Group } from "@frennix/types";
import { ScalePressable } from "./ScalePressable";
import { colors, radius, spacing, typography } from "./theme";

interface GroupCardProps {
  group: Group;
  onPress?: () => void;
}

export function GroupCard({ group, onPress }: GroupCardProps) {
  return (
    <ScalePressable style={styles.card} onPress={onPress} disabled={!onPress}>
      <Text style={styles.name}>{group.name}</Text>
      {group.description ? (
        <Text style={styles.description} numberOfLines={2}>{group.description}</Text>
      ) : null}
      <View style={styles.footer}>
        <Text style={styles.tags}>{group.sport_tags.slice(0, 3).join(" · ")}</Text>
        <Text style={styles.members}>{group.member_count ?? 0} members</Text>
      </View>
    </ScalePressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  name: { ...typography.heading, fontSize: 18 },
  description: { ...typography.bodySmall, lineHeight: 20 },
  footer: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.xs },
  tags: { ...typography.caption, color: colors.accent, flex: 1 },
  members: { ...typography.caption },
});
