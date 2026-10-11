import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "./theme";

export type FeedCategoryTabItem<T extends string> = {
  id: T;
  label: string;
};

interface FeedCategoryTabsProps<T extends string> {
  tabs: ReadonlyArray<FeedCategoryTabItem<T>>;
  active: T;
  onChange: (id: T) => void;
  accessibilityLabel?: string;
}

export function FeedCategoryTabs<T extends string>({
  tabs,
  active,
  onChange,
  accessibilityLabel = "Categories",
}: FeedCategoryTabsProps<T>) {
  return (
    <View style={styles.bar} accessibilityRole="tablist" accessibilityLabel={accessibilityLabel}>
      {tabs.map((tab) => {
        const selected = active === tab.id;
        return (
          <Pressable
            key={tab.id}
            style={styles.tab}
            onPress={() => onChange(tab.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={tab.label}
          >
            <Text style={[styles.label, selected && styles.labelActive]} numberOfLines={1}>
              {tab.label}
            </Text>
            <View style={[styles.underline, selected && styles.underlineActive]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: "transparent",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    minHeight: 44,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  label: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: "600",
  },
  labelActive: {
    color: colors.accent,
    fontWeight: "700",
  },
  underline: {
    marginTop: spacing.xs,
    height: 2,
    alignSelf: "stretch",
    borderRadius: 1,
    backgroundColor: "transparent",
  },
  underlineActive: {
    backgroundColor: colors.accent,
  },
});
