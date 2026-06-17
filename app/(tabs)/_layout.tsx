import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { getUnreadMessageCount } from "@frennix/api";
import { useAuth } from "@/providers/AuthProvider";
import { NotificationBellButton } from "@/components/NotificationBellButton";
import { useNotificationSubscription } from "@/lib/useNotificationSubscription";
import { useNotificationBadge } from "@/lib/useNotificationBadge";
import { colors } from "@frennix/ui";

function HeaderBell() {
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const unreadNotifications = useNotificationBadge(userId);
  return (
    <View style={styles.headerRight}>
      <NotificationBellButton unreadCount={unreadNotifications} />
    </View>
  );
}

function ProfileHeaderActions() {
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const unreadNotifications = useNotificationBadge(userId);

  return (
    <View style={styles.profileHeader}>
      <NotificationBellButton unreadCount={unreadNotifications} />
      <Pressable onPress={() => router.push("/settings")} hitSlop={8}>
        <Ionicons name="settings-outline" size={24} color={colors.text} />
      </Pressable>
    </View>
  );
}

export default function TabsLayout() {
  const { session } = useAuth();
  const userId = session?.user.id ?? "";

  useNotificationSubscription(userId);
  useNotificationBadge(userId);

  const { data: unreadMessages = 0 } = useQuery({
    queryKey: ["unread-messages", userId],
    queryFn: () => getUnreadMessageCount(userId),
    enabled: !!userId,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Feed",
          headerTitle: "Feed",
          tabBarLabel: "Feed",
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
          headerRight: () => <HeaderBell />,
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: "Discover",
          tabBarIcon: ({ color, size }) => <Ionicons name="compass" size={size} color={color} />,
          headerRight: () => <HeaderBell />,
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: "Events",
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar" size={size} color={color} />,
          headerRight: () => <HeaderBell />,
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
          headerRight: () => <HeaderBell />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
          headerRight: () => (
            <View style={{ marginRight: 16 }}>
              <ProfileHeaderActions />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  headerRight: { marginRight: 16 },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
});
