import resolveAssetSource from "expo-asset/build/resolveAssetSource";
import { createElement } from "react";
import {
  Platform,
  StyleSheet,
  View,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { CachedAssetImage } from "@frennix/ui";

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
  full: 688 / 597,
  icon: 1,
  mark: 698 / 623,
};

const DEFAULT_HEIGHT: Record<FrennixLogoVariant, number> = {
  full: 36,
  icon: 28,
  mark: 48,
};

/** Keep wordmark text legible — the full export stacks icon + text vertically. */
const MIN_HEIGHT: Record<FrennixLogoVariant, number> = {
  full: 32,
  icon: 20,
  mark: 40,
};

/** Extra layout space so mobile web does not clip the wordmark baseline. */
const WORDMARK_BOTTOM_PAD: Record<FrennixLogoVariant, number> = {
  full: 8,
  icon: 0,
  mark: 4,
};

type FrennixLogoProps = {
  variant?: FrennixLogoVariant;
  height?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

function getAspectRatio(variant: FrennixLogoVariant): number {
  const asset = resolveAssetSource(SOURCES[variant]);
  if (asset?.width && asset?.height) {
    return asset.width / asset.height;
  }
  return ASPECT_RATIO[variant];
}

export function FrennixLogo({
  variant = "full",
  height = DEFAULT_HEIGHT[variant],
  style,
  accessibilityLabel = "Frennix",
}: FrennixLogoProps) {
  const resolvedHeight = Math.max(height, MIN_HEIGHT[variant]);
  const aspectRatio = getAspectRatio(variant);
  const width = resolvedHeight * aspectRatio;
  const bottomPad = WORDMARK_BOTTOM_PAD[variant];
  const imageStyle: ImageStyle = {
    height: resolvedHeight,
    width,
    minHeight: resolvedHeight,
  };

  const wrapperStyle: ViewStyle = {
    overflow: "visible",
    paddingBottom: bottomPad,
    alignSelf: "center",
  };

  if (Platform.OS === "web") {
    const asset = resolveAssetSource(SOURCES[variant]);
    const uri = asset?.uri;
    if (uri) {
      return (
        <View style={[wrapperStyle, style]}>
          {createElement("img", {
            src: uri,
            alt: accessibilityLabel,
            style: {
              display: "block",
              height: resolvedHeight,
              width,
              minHeight: resolvedHeight,
              objectFit: "contain",
              overflow: "visible",
            },
          })}
        </View>
      );
    }
  }

  return (
    <View style={[wrapperStyle, style]}>
      <CachedAssetImage
        source={SOURCES[variant]}
        style={[styles.image, imageStyle]}
        contentFit="contain"
        accessibilityLabel={accessibilityLabel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    flexShrink: 0,
  },
});
