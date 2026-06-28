import "@/lib/init-supabase";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider, useAuth } from "@/providers/AuthProvider";
import { QueryProvider } from "@/providers/QueryProvider";
import { TabBadgeProvider } from "@/providers/TabBadgeProvider";
import { initSentry } from "@/lib/sentry";
import { setupNotificationListeners, invalidateQueriesForPushNotification } from "@/lib/notifications";
import { useNotificationSubscription } from "@/lib/useNotificationSubscription";
import { PushRegistrationBootstrap } from "@/components/PushRegistrationBootstrap";
import { PresenceCoordinator } from "@/components/PresenceCoordinator";
import { ProductAnalyticsBootstrap } from "@/components/ProductAnalyticsBootstrap";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { AppResumeCoordinator } from "@/components/AppResumeCoordinator";
import { EmergencyDebugBanner } from "@/components/EmergencyDebugBanner";
import { StartupMountMarker, StartupMountProbe } from "@/components/StartupMountProbe";
import { markStartupMount } from "@/lib/startup-mount-trace";
import { AuthNavigationGuard } from "@/lib/auth-navigation";
import { backScreen, fadeScreen } from "@/lib/stack-navigation";
import { animation, colors } from "@frennix/ui";
import { flexFill } from "@/lib/flex-layout";

initSentry();

const stackDefaults = {
  headerStyle: { backgroundColor: colors.background },
  headerTintColor: colors.text,
  contentStyle: { backgroundColor: colors.background },
  headerShadowVisible: false,
  animation: "fade" as const,
  animationDuration: animation.stackFadeMs,
} as const;

function TabBadgeRoot({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  return <TabBadgeProvider userId={userId}>{children}</TabBadgeProvider>;
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

  return null;
}

export default function RootLayout() {
  markStartupMount("root-layout:render", "sync");

  return (
    <StartupMountProbe id="gesture-handler">
      <GestureHandlerRootView style={{ ...flexFill, backgroundColor: colors.background }}>
        <StartupMountProbe id="app-error-boundary-root">
          <AppErrorBoundary scope="root">
            <StartupMountProbe id="query-provider">
              <QueryProvider>
                <AppResumeCoordinator />
                <StartupMountProbe id="auth-provider">
                  <AuthProvider>
                    <StartupMountProbe id="emergency-banner">
                      <EmergencyDebugBanner />
                    </StartupMountProbe>
                    <StartupMountProbe id="tab-badge-root">
                      <TabBadgeRoot>
                        <StartupMountProbe id="navigation-error-boundary">
                          <AppErrorBoundary scope="navigation">
                            <StartupMountMarker id="notification-bootstrap" />
                            <NotificationBootstrap />
                            <StartupMountMarker id="push-registration-bootstrap" />
                            <PushRegistrationBootstrap />
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
            <Stack.Screen
              name="matching-settings"
              options={{
                ...backScreen("Training partner preferences", fadeScreen),
              }}
            />
            <Stack.Screen name="notification-settings" options={backScreen("Notifications")} />
            <Stack.Screen name="privacy-settings" options={backScreen("Privacy")} />
            <Stack.Screen name="saved-posts" options={backScreen("Saved Posts")} />
            <Stack.Screen name="invite-friends" options={backScreen("Invite Friends")} />
            <Stack.Screen name="join/[code]" options={{ headerShown: false }} />
            <Stack.Screen name="blocked-users" options={backScreen("Blocked users")} />
            <Stack.Screen name="admin-moderation" options={backScreen("Moderation")} />
            <Stack.Screen name="beta-feedback" options={backScreen("Beta Feedback")} />
            <Stack.Screen name="admin-feedback" options={backScreen("Feedback Dashboard")} />
            <Stack.Screen name="matching" options={{ headerShown: false }} />
            <Stack.Screen name="trainers" options={{ headerShown: false }} />
            <Stack.Screen name="trainer/[username]" options={backScreen("Trainer")} />
            <Stack.Screen name="trainer-profile" options={{ headerShown: false }} />
            <Stack.Screen name="admin-trainer-review" options={backScreen("Trainer review")} />
            <Stack.Screen name="admin-analytics" options={backScreen("Analytics")} />
                              </Stack>
                            </StartupMountProbe>
                          </AppErrorBoundary>
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
  );
}
