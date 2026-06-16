import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { getUnreadMessageCount } from "@frennix/api";
import { useAuth } from "@/providers/AuthProvider";
import { useNotificationSubscription } from "@/lib/useNotificationSubscription";
import { useNotificationBadge } from "@/lib/useNotificationBadge";
import { colors, typography } from "@frennix/ui";

function NotificationBell({ unreadCount }: { unreadCount: number }) {
  return (
    <Pressable onPress={() => router.push("/notifications")} style={styles.bellButton} hitSlop={8}>
      <Ionicons name="notifications-outline" size={24} color={colors.text} />
      {unreadCount > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unreadCount > 99 ? "99+" : unreadCount}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export default function TabsLayout() {
  const { session } = useAuth();
  const userId = session?.user.id ?? "";

  useNotificationSubscription(userId);
  const unreadNotifications = useNotificationBadge(userId);

  const { data: unreadMessages = 0 } = useQuery({
    queryKey: ["unread-messages", userId],
    queryFn: () => getUnreadMessageCount(userId),
    enabled: !!userId,
    refetchInterval: 15_000,
  });

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
          headerRight: () => (
            <View style={{ marginRight: 16 }}>
              <NotificationBell unreadCount={unreadNotifications} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: "Discover",
          tabBarIcon: ({ color, size }) => <Ionicons name="compass" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: "Events",
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: "Post",
          tabBarIcon: ({ color, size }) => <Ionicons name="add-circle" size={size} color={color} />,
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            router.push("/create-post");
          },
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Messages",
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles" size={size} color={color} />,
          tabBarBadge: unreadMessages > 0 ? (unreadMessages > 99 ? "99+" : unreadMessages) : undefined,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
          headerRight: () => (
            <Pressable onPress={() => router.push("/settings")} style={{ marginRight: 16 }}>
              <Ionicons name="settings-outline" size={24} color={colors.text} />
            </Pressable>
          ),
        }}
      />
    </Tabs>
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
