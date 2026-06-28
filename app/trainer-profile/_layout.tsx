import { Stack } from "expo-router";
import { nestedBackScreen, nestedStackScreenOptions } from "@/lib/stack-navigation";

export default function TrainerProfileLayout() {
  return (
    <Stack screenOptions={nestedStackScreenOptions()}>
      <Stack.Screen name="setup" options={nestedBackScreen("Become a trainer")} />
      <Stack.Screen name="edit" options={nestedBackScreen("Trainer profile")} />
    </Stack>
  );
}
