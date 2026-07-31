import { Tabs } from "expo-router";
import { memo, useCallback, useEffect } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { useAuth } from "@/providers/AuthProvider";
import { useTabBadges } from "@/providers/TabBadgeProvider";
import { CreateTabBarButton } from "@/components/CreateTabBarButton";
import { FastTabBarButton } from "@/components/FastTabBarButton";
import { TabPrefetchCoordinator } from "@/components/TabPrefetchCoordinator";
import { NotificationBellButton } from "@/components/NotificationBellButton";
import { FeedHeaderTitle } from "@/components/FeedHeaderTitle";
import { FrennixLogo } from "@/components/FrennixLogo";
import { AppIcon } from "@/components/AppIcon";
import { PostLoginShellErrorBoundary } from "@/components/PostLoginShellErrorBoundary";
import { WhatsNewLaunchPrompt } from "@/components/whats-new/WhatsNewLaunchPrompt";
import { NotificationOnboardingPrompt } from "@/components/NotificationOnboardingPrompt";
import { LocationDiscoveryPrompt } from "@/components/LocationDiscoveryPrompt";
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary";
import { StartupMountProbe } from "@/components/StartupMountProbe";
import { openCreatePost, pushScreen } from "@/lib/press-utils";
import { colors } from "@frennix/ui";
import { flexFill, webTabSceneShell } from "@/lib/flex-layout";
import { isFeedIsolateDisabled } from "@/lib/feed-isolate";
import { useTabSceneLayoutGuard } from "@/lib/tab-scene-layout-guard";
import { recordWebStartupCheckpoint } from "@/lib/web-startup-checkpoints";

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
  const { session, profile } = useAuth();
  const { unreadMessages } = useTabBadges();
  const isolateFab = isFeedIsolateDisabled("fab");
  const isolateBottomTabs = isFeedIsolateDisabled("bottom-tabs");
  const isolateNotificationBadge = isFeedIsolateDisabled("notification-badge");
  useTabSceneLayoutGuard();
  const messagesBadge =
    unreadMessages > 0 ? (unreadMessages > 99 ? "99+" : unreadMessages) : undefined;

  const tabBarStyle = {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    ...(isolateBottomTabs ? { display: "none" as const } : null),
  };

  const renderFeedHeaderTitle = useCallback(
    () => <FeedHeaderTitle displayName={profile?.display_name} />,
    [profile?.display_name]
  );
  const renderEventsHeaderTitle = useCallback(() => <FrennixLogo variant="full" height={34} />, []);
  const renderProfileHeaderTitle = useCallback(() => <FrennixLogo variant="icon" height={24} />, []);
  const renderHeaderBell = useCallback(
    () => (isolateNotificationBadge ? null : <HeaderBell />),
    [isolateNotificationBadge]
  );
  const renderProfileHeader = useCallback(
    () => (
      <View style={styles.profileHeaderWrap}>
        {isolateNotificationBadge ? (
          <Pressable onPress={() => pushScreen("/settings")} hitSlop={8}>
            <AppIcon name="settings" color={colors.text} size={24} />
          </Pressable>
        ) : (
          <ProfileHeaderActions />
        )}
      </View>
    ),
    [isolateNotificationBadge]
  );

  return (
    <>
      <PostLoginShellErrorBoundary
        label="prompts"
        userId={session?.user.id}
        email={session?.user.email ?? undefined}
      >
        <WhatsNewLaunchPrompt />
        <NotificationOnboardingPrompt />
        <LocationDiscoveryPrompt />
      </PostLoginShellErrorBoundary>
      <TabPrefetchCoordinator />
      <View
        style={[flexFill, webTabSceneShell]}
        collapsable={false}
        nativeID="feed-tab-scene"
        pointerEvents="box-none"
      >
      <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.backgroundFeed },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        tabBarStyle,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarItemStyle: { minWidth: 56 },
        sceneContainerStyle: {
          ...flexFill,
          ...webTabSceneShell,
          width: "100%",
          maxWidth: "100%",
          minWidth: 0,
          alignSelf: "stretch",
          overflow: "hidden",
          backgroundColor: colors.backgroundFeed,
          ...(Platform.OS === "web"
            ? ({ contain: "layout paint", position: "relative" } as const)
            : null),
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
          title: "Calendar",
          headerTitle: renderEventsHeaderTitle,
          tabBarLabel: "Calendar",
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
          tabBarButton: (props) =>
            isolateFab ? null : <CreateTabBarButton {...props} />,
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
  const { session } = useAuth();

  useEffect(() => {
    if (Platform.OS === "web") {
      recordWebStartupCheckpoint("tabs-layout:mounted");
    }
  }, []);

  return (
    <StartupMountProbe id="tabs-layout">
      <SectionErrorBoundary
        label="tabs-shell"
        screen="/(tabs)"
        userId={session?.user.id}
        email={session?.user.email ?? undefined}
      >
        <TabsShell />
      </SectionErrorBoundary>
    </StartupMountProbe>
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
