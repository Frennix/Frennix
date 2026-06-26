import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { PlatformPressable } from "@react-navigation/elements";
import { router, type Href } from "expo-router";
import { scrollTabToTop, type TabScrollKey } from "@/lib/tab-scroll-registry";
import { switchTab } from "@/lib/press-utils";

type FastTabBarButtonProps = BottomTabBarButtonProps & {
  href: Href;
  tabKey: TabScrollKey;
};

/**
 * Tab bar button that dismisses nested stack screens before switching tabs.
 * Re-tapping the active tab scrolls its content to the top without refetching.
 */
export function FastTabBarButton({ href, tabKey, ...rest }: FastTabBarButtonProps) {
  const isSelected = rest.accessibilityState?.selected === true;

  return (
    <PlatformPressable
      {...rest}
      onPress={(event) => {
        event?.preventDefault?.();

        if (isSelected) {
          if (router.canDismiss()) {
            switchTab(href);
            return;
          }
          scrollTabToTop(tabKey);
          return;
        }

        switchTab(href);
      }}
    />
  );
}
