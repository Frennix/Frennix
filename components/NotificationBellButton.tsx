import { AppIcon } from "@/components/AppIcon";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { getNotifications } from "@frennix/api";
import { guardDoublePress, pushScreen } from "@/lib/press-utils";
import { colors, typography } from "@frennix/ui";

interface NotificationBellButtonProps {
  userId: string;
  unreadCount: number;
}

export function NotificationBellButton({ userId, unreadCount }: NotificationBellButtonProps) {
  const queryClient = useQueryClient();

  const handlePress = guardDoublePress(() => {
    if (userId) {
      void queryClient.prefetchQuery({
        queryKey: ["notifications", userId],
        queryFn: () => getNotifications(userId),
        staleTime: 15_000,
      });
    }
    pushScreen("/notifications");
  });

  return (
    <Pressable
      onPress={handlePress}
      style={styles.bellButton}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={
        unreadCount > 0
          ? `Notifications, ${unreadCount} unread`
          : "Notifications"
      }
    >
      <AppIcon name="bell" color={colors.text} size={24} />
      {unreadCount > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unreadCount > 99 ? "99+" : unreadCount}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bellButton: {
    position: "relative",
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.background,
  },
  badgeText: {
    ...typography.caption,
    fontSize: 10,
    lineHeight: 12,
    color: colors.background,
    fontWeight: "700",
  },
});
