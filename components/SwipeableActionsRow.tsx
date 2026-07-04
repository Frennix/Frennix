import { ReactNode, useCallback, useRef } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { colors, spacing, typography } from "@frennix/ui";

export type SwipeRowAction = {
  label: string;
  onPress: () => void;
  backgroundColor?: string;
  accessibilityLabel?: string;
};

type SwipeableActionsRowProps = {
  children: ReactNode;
  rightActions: SwipeRowAction[];
  enabled?: boolean;
};

export function SwipeableActionsRow({
  children,
  rightActions,
  enabled = true,
}: SwipeableActionsRowProps) {
  const swipeableRef = useRef<Swipeable>(null);

  const handleActionPress = useCallback(
    (action: SwipeRowAction) => {
      swipeableRef.current?.close();
      action.onPress();
    },
    []
  );

  const renderRightActions = useCallback(() => {
    return (
      <View style={styles.actionsRow}>
        {rightActions.map((action) => (
          <Pressable
            key={action.label}
            style={[
              styles.action,
              { backgroundColor: action.backgroundColor ?? colors.danger },
            ]}
            onPress={() => handleActionPress(action)}
            accessibilityRole="button"
            accessibilityLabel={action.accessibilityLabel ?? action.label}
          >
            <Text style={styles.actionLabel}>{action.label}</Text>
          </Pressable>
        ))}
      </View>
    );
  }, [handleActionPress, rightActions]);

  if (!enabled || Platform.OS === "web" || rightActions.length === 0) {
    return <View style={styles.container}>{children}</View>;
  }

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      overshootRight={false}
      friction={2}
      rightThreshold={40}
      containerStyle={styles.container}
    >
      {children}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "stretch",
    marginVertical: spacing.xs,
  },
  action: {
    width: 88,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  actionLabel: {
    ...typography.caption,
    color: colors.white,
    fontWeight: "800",
    letterSpacing: 0.3,
    textAlign: "center",
  },
});
