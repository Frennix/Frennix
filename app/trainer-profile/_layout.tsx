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

export default function TrainerProfileLayout() {
  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: colors.background },
        animation: "fade",
        animationDuration: 200,
      }}
    >
      <Stack.Screen name="setup" options={backScreen("Become a trainer")} />
      <Stack.Screen name="edit" options={backScreen("Trainer profile")} />
    </Stack>
  );
}
