import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { PlatformPressable } from "@react-navigation/elements";
import { router, type Href } from "expo-router";
import { scrollTabToTop, type TabScrollKey } from "@/lib/tab-scroll-registry";
import { switchTab } from "@/lib/press-utils";

type FastTabBarButtonProps = BottomTabBarButtonProps & {
  href: Href;
  tabKey: TabScrollKey;
};

function isTabBarButtonSelected(props: BottomTabBarButtonProps) {
  if (props.accessibilityState?.selected === true) return true;
  // React Navigation 7 passes aria-selected (web + native tab bar).
  if (props["aria-selected"] === true) return true;
  return false;
}

/**
 * Tab bar button that dismisses nested stack screens before switching tabs.
 * Re-tapping the active tab scrolls its content to the top without refetching.
 */
export function FastTabBarButton({
  href,
  tabKey,
  onPress: emitTabPress,
  ...rest
}: FastTabBarButtonProps) {
  const isSelected = isTabBarButtonSelected(rest);

  return (
    <PlatformPressable
      {...rest}
      href={href}
      onPress={(event) => {
        event?.preventDefault?.();

        if (isSelected) {
          emitTabPress?.(event);
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
