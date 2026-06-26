import { Stack } from "expo-router";
import { colors } from "@frennix/ui";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: "fade",
        animationDuration: 200,
      }}
    />
  );
}
