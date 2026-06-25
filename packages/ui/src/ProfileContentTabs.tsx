import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "./theme";

export type ProfileContentTab = "posts" | "photos";

interface ProfileContentTabsProps {
  active: ProfileContentTab;
  onChange: (tab: ProfileContentTab) => void;
  postCount?: number;
  photoCount?: number;
}

export function ProfileContentTabs({
  active,
  onChange,
  postCount,
  photoCount,
}: ProfileContentTabsProps) {
  const tabs: { id: ProfileContentTab; label: string; count?: number }[] = [
    { id: "posts", label: "Posts", count: postCount },
    { id: "photos", label: "Photos", count: photoCount },
  ];

  return (
    <View style={styles.bar}>
      {tabs.map((tab) => {
        const selected = active === tab.id;
        return (
          <Pressable
            key={tab.id}
            style={[styles.tab, selected && styles.tabActive]}
            onPress={() => onChange(tab.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
          >
            <Text style={[styles.label, selected && styles.labelActive]}>
              {tab.label}
              {tab.count != null ? ` (${tab.count})` : ""}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    marginBottom: spacing.sm,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: colors.accent,
  },
  label: {
    ...typography.bodySmall,
    fontWeight: "600",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  labelActive: {
    color: colors.accent,
  },
});
