import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { memo, useCallback } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useAuth } from "@/providers/AuthProvider";
import { useTabBadges } from "@/providers/TabBadgeProvider";
import { CreateTabBarButton } from "@/components/CreateTabBarButton";
import { NotificationBellButton } from "@/components/NotificationBellButton";
import { openCreatePost, pushScreen } from "@/lib/press-utils";
import { colors } from "@frennix/ui";

const HeaderBell = memo(function HeaderBell() {
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const { unreadNotifications } = useTabBadges();

  return (
    <View style={styles.headerRight}>
      <NotificationBellButton userId={userId} unreadCount={unreadNotifications} />
    </View>
  );
});

const ProfileHeaderActions = memo(function ProfileHeaderActions() {
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const { unreadNotifications } = useTabBadges();

  return (
    <View style={styles.profileHeader}>
      <NotificationBellButton userId={userId} unreadCount={unreadNotifications} />
      <Pressable onPress={() => pushScreen("/settings")} hitSlop={8}>
        <Ionicons name="settings-outline" size={24} color={colors.text} />
      </Pressable>
    </View>
  );
});

const TabsShell = memo(function TabsShell() {
  const { unreadMessages } = useTabBadges();
  const messagesBadge =
    unreadMessages > 0 ? (unreadMessages > 99 ? "99+" : unreadMessages) : undefined;

  const renderHeaderBell = useCallback(() => <HeaderBell />, []);
  const renderProfileHeader = useCallback(
    () => (
      <View style={styles.profileHeaderWrap}>
        <ProfileHeaderActions />
      </View>
    ),
    []
  );

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarItemStyle: { minWidth: 56 },
        lazy: true,
        freezeOnBlur: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Feed",
          headerTitle: "Feed",
          tabBarLabel: "Feed",
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
          headerRight: renderHeaderBell,
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: "Discover",
          tabBarIcon: ({ color, size }) => <Ionicons name="compass" size={size} color={color} />,
          headerRight: renderHeaderBell,
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: "Events",
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar" size={size} color={color} />,
          headerRight: renderHeaderBell,
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: "Post",
          tabBarLabel: "Post",
          tabBarIcon: ({ color, size }) => <Ionicons name="add-circle" size={size} color={color} />,
          tabBarButton: (props) => <CreateTabBarButton {...props} />,
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            openCreatePost();
          },
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Messages",
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles" size={size} color={color} />,
          tabBarBadge: messagesBadge,
          headerRight: renderHeaderBell,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
          headerRight: renderProfileHeader,
        }}
      />
    </Tabs>
  );
});

export default function TabsLayout() {
  return <TabsShell />;
}

const styles = StyleSheet.create({
  headerRight: { marginRight: 16 },
  profileHeaderWrap: { marginRight: 16 },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
});
