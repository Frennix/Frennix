import { useQuery } from "@tanstack/react-query";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { getProfileHighlights } from "@frennix/api";
import { colors, spacing, typography } from "@frennix/ui";

type StoryHighlightsRailProps = {
  profileId: string;
  isOwn?: boolean;
  onHighlightPress?: (highlightId: string) => void;
};

export function StoryHighlightsRail({
  profileId,
  isOwn,
  onHighlightPress,
}: StoryHighlightsRailProps) {
  const { data: highlights = [] } = useQuery({
    queryKey: ["profile-highlights", profileId],
    queryFn: () => getProfileHighlights(profileId),
    enabled: Boolean(profileId),
    staleTime: 60_000,
  });

  if (!highlights.length && !isOwn) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Highlights</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {highlights.map((highlight) => (
          <Pressable
            key={highlight.id}
            style={styles.chip}
            onPress={() => onHighlightPress?.(highlight.id)}
          >
            <View style={styles.ring}>
              <Text style={styles.emoji}>⭐</Text>
            </View>
            <Text style={styles.label} numberOfLines={1}>
              {highlight.title}
            </Text>
          </Pressable>
        ))}
        {isOwn && !highlights.length ? (
          <Text style={styles.hint}>Pin favorite stories from your story viewer.</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  title: {
    ...typography.body,
    color: colors.text,
    fontWeight: "800",
  },
  row: {
    gap: spacing.md,
    alignItems: "flex-start",
  },
  chip: {
    width: 72,
    alignItems: "center",
    gap: 4,
  },
  ring: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: {
    fontSize: 28,
    lineHeight: 32,
  },
  label: {
    ...typography.caption,
    color: colors.text,
    fontWeight: "600",
    textAlign: "center",
    maxWidth: 72,
  },
  hint: {
    ...typography.bodySmall,
    color: colors.textMuted,
    flex: 1,
    paddingTop: spacing.md,
  },
});
