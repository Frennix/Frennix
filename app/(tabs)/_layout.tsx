import { Tabs } from "expo-router";
import { memo, useCallback, useEffect } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@/providers/AuthProvider";
import { useTabBadges } from "@/providers/TabBadgeProvider";
import { CreateTabBarButton } from "@/components/CreateTabBarButton";
import { FastTabBarButton } from "@/components/FastTabBarButton";
import { TabPrefetchCoordinator } from "@/components/TabPrefetchCoordinator";
import { NotificationBellButton } from "@/components/NotificationBellButton";
import { FeedHeaderTitle } from "@/components/FeedHeaderTitle";
import { FrennixTabHeaderLogo } from "@/components/FrennixLogo";
import { AppIcon } from "@/components/AppIcon";
import { PostLoginShellErrorBoundary } from "@/components/PostLoginShellErrorBoundary";
import { WhatsNewLaunchPrompt } from "@/components/whats-new/WhatsNewLaunchPrompt";
import { BetaMotivationSurveyPrompt } from "@/components/BetaMotivationSurveyPrompt";
import { NotificationOnboardingPrompt } from "@/components/NotificationOnboardingPrompt";
import { LocationDiscoveryPrompt } from "@/components/LocationDiscoveryPrompt";
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary";
import { StartupMountProbe } from "@/components/StartupMountProbe";
import { openCreatePost, pushScreen } from "@/lib/press-utils";
import { colors, typography } from "@frennix/ui";
import { flexFill, webTabSceneShell } from "@/lib/flex-layout";
import { isFeedIsolateDisabled } from "@/lib/feed-isolate";
import { useLightboxOverlayOpen } from "@/lib/lightbox-overlay-state";
import { useCommentsOverlayOpen } from "@/lib/comments-overlay-state";
import { useTabSceneLayoutGuard } from "@/lib/tab-scene-layout-guard";
import { restoreWebDocumentScrollLock } from "@/lib/web-modal-scroll-lock";
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
  const lightboxOpen = useLightboxOverlayOpen();
  const commentsOpen = useCommentsOverlayOpen();
  useTabSceneLayoutGuard();
  const messagesBadge =
    unreadMessages > 0 ? (unreadMessages > 99 ? "99+" : unreadMessages) : undefined;

  const tabBarStyle = {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    ...(isolateBottomTabs || lightboxOpen || commentsOpen ? { display: "none" as const } : null),
  };

  const renderFeedHeaderTitle = useCallback(
    () => <FeedHeaderTitle displayName={profile?.display_name} />,
    [profile?.display_name]
  );
  const renderTabHeaderLogo = useCallback(() => <FrennixTabHeaderLogo />, []);
  const renderHeaderBell = useCallback(
    () => (isolateNotificationBadge ? null : <HeaderBell />),
    [isolateNotificationBadge]
  );
  const renderShareJourney = useCallback(
    () => (
      <Pressable
        onPress={() => openCreatePost({ intent: "reel" })}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Share Your Journey"
        style={styles.shareJourneyButton}
      >
        <Text style={styles.shareJourneyLabel} numberOfLines={1}>
          Share Your Journey
        </Text>
      </Pressable>
    ),
    []
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
        <BetaMotivationSurveyPrompt />
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
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarItemStyle: { minWidth: 48, minHeight: 44 },
        sceneContainerStyle: {
          ...flexFill,
          ...webTabSceneShell,
          backgroundColor: colors.backgroundFeed,
        },
        lazy: false,
        freezeOnBlur: Platform.OS !== "web",
        headerTitleContainerStyle: { overflow: "hidden", flex: 1, maxWidth: "100%" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Feed",
          headerTitle: renderFeedHeaderTitle,
          headerStyle: {
            backgroundColor: colors.backgroundFeed,
            ...(Platform.OS === "web" ? { minHeight: 92 } : null),
          },
          tabBarLabel: "Feed",
          tabBarAccessibilityLabel: "Feed",
          tabBarIcon: ({ color, size }) => <AppIcon name="feed" color={color} size={size} />,
          headerRight: renderHeaderBell,
          tabBarButton: (props) => <FastTabBarButton {...props} href="/(tabs)" tabKey="feed" />,
        }}
      />
      <Tabs.Screen
        name="reels"
        options={{
          title: "Reels",
          tabBarLabel: "Reels",
          tabBarAccessibilityLabel: "Reels",
          tabBarIcon: ({ color, size }) => <AppIcon name="reels" color={color} size={size} />,
          headerRight: renderShareJourney,
          tabBarButton: (props) => (
            <FastTabBarButton {...props} href="/(tabs)/reels" tabKey="reels" />
          ),
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: "Discover",
          tabBarAccessibilityLabel: "Discover",
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
          headerTitle: renderTabHeaderLogo,
          tabBarLabel: "Calendar",
          tabBarAccessibilityLabel: "Calendar",
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
          tabBarAccessibilityLabel: "Post",
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
          tabBarAccessibilityLabel: "Messages",
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
          headerTitle: renderTabHeaderLogo,
          tabBarAccessibilityLabel: "Profile",
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
      restoreWebDocumentScrollLock();
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
  shareJourneyButton: {
    marginRight: 12,
    maxWidth: 168,
    minHeight: 44,
    justifyContent: "center",
  },
  shareJourneyLabel: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: "700",
    fontSize: 13,
  },
  profileHeaderWrap: { marginRight: 16 },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
});
