import { Stack } from "expo-router";
import { nestedBackScreen, nestedStackScreenOptions } from "@/lib/stack-navigation";

export default function TrainersLayout() {
  return (
    <Stack screenOptions={nestedStackScreenOptions()}>
      <Stack.Screen name="index" options={nestedBackScreen("Find a trainer")} />
      <Stack.Screen name="connections" options={nestedBackScreen("Trainer connections")} />
    </Stack>
  );
}
