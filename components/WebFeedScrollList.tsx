import { useCallback, type ReactElement, type ReactNode, type RefObject } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import type { FeedListRow } from "@/lib/feed-list-rows";
import { flexFill, webScrollSurface } from "@/lib/flex-layout";

type WebFeedScrollListProps = {
  scrollRef: RefObject<ScrollView | null>;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
  scrollEnabled: boolean;
  data: FeedListRow[];
  keyExtractor: (item: FeedListRow) => string;
  renderItem: (info: { item: FeedListRow }) => ReactNode;
  ListHeaderComponent?: ReactNode;
  ListEmptyComponent?: ReactNode;
  refreshControl?: ReactElement<typeof RefreshControl>;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onScrollEndDrag?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onMomentumScrollEnd?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onLayout?: (height: number) => void;
  onContentSizeChange?: (width: number, height: number) => void;
  nativeID?: string;
};

/** Web-only feed scroll surface — avoids RN Web FlatList / VirtualizedList Safari bugs. */
export function WebFeedScrollList({
  scrollRef,
  style,
  contentContainerStyle,
  scrollEnabled,
  data,
  keyExtractor,
  renderItem,
  ListHeaderComponent,
  ListEmptyComponent,
  refreshControl,
  onScroll,
  onScrollEndDrag,
  onMomentumScrollEnd,
  onLayout,
  onContentSizeChange,
  nativeID,
}: WebFeedScrollListProps) {
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      onScroll(event);
    },
    [onScroll]
  );

  return (
    <ScrollView
      ref={scrollRef}
      nativeID={nativeID}
      pointerEvents="auto"
      style={[styles.list, style, webScrollSurface]}
      contentContainerStyle={contentContainerStyle}
      scrollEnabled={scrollEnabled}
      nestedScrollEnabled
      scrollEventThrottle={16}
      onScroll={handleScroll}
      onScrollEndDrag={onScrollEndDrag}
      onMomentumScrollEnd={onMomentumScrollEnd}
      onLayout={(event) => onLayout?.(event.nativeEvent.layout.height)}
      onContentSizeChange={(width, height) => onContentSizeChange?.(width, height)}
      refreshControl={refreshControl}
      keyboardShouldPersistTaps="handled"
    >
      {ListHeaderComponent}
      {data.length === 0
        ? ListEmptyComponent
        : data.map((item) => (
            <View key={keyExtractor(item)} collapsable={false}>
              {renderItem({ item })}
            </View>
          ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { ...flexFill },
});
