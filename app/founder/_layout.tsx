import { Stack } from "expo-router";

export default function FounderLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="community" />
      <Stack.Screen name="platform" />
      <Stack.Screen name="activity" />
      <Stack.Screen name="moderation" />
      <Stack.Screen name="ambassadors" />
      <Stack.Screen name="flags" />
      <Stack.Screen name="releases" />
      <Stack.Screen name="roadmap" />
      <Stack.Screen name="support" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="inbox" />
      <Stack.Screen name="bootstrap" />
      <Stack.Screen name="admin/index" />
      <Stack.Screen name="analytics/[domain]" />
    </Stack>
  );
}
