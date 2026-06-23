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

export default function TrainersLayout() {
  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: colors.background },
        animation: "fade",
        animationDuration: 150,
      }}
    >
      <Stack.Screen name="index" options={backScreen("Find a trainer")} />
      <Stack.Screen name="connections" options={backScreen("Trainer connections")} />
    </Stack>
  );
}
