import { Tabs } from "expo-router";
import { memo, useCallback } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { useAuth } from "@/providers/AuthProvider";
import { useTabBadges } from "@/providers/TabBadgeProvider";
import { CreateTabBarButton } from "@/components/CreateTabBarButton";
import { FastTabBarButton } from "@/components/FastTabBarButton";
import { TabPrefetchCoordinator } from "@/components/TabPrefetchCoordinator";
import { NotificationBellButton } from "@/components/NotificationBellButton";
import { FrennixLogo } from "@/components/FrennixLogo";
import { AppIcon } from "@/components/AppIcon";
import { PostLoginShellErrorBoundary } from "@/components/PostLoginShellErrorBoundary";
import { openCreatePost, pushScreen } from "@/lib/press-utils";
import { colors } from "@frennix/ui";
import { flexFill, webTabSceneShell } from "@/lib/flex-layout";

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
        <AppIcon name="settings" color={colors.text} size={24} />
      </Pressable>
    </View>
  );
});

const TabsShell = memo(function TabsShell() {
  const { unreadMessages } = useTabBadges();
  const messagesBadge =
    unreadMessages > 0 ? (unreadMessages > 99 ? "99+" : unreadMessages) : undefined;

  const renderFeedHeaderTitle = useCallback(() => <FrennixLogo variant="full" height={34} />, []);
  const renderEventsHeaderTitle = useCallback(() => <FrennixLogo variant="full" height={34} />, []);
  const renderProfileHeaderTitle = useCallback(() => <FrennixLogo variant="icon" height={24} />, []);
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
    <>
      <TabPrefetchCoordinator />
      <View
        style={[flexFill, webTabSceneShell]}
        collapsable={false}
        nativeID="feed-tab-scene"
        pointerEvents="box-none"
      >
      <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarItemStyle: { minWidth: 56 },
        sceneContainerStyle: {
          ...flexFill,
          ...webTabSceneShell,
          backgroundColor: colors.background,
        },
        lazy: false,
        freezeOnBlur: true,
        headerTitleContainerStyle: { overflow: "visible" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Feed",
          headerTitle: renderFeedHeaderTitle,
          tabBarLabel: "Feed",
          tabBarIcon: ({ color, size }) => <AppIcon name="feed" color={color} size={size} />,
          headerRight: renderHeaderBell,
          tabBarButton: (props) => <FastTabBarButton {...props} href="/(tabs)" tabKey="feed" />,
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: "Discover",
          tabBarIcon: ({ color, size }) => <AppIcon name="discover" color={color} size={size} />,
          headerRight: renderHeaderBell,
          tabBarButton: (props) => (
            <FastTabBarButton {...props} href="/(tabs)/discover" tabKey="discover" />
          ),
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: "Events",
          headerTitle: renderEventsHeaderTitle,
          tabBarIcon: ({ color, size }) => <AppIcon name="events" color={color} size={size} />,
          headerRight: renderHeaderBell,
          tabBarButton: (props) => (
            <FastTabBarButton {...props} href="/(tabs)/events" tabKey="events" />
          ),
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: "Post",
          tabBarLabel: "Post",
          tabBarIcon: ({ color, size }) => <AppIcon name="post" color={color} size={size} />,
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
          tabBarIcon: ({ color, size }) => <AppIcon name="messages" color={color} size={size} />,
          tabBarBadge: messagesBadge,
          headerRight: renderHeaderBell,
          tabBarButton: (props) => (
            <FastTabBarButton {...props} href="/(tabs)/messages" tabKey="messages" />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          headerTitle: renderProfileHeaderTitle,
          tabBarIcon: ({ color, size }) => <AppIcon name="profile" color={color} size={size} />,
          headerRight: renderProfileHeader,
          tabBarButton: (props) => (
            <FastTabBarButton {...props} href="/(tabs)/profile" tabKey="profile" />
          ),
        }}
      />
    </Tabs>
      </View>
    </>
  );
});

export default function TabsLayout() {
  return (
    <PostLoginShellErrorBoundary label="tabs layout">
      <TabsShell />
    </PostLoginShellErrorBoundary>
  );
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
