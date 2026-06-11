import "@/lib/init-supabase";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider } from "@/providers/AuthProvider";
import { QueryProvider } from "@/providers/QueryProvider";
import { initSentry } from "@/lib/sentry";
import { setupNotificationListeners } from "@/lib/notifications";
import { colors } from "@frennix/ui";

initSentry();

export default function RootLayout() {
  useEffect(() => {
    return setupNotificationListeners();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <QueryProvider>
        <AuthProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.background },
              headerTintColor: colors.text,
              contentStyle: { backgroundColor: colors.background },
              headerShadowVisible: false,
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ title: "Set up profile", headerBackVisible: false }} />
            <Stack.Screen name="create-post" options={{ title: "Share workout", presentation: "modal" }} />
            <Stack.Screen name="post/[id]" options={{ title: "Post" }} />
            <Stack.Screen name="user/[username]" options={{ title: "Profile" }} />
            <Stack.Screen name="group/[id]" options={{ title: "Group" }} />
            <Stack.Screen name="challenge/[id]" options={{ title: "Challenge" }} />
            <Stack.Screen name="chat/[conversationId]" options={{ title: "Chat" }} />
            <Stack.Screen name="followers/[userId]" options={{ title: "Followers" }} />
            <Stack.Screen name="following/[userId]" options={{ title: "Following" }} />
            <Stack.Screen name="notifications" options={{ title: "Notifications" }} />
            <Stack.Screen name="create-group" options={{ title: "Create group", presentation: "modal" }} />
            <Stack.Screen name="create-challenge" options={{ title: "Create challenge", presentation: "modal" }} />
            <Stack.Screen name="edit-profile" options={{ title: "Edit profile", presentation: "modal" }} />
            <Stack.Screen name="settings" options={{ title: "Settings" }} />
            <Stack.Screen name="matching" options={{ title: "Partner matching" }} />
          </Stack>
        </AuthProvider>
      </QueryProvider>
    </GestureHandlerRootView>
  );
}
