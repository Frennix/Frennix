import type { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { StackBackButton } from "@/components/StackBackButton";

/** Stack header with a visible back control (never the default hidden web back). */
export function stackBackOptions(
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
