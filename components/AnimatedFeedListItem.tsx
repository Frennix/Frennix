import { memo } from "react";
import Animated, { FadeInDown } from "react-native-reanimated";
import { FeedListItem, type FeedListItemActions } from "@/components/FeedListItem";
import type { Post } from "@frennix/types";

const animatedPostIds = new Set<string>();

type AnimatedFeedListItemProps = {
  post: Post;
  userId: string;
  actions: FeedListItemActions;
  mediaActive?: boolean;
};

export const AnimatedFeedListItem = memo(function AnimatedFeedListItem(props: AnimatedFeedListItemProps) {
  const shouldAnimate = !animatedPostIds.has(props.post.id);
  if (shouldAnimate) {
    animatedPostIds.add(props.post.id);
    return (
      <Animated.View entering={FadeInDown.duration(260).springify().damping(22)}>
        <FeedListItem {...props} />
      </Animated.View>
    );
  }

  return <FeedListItem {...props} />;
});
