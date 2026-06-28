import { memo } from "react";
import { Platform } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { animation } from "@frennix/ui";
import { FeedListItem, type FeedListItemActions } from "@/components/FeedListItem";
import type { Post } from "@frennix/types";

const animatedPostIds = new Set<string>();
const { duration, damping } = animation.feedEnter;

type AnimatedFeedListItemProps = {
  post: Post;
  userId: string;
  actions: FeedListItemActions;
  interactionActive?: boolean;
  mediaActive?: boolean;
  mediaPageIndex?: number;
  onMediaPageIndexChange?: (index: number) => void;
};

export const AnimatedFeedListItem = memo(function AnimatedFeedListItem(props: AnimatedFeedListItemProps) {
  const shouldAnimate = Platform.OS !== "web" && !animatedPostIds.has(props.post.id);
  if (shouldAnimate) {
    animatedPostIds.add(props.post.id);
    return (
      <Animated.View entering={FadeInDown.duration(duration).springify().damping(damping)}>
        <FeedListItem {...props} />
      </Animated.View>
    );
  }

  return <FeedListItem {...props} />;
});
