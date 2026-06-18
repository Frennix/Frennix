import "@/lib/init-supabase";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider, useAuth } from "@/providers/AuthProvider";
import { QueryProvider } from "@/providers/QueryProvider";
import { initSentry } from "@/lib/sentry";
import { setupNotificationListeners } from "@/lib/notifications";
import { useNotificationSubscription } from "@/lib/useNotificationSubscription";
import { PushRegistrationBootstrap } from "@/components/PushRegistrationBootstrap";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { AppResumeCoordinator } from "@/components/AppResumeCoordinator";
import { StackBackButton } from "@/components/StackBackButton";
import { AuthNavigationGuard } from "@/lib/auth-navigation";
import { colors } from "@frennix/ui";

initSentry();

const stackDefaults = {
  headerStyle: { backgroundColor: colors.background },
  headerTintColor: colors.text,
  contentStyle: { backgroundColor: colors.background },
  headerShadowVisible: false,
} as const;

function backScreen(title: string, extra?: object) {
  return {
    title,
    headerBackVisible: false,
    headerLeft: () => <StackBackButton />,
    ...extra,
  };
}

function NotificationBootstrap() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id ?? "";

  useNotificationSubscription(userId);

  useEffect(() => {
    return setupNotificationListeners(() => {
      if (!userId) return;
      queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
      queryClient.invalidateQueries({ queryKey: ["unread-notifications", userId] });
    });
  }, [queryClient, userId]);

  return null;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <AppErrorBoundary scope="root">
        <QueryProvider>
          <AppResumeCoordinator />
          <AuthProvider>
            <AppErrorBoundary scope="navigation">
              <NotificationBootstrap />
              <PushRegistrationBootstrap />
              <AuthNavigationGuard />
              <StatusBar style="light" />
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
            <Stack.Screen name="event/[id]" options={backScreen("Event")} />
            <Stack.Screen name="event/[id]/invite" options={backScreen("Invite athletes")} />
            <Stack.Screen name="post/[id]" options={backScreen("Post")} />
            <Stack.Screen name="user/[username]" options={backScreen("Profile")} />
            <Stack.Screen name="group/[id]" options={backScreen("Group")} />
            <Stack.Screen name="challenge/[id]" options={backScreen("Challenge")} />
            <Stack.Screen name="chat/[conversationId]" options={backScreen("Chat")} />
            <Stack.Screen name="followers/[userId]" options={backScreen("Followers")} />
            <Stack.Screen name="following/[userId]" options={backScreen("Following")} />
            <Stack.Screen name="notifications" options={{
              ...backScreen("Notifications Center"),
              animation: "fade",
              animationDuration: 150,
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
              name="edit-profile"
              options={backScreen("Edit profile", { presentation: "modal" })}
            />
            <Stack.Screen name="settings" options={backScreen("Settings")} />
            <Stack.Screen name="notification-settings" options={backScreen("Notifications")} />
            <Stack.Screen name="saved-posts" options={backScreen("Saved Posts")} />
            <Stack.Screen name="invite-friends" options={backScreen("Invite Friends")} />
            <Stack.Screen name="join/[code]" options={{ headerShown: false }} />
            <Stack.Screen name="blocked-users" options={backScreen("Blocked users")} />
            <Stack.Screen name="admin-moderation" options={backScreen("Moderation")} />
            <Stack.Screen name="beta-feedback" options={backScreen("Beta Feedback")} />
            <Stack.Screen name="admin-feedback" options={backScreen("Feedback Dashboard")} />
            <Stack.Screen
              name="matching"
              options={{
                ...backScreen("Partner matching"),
                animation: "fade",
                animationDuration: 150,
              }}
            />
              </Stack>
            </AppErrorBoundary>
          </AuthProvider>
        </QueryProvider>
      </AppErrorBoundary>
    </GestureHandlerRootView>
  );
}
