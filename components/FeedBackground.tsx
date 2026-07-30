import { memo, type ReactNode } from "react";
import { Platform, StyleSheet, View, type ViewStyle } from "react-native";
import { colors } from "@frennix/ui";

interface FeedBackgroundProps {
  children: ReactNode;
  style?: ViewStyle;
  nativeID?: string;
}

/** Layered charcoal feed canvas with subtle radial lighting. */
export const FeedBackground = memo(function FeedBackground({
  children,
  style,
  nativeID,
}: FeedBackgroundProps) {
  return (
    <View style={[styles.root, style]} nativeID={nativeID} pointerEvents="box-none">
      <View style={styles.radialTop} pointerEvents="none" />
      <View style={styles.radialBottom} pointerEvents="none" />
      {Platform.OS === "web" ? <View style={styles.webGradient} pointerEvents="none" /> : null}
      {children}
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    overflow: "hidden",
    backgroundColor: colors.backgroundFeed,
    position: "relative",
  },
  radialTop: {
    position: "absolute",
    top: -80,
    left: "15%",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "rgba(34, 197, 94, 0.05)",
  },
  radialBottom: {
    position: "absolute",
    bottom: 120,
    right: -40,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(34, 197, 94, 0.03)",
  },
  webGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundImage:
      "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(34,197,94,0.08), transparent 55%), radial-gradient(ellipse 60% 40% at 100% 80%, rgba(34,197,94,0.04), transparent 50%), linear-gradient(180deg, #0b0b0d 0%, #0d0d10 100%)",
  } as ViewStyle,
});
