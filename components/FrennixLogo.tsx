import { Image, StyleSheet, type ImageStyle, type StyleProp } from "react-native";

/**
 * Official Frennix logo — always loads from `assets/brand/frennix-logo.png` (master)
 * or layout exports cropped from that master. Do not substitute alternate artwork.
 */
export type FrennixLogoVariant = "full" | "icon" | "mark";

const SOURCES: Record<FrennixLogoVariant, number> = {
  /** Cropped from master — symbol + FRENNIX wordmark (no tagline) */
  full: require("@/assets/brand/frennix-logo-full.png"),
  /** Cropped from master — symbol only */
  icon: require("@/assets/brand/frennix-logo-icon.png"),
  /** Official master — full artwork with CONNECT. TRAIN. GROW. tagline */
  mark: require("@/assets/brand/frennix-logo.png"),
};

/** Width / height for each variant (from official master exports). */
const ASPECT_RATIO: Record<FrennixLogoVariant, number> = {
  full: 688 / 508,
  icon: 1,
  mark: 698 / 623,
};

const DEFAULT_HEIGHT: Record<FrennixLogoVariant, number> = {
  full: 36,
  icon: 28,
  mark: 48,
};

type FrennixLogoProps = {
  variant?: FrennixLogoVariant;
  height?: number;
  style?: StyleProp<ImageStyle>;
  accessibilityLabel?: string;
};

export function FrennixLogo({
  variant = "full",
  height = DEFAULT_HEIGHT[variant],
  style,
  accessibilityLabel = "Frennix",
}: FrennixLogoProps) {
  const width = height * ASPECT_RATIO[variant];

  return (
    <Image
      source={SOURCES[variant]}
      style={[styles.image, { height, width }, style]}
      resizeMode="contain"
      accessibilityLabel={accessibilityLabel}
    />
  );
}

const styles = StyleSheet.create({
  image: {},
});
