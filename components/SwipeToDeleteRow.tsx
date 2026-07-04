import { ReactNode, useCallback, useRef } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { colors, spacing, typography } from "@frennix/ui";

type SwipeToDeleteRowProps = {
  children: ReactNode;
  onDelete: () => void;
  enabled?: boolean;
  actionLabel?: string;
};

export function SwipeToDeleteRow({
  children,
  onDelete,
  enabled = true,
  actionLabel = "Delete",
}: SwipeToDeleteRowProps) {
  const swipeableRef = useRef<Swipeable>(null);

  const handleDeletePress = useCallback(() => {
    swipeableRef.current?.close();
    onDelete();
  }, [onDelete]);

  const renderRightActions = useCallback(() => {
    return (
      <Pressable
        style={styles.deleteAction}
        onPress={handleDeletePress}
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
      >
        <Text style={styles.deleteLabel}>{actionLabel}</Text>
      </Pressable>
    );
  }, [actionLabel, handleDeletePress]);

  if (!enabled || Platform.OS === "web") {
    return <View style={styles.container}>{children}</View>;
  }

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      overshootRight={false}
      friction={2}
      rightThreshold={48}
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
  deleteAction: {
    width: 88,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: spacing.xs,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  deleteLabel: {
    ...typography.caption,
    color: colors.white,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
});
