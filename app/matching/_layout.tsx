import { Stack } from "expo-router";
import { MatchingRouteErrorBoundary } from "@/components/MatchingRouteErrorBoundary";
import { nestedBackScreen, nestedStackScreenOptions } from "@/lib/stack-navigation";

export default function MatchingLayout() {
  return (
    <MatchingRouteErrorBoundary>
    <Stack screenOptions={nestedStackScreenOptions()}>
      <Stack.Screen name="index" options={nestedBackScreen("Training partners")} />
      <Stack.Screen name="matches" options={nestedBackScreen("Training matches")} />
    </Stack>
    </MatchingRouteErrorBoundary>
  );
}
