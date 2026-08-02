import { StyleSheet, View } from "react-native";
import { Skeleton, colors, spacing } from "@frennix/ui";

const PHOTO_HEIGHT = 116;

export function DiscoverProfileSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton width="100%" height={PHOTO_HEIGHT} style={styles.photo} />
      <View style={styles.content}>
        <Skeleton width="56%" height={18} />
        <Skeleton width="40%" height={12} />
        <Skeleton width="88%" height={14} />
        <Skeleton width="76%" height={14} />
        <Skeleton width="82%" height={14} />
        <Skeleton width="70%" height={14} />
        <View style={styles.statsRow}>
          <Skeleton width="42%" height={12} />
          <Skeleton width="28%" height={12} />
        </View>
      </View>
    </View>
  );
}

export function DiscoverPeopleSkeleton({ count = 6 }: { count?: number }) {
  const rows = Math.ceil(count / 2);
  return (
    <View style={styles.grid}>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <View key={rowIndex} style={styles.gridRow}>
          <DiscoverProfileSkeleton />
          {rowIndex * 2 + 1 < count ? <DiscoverProfileSkeleton /> : <View style={styles.gridSpacer} />}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    gap: spacing.sm,
  },
  gridRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  gridSpacer: {
    flex: 1,
  },
  card: {
    flex: 1,
    backgroundColor: colors.surfaceCard,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: "hidden",
  },
  photo: {
    borderRadius: 0,
  },
  content: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
});
