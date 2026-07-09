import { Platform, StyleSheet, Text, View } from "react-native";
import { formatBuildVersionLine, getBuildVersion } from "@/lib/build-version";
import { colors, typography } from "@frennix/ui";

/** Fixed build stamp so testers can confirm they are on the latest Vercel deploy. */
export function BuildVersionBanner() {
  if (Platform.OS !== "web") return null;

  const info = getBuildVersion();
  const label = formatBuildVersionLine(info);

  return (
    <View
      style={styles.wrap}
      pointerEvents="none"
      nativeID="build-version-banner"
      accessibilityLabel={`Build version ${label}`}
    >
      <Text style={styles.text} selectable>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2147483645,
    alignItems: "center",
    paddingTop: 4,
    paddingHorizontal: 8,
  },
  text: {
    ...typography.caption,
    fontSize: 10,
    lineHeight: 12,
    color: colors.accent,
    backgroundColor: "rgba(10, 10, 11, 0.88)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    fontFamily: Platform.OS === "web" ? "monospace" : undefined,
    overflow: "hidden",
  },
});
