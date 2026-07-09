import { Stack } from "expo-router";
import { colors } from "@frennix/ui";
import { StartupMountProbe } from "@/components/StartupMountProbe";

export default function AuthLayout() {
  return (
    <StartupMountProbe id="auth-layout">
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: "fade",
          animationDuration: 200,
        }}
      />
    </StartupMountProbe>
  );
}
