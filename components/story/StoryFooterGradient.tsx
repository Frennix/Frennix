import { Platform, StyleSheet, View, type ViewStyle } from "react-native";

const GRADIENT_HEIGHT = 300;

/** Subtle bottom fade so captions and controls stay readable on any media. */
export function StoryFooterGradient() {
  if (Platform.OS === "web") {
    return <View style={styles.webGradient} pointerEvents="none" />;
  }

  return (
    <View style={styles.nativeWrap} pointerEvents="none">
      <View style={[styles.nativeBand, styles.nativeBandSoft]} />
      <View style={[styles.nativeBand, styles.nativeBandMid]} />
      <View style={[styles.nativeBand, styles.nativeBandStrong]} />
    </View>
  );
}

const webGradientStyle: ViewStyle =
  Platform.OS === "web"
    ? ({
        backgroundImage:
          "linear-gradient(to top, rgba(10, 10, 11, 0.96) 0%, rgba(10, 10, 11, 0.78) 28%, rgba(10, 10, 11, 0.42) 58%, rgba(10, 10, 11, 0.08) 82%, transparent 100%)",
      } as ViewStyle)
    : {};

const styles = StyleSheet.create({
  webGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: GRADIENT_HEIGHT,
    zIndex: 2,
    ...webGradientStyle,
  },
  nativeWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: GRADIENT_HEIGHT,
    zIndex: 2,
    justifyContent: "flex-end",
  },
  nativeBand: {
    width: "100%",
  },
  nativeBandSoft: {
    height: 72,
    backgroundColor: "rgba(10, 10, 11, 0.12)",
  },
  nativeBandMid: {
    height: 88,
    backgroundColor: "rgba(10, 10, 11, 0.38)",
  },
  nativeBandStrong: {
    height: 140,
    backgroundColor: "rgba(10, 10, 11, 0.82)",
  },
});
