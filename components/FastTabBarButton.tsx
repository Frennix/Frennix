import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { PlatformPressable } from "@react-navigation/elements";
import type { Href } from "expo-router";
import { switchTab } from "@/lib/press-utils";

type FastTabBarButtonProps = BottomTabBarButtonProps & {
  href: Href;
};

/** Tab bar button that dismisses stack screens (e.g. chat) before switching tabs. */
export function FastTabBarButton({ href, ...rest }: FastTabBarButtonProps) {
  return (
    <PlatformPressable
      {...rest}
      onPress={(event) => {
        event?.preventDefault?.();
        switchTab(href);
      }}
    />
  );
}
