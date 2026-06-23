import { Stack } from "expo-router";
import { StackBackButton } from "@/components/StackBackButton";
import { colors } from "@frennix/ui";

function backScreen(title: string) {
  return {
    title,
    headerBackVisible: false,
    headerLeft: () => <StackBackButton />,
    headerStyle: { backgroundColor: colors.background },
    headerTintColor: colors.text,
    headerShadowVisible: false,
  };
}

export default function MatchingLayout() {
  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: colors.background },
        animation: "fade",
        animationDuration: 150,
      }}
    >
      <Stack.Screen name="index" options={backScreen("Training partners")} />
      <Stack.Screen name="matches" options={backScreen("Training matches")} />
    </Stack>
  );
}
