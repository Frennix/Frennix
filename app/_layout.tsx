import "@/lib/init-supabase";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect, type ReactNode } from "react";
import { Platform } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { ThemeProvider } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "@/providers/AuthProvider";
import { QueryProvider } from "@/providers/QueryProvider";
import { TabBadgeProvider } from "@/providers/TabBadgeProvider";
import { initSentry } from "@/lib/sentry";
import { setupNotificationListeners, invalidateQueriesForPushNotification } from "@/lib/notifications";
import { useNotificationSubscription } from "@/lib/useNotificationSubscription";
import { PushRegistrationBootstrap } from "@/components/PushRegistrationBootstrap";
import { PwaBootstrap } from "@/components/PwaBootstrap";
import { WebPushListener } from "@/components/WebPushListener";
import { WebPushAutoRegistration } from "@/components/WebPushAutoRegistration";
import { WebPushSuccessToastHost } from "@/components/WebPushSuccessToast";
import { PwaReopenNoticeHost } from "@/components/PwaReopenNotice";
import { PresenceCoordinator } from "@/components/PresenceCoordinator";
import { ProductAnalyticsBootstrap } from "@/components/ProductAnalyticsBootstrap";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { ClientDiagnosticsBootstrap } from "@/components/ClientDiagnosticsBootstrap";
import { AppResumeCoordinator } from "@/components/AppResumeCoordinator";
import { StartupMountMarker, StartupMountProbe } from "@/components/StartupMountProbe";
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary";
import { StartupWatchdog } from "@/components/StartupWatchdog";
import { markStartupMount } from "@/lib/startup-mount-trace";
import { AuthenticatedStartupWatchdog } from "@/components/AuthenticatedStartupWatchdog";
import { StartupSnapshotBootstrap } from "@/components/StartupSnapshotBootstrap";
import { AuthNavigationGuard } from "@/lib/auth-navigation";
import { backScreen, fadeScreen } from "@/lib/stack-navigation";
import { animation, colors } from "@frennix/ui";
import { flexFill, webAppShell } from "@/lib/flex-layout";
import { frennixNavigationTheme } from "@/lib/navigation-theme";

initSentry();

const stackDefaults = {
  headerStyle: { backgroundColor: colors.background },
  headerTintColor: colors.text,
  contentStyle: {
    backgroundColor: colors.background,
    ...flexFill,
    ...(Platform.OS === "web" ? webAppShell : null),
  },
  headerShadowVisible: false,
  animation: "fade" as const,
  animationDuration: animation.stackFadeMs,
} as const;

function AuthAwareErrorBoundary({
  children,
  scope,
}: {
  children: ReactNode;
  scope?: string;
}) {
  const { session } = useAuth();
  return (
    <AppErrorBoundary
      scope={scope}
      userId={session?.user.id}
      email={session?.user.email ?? undefined}
      screen={scope}
    >
      {children}
    </AppErrorBoundary>
  );
}

function TabBadgeRoot({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  return (
    <SectionErrorBoundary label="tab-badges" userId={userId} email={session?.user.email ?? undefined}>
      <TabBadgeProvider userId={userId}>{children}</TabBadgeProvider>
    </SectionErrorBoundary>
  );
}

function NotificationBootstrap() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id ?? "";

  useNotificationSubscription(userId);

  useEffect(() => {
    return setupNotificationListeners(userId, (data) => {
      if (!userId) return;
      invalidateQueriesForPushNotification(queryClient, userId, data);
    });
  }, [queryClient, userId]);

  return (
    <>
      <WebPushAutoRegistration />
      <WebPushListener userId={userId} queryClient={queryClient} />
      <WebPushSuccessToastHost />
      <PwaReopenNoticeHost />
    </>
  );
}

export default function RootLayout() {
  markStartupMount("root-layout:render", "sync");

  useEffect(() => {
    if (Platform.OS === "web") return;
    void SystemUI.setBackgroundColorAsync(colors.background);
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider value={frennixNavigationTheme}>
    <StartupMountProbe id="gesture-handler">
      <GestureHandlerRootView
        pointerEvents="box-none"
        style={{ ...flexFill, ...webAppShell, backgroundColor: colors.background }}
        {...(Platform.OS === "web" ? ({ nativeID: "app-root-shell" } as object) : null)}
      >
        <StartupMountProbe id="app-error-boundary-root">
          <AppErrorBoundary scope="root">
            <StartupMountProbe id="query-provider">
              <QueryProvider>
                <AppResumeCoordinator />
                <StartupWatchdog />
                <StartupMountProbe id="auth-provider">
                  <AuthProvider>
                    <ClientDiagnosticsBootstrap />
                    <StartupSnapshotBootstrap />
                    <AuthenticatedStartupWatchdog />
                    <StartupMountProbe id="tab-badge-root">
                      <TabBadgeRoot>
                        <StartupMountProbe id="navigation-error-boundary">
                          <AuthAwareErrorBoundary scope="navigation">
                            <StartupMountMarker id="notification-bootstrap" />
                            <NotificationBootstrap />
                            <StartupMountMarker id="push-registration-bootstrap" />
                            <PushRegistrationBootstrap />
                            <PwaBootstrap />
                            <StartupMountMarker id="product-analytics-bootstrap" />
                            <ProductAnalyticsBootstrap />
                            <StartupMountMarker id="presence-coordinator" />
                            <PresenceCoordinator />
                            <StartupMountMarker id="auth-navigation-guard" />
                            <AuthNavigationGuard />
                            <StatusBar style="light" />
                            <StartupMountProbe id="stack">
                              <Stack screenOptions={stackDefaults}>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="reset-password" options={backScreen("New password")} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ title: "Set up profile", headerBackVisible: false }} />
            <Stack.Screen
              name="create-post"
              options={backScreen("Share workout", { presentation: "modal" })}
            />
            <Stack.Screen
              name="create-story"
              options={backScreen("Create Story", { presentation: "modal" })}
            />
            <Stack.Screen
              name="adjust-photo"
              options={backScreen("Adjust photo", { presentation: "modal" })}
            />
            <Stack.Screen
              name="edit-post/[id]"
              options={backScreen("Edit post", { presentation: "modal" })}
            />
            <Stack.Screen
              name="create-event"
              options={backScreen("Create event", { presentation: "modal" })}
            />
            <Stack.Screen name="events/browse" options={backScreen("Community Events", fadeScreen)} />
            <Stack.Screen
              name="training-calendar/create"
              options={backScreen("Schedule Training", { presentation: "modal" })}
            />
            <Stack.Screen name="training-calendar/[id]" options={backScreen("Session")} />
            <Stack.Screen
              name="training-calendar/edit/[id]"
              options={backScreen("Edit Session", { presentation: "modal" })}
            />
            <Stack.Screen
              name="edit-event/[id]"
              options={backScreen("Edit event", { presentation: "modal" })}
            />
            <Stack.Screen name="event/[id]" options={backScreen("Event", fadeScreen)} />
            <Stack.Screen name="event/[id]/invite" options={backScreen("Invite athletes", fadeScreen)} />
            <Stack.Screen name="post/[id]" options={backScreen("Post", fadeScreen)} />
            <Stack.Screen name="user/[username]" options={backScreen("Profile", fadeScreen)} />
            <Stack.Screen name="group/[id]" options={backScreen("Group", fadeScreen)} />
            <Stack.Screen name="challenge/[id]" options={backScreen("Challenge", fadeScreen)} />
            <Stack.Screen
              name="challenge/[id]/invite"
              options={backScreen("Invite Friends", fadeScreen)}
            />
            <Stack.Screen name="chat/[conversationId]" options={backScreen("Chat", fadeScreen)} />
            <Stack.Screen name="followers/[userId]" options={backScreen("Followers")} />
            <Stack.Screen name="following/[userId]" options={backScreen("Following")} />
            <Stack.Screen name="notifications" options={{
              ...backScreen("Notifications Center", fadeScreen),
            }} />
            <Stack.Screen
              name="create-group"
              options={backScreen("Create group", { presentation: "modal" })}
            />
            <Stack.Screen
              name="create-challenge"
              options={backScreen("Create challenge", { presentation: "modal" })}
            />
            <Stack.Screen
              name="edit-challenge/[id]"
              options={backScreen("Edit challenge", { presentation: "modal" })}
            />
            <Stack.Screen
              name="edit-profile"
              options={backScreen("Edit profile", { presentation: "modal" })}
            />
            <Stack.Screen name="settings" options={backScreen("Settings")} />
            <Stack.Screen name="whats-new" options={backScreen("What's New")} />
            <Stack.Screen
              name="matching-settings"
              options={{
                ...backScreen("Training partner preferences", fadeScreen),
              }}
            />
            <Stack.Screen name="notification-settings" options={backScreen("Notifications")} />
            <Stack.Screen name="privacy-settings" options={backScreen("Privacy")} />
            <Stack.Screen name="stories/discover" options={backScreen("Discover Stories", fadeScreen)} />
            <Stack.Screen name="stories/explore" options={backScreen("Explore Stories", fadeScreen)} />
            <Stack.Screen name="invite-friends" options={backScreen("Invite Friends")} />
            <Stack.Screen name="join/[code]" options={{ headerShown: false }} />
            <Stack.Screen name="blocked-users" options={backScreen("Blocked users")} />
            <Stack.Screen name="admin-moderation" options={backScreen("Moderation")} />
            <Stack.Screen name="beta-feedback" options={backScreen("Beta Feedback")} />
            <Stack.Screen name="beta-diagnostics" options={backScreen("Beta Diagnostics")} />
            <Stack.Screen name="admin-feedback" options={backScreen("Feedback Dashboard")} />
            <Stack.Screen name="matching" options={{ headerShown: false }} />
            <Stack.Screen name="trainers" options={{ headerShown: false }} />
            <Stack.Screen name="trainer/[username]" options={backScreen("Trainer")} />
            <Stack.Screen name="trainer-profile" options={{ headerShown: false }} />
            <Stack.Screen name="admin-trainer-review" options={backScreen("Trainer review")} />
            <Stack.Screen name="admin-analytics" options={backScreen("Analytics")} />
            <Stack.Screen name="founder" options={{ headerShown: false }} />
            <Stack.Screen name="staff/join" options={{ headerShown: false, title: "Staff invite" }} />
                              </Stack>
                            </StartupMountProbe>
                          </AuthAwareErrorBoundary>
                        </StartupMountProbe>
                      </TabBadgeRoot>
                    </StartupMountProbe>
                  </AuthProvider>
                </StartupMountProbe>
              </QueryProvider>
            </StartupMountProbe>
          </AppErrorBoundary>
        </StartupMountProbe>
      </GestureHandlerRootView>
    </StartupMountProbe>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
