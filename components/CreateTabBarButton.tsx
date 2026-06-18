import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { PlatformPressable } from "@react-navigation/elements";
import { openCreatePost } from "@/lib/press-utils";

/** Post tab opens the create-post modal only — never switches to the placeholder route. */
export function CreateTabBarButton(props: BottomTabBarButtonProps) {
  const { onPress, ...rest } = props;

  return (
    <PlatformPressable
      {...rest}
      onPress={(event) => {
        event?.preventDefault?.();
        openCreatePost();
      }}
    />
  );
}
