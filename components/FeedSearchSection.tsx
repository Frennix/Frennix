import { memo, useCallback } from "react";
import { StyleSheet, View } from "react-native";
import { FeedSearchBar, spacing } from "@frennix/ui";
import { openDiscoverSearch } from "@/lib/discover-navigation";
import { openFeedSearch } from "@/lib/feed-search-controller";

export const FeedSearchSection = memo(function FeedSearchSection() {
  const handleFilterPress = useCallback(() => {
    openDiscoverSearch({ openFilters: true });
  }, []);

  return (
    <View style={styles.root} nativeID="feed-search-section">
      <FeedSearchBar
        onBarPress={openFeedSearch}
        onFilterPress={handleFilterPress}
        editable={false}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    alignSelf: "stretch",
    flexShrink: 1,
    overflow: "hidden",
  },
});
