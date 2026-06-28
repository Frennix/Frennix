import type { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { StackBackButton } from "@/components/StackBackButton";
import { animation, colors } from "@frennix/ui";

export const fadeScreen = {
  animation: "fade" as const,
  animationDuration: animation.stackFadeMs,
};

/** Stack header with a visible back control (never the default hidden web back). */
export function stackBackOptions(
  title: string,
  extra?: NativeStackNavigationOptions
): NativeStackNavigationOptions {
  return backScreen(title, extra);
}

export function backScreen(
  title: string,
  extra?: NativeStackNavigationOptions
): NativeStackNavigationOptions {
  return {
    title,
    headerShown: true,
    headerBackVisible: false,
    headerLeft: () => <StackBackButton />,
    ...extra,
  };
}

export function modalScreen(title: string): NativeStackNavigationOptions {
  return backScreen(title, { presentation: "modal" });
}

export function fadeDetailScreen(title: string): NativeStackNavigationOptions {
  return backScreen(title, fadeScreen);
}

export function nestedStackScreenOptions() {
  return {
    contentStyle: { backgroundColor: colors.background },
    animation: "fade" as const,
    animationDuration: animation.stackFadeMs,
  };
}

export function nestedBackScreen(title: string): NativeStackNavigationOptions {
  return {
    ...backScreen(title),
    headerStyle: { backgroundColor: colors.background },
    headerTintColor: colors.text,
    headerShadowVisible: false,
  };
}
