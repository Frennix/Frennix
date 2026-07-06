import { StyleSheet, View } from "react-native";
import { Skeleton } from "./Skeleton";
import { FeedLayout, feedLayout } from "./feed-layout";

export function FeedPostCardSkeleton() {
  return (
    <FeedLayout.Root>
      <FeedLayout.Header>
        <Skeleton width={feedLayout.header.avatarSize} height={feedLayout.header.avatarSize} style={styles.avatar} />
        <FeedLayout.HeaderText>
          <Skeleton width="42%" height={14} />
          <Skeleton width="72%" height={12} />
        </FeedLayout.HeaderText>
      </FeedLayout.Header>

      <FeedLayout.Media>
        <Skeleton width="100%" height={320} />
      </FeedLayout.Media>

      <FeedLayout.Actions>
        <View style={styles.actions}>
          <Skeleton width={28} height={28} style={styles.actionIcon} />
          <Skeleton width={28} height={28} style={styles.actionIcon} />
          <Skeleton width={28} height={28} style={styles.actionIcon} />
          <Skeleton width={28} height={28} style={styles.actionIcon} />
          <Skeleton width={28} height={28} style={styles.actionIcon} />
        </View>
      </FeedLayout.Actions>

      <FeedLayout.Caption>
        <Skeleton width="88%" height={14} />
        <Skeleton width="62%" height={14} style={styles.captionLine} />
      </FeedLayout.Caption>

      <FeedLayout.Engagement>
        <Skeleton width="36%" height={12} />
      </FeedLayout.Engagement>

      <FeedLayout.Comments>
        <Skeleton width="48%" height={12} />
      </FeedLayout.Comments>
    </FeedLayout.Root>
  );
}

const styles = StyleSheet.create({
  avatar: { borderRadius: feedLayout.header.avatarSize / 2 },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: feedLayout.actions.gap,
    minHeight: feedLayout.actions.rowHeight,
  },
  actionIcon: { borderRadius: 14 },
  captionLine: { marginTop: feedLayout.sectionGap },
});
