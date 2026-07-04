import { StyleSheet, Text, View } from "react-native";
import type { StoryChallengeJoinRecord } from "@frennix/types";
import { Avatar, colors, overlays, spacing, typography } from "@frennix/ui";

type StoryChallengeAcceptsProps = {
  prompt?: string | null;
  joins: StoryChallengeJoinRecord[];
};

export function StoryChallengeAccepts({ prompt, joins }: StoryChallengeAcceptsProps) {
  if (!joins.length && !prompt) return null;

  return (
    <View style={styles.wrap}>
      {prompt ? <Text style={styles.prompt}>{prompt}</Text> : null}
      {joins.length ? (
        <>
          <Text style={styles.title}>I'm In ({joins.length})</Text>
          <View style={styles.row}>
            {joins.slice(0, 8).map((join) => (
              <View key={join.user_id} style={styles.chip}>
                <Avatar uri={join.profile.avatar_url} name={join.profile.display_name} size={28} />
                <Text style={styles.name} numberOfLines={1}>
                  {join.profile.display_name}
                </Text>
              </View>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: 14,
    backgroundColor: overlays.glassMedium,
    borderWidth: 1,
    borderColor: overlays.glassBorderStrong,
  },
  prompt: {
    ...typography.body,
    color: colors.white,
    fontWeight: "800",
  },
  title: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: "800",
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: overlays.glass,
    maxWidth: 140,
  },
  name: {
    ...typography.caption,
    color: colors.white,
    fontWeight: "600",
    flexShrink: 1,
  },
});
