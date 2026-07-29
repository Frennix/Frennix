import { Stack } from "expo-router";
import { MatchingRouteErrorBoundary } from "@/components/MatchingRouteErrorBoundary";
import { nestedBackScreen, nestedStackScreenOptions } from "@/lib/stack-navigation";

export default function MatchingLayout() {
  return (
    <MatchingRouteErrorBoundary>
    <Stack screenOptions={nestedStackScreenOptions()}>
      <Stack.Screen name="index" options={nestedBackScreen("Training partners")} />
      <Stack.Screen name="matches" options={nestedBackScreen("Training matches")} />
      <Stack.Screen
        name="journey/[matchId]/intro"
        options={nestedBackScreen("Your Training Partner Journey Begins")}
      />
      <Stack.Screen
        name="journey/[matchId]/index"
        options={nestedBackScreen("Training Partner Journey")}
      />
    </Stack>
    </MatchingRouteErrorBoundary>
  );
}
