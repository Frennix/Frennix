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
 * Official Frennix logo — master at `assets/brand/frennix-logo.png` (synced from founder `assets/frennix-logo.PNG`).
 * Layout exports are proportional crops of the master — not separate designs.
 */
export type FrennixLogoVariant = "full" | "icon" | "mark";

/** Shared compact symbol size for profile header, settings, and similar surfaces. */
export const FRENNIX_BRAND_MARK_SIZE = 32;

const SOURCES: Record<FrennixLogoVariant, number> = {
  /** Cropped from master — symbol + FRENNIX wordmark (no tagline) */
  full: require("@/assets/brand/frennix-logo-full.png"),
  /** Cropped from master — shield symbol only */
  icon: require("@/assets/brand/frennix-logo-icon.png"),
  /** Official master — full artwork with CONNECT. TRAIN. GROW. tagline */
  mark: require("@/assets/brand/frennix-logo.png"),
};

/** Width / height for each variant (from official master exports). */
const ASPECT_RATIO: Record<FrennixLogoVariant, number> = {
  full: 1254 / 1020,
  icon: 1,
  mark: 1,
};

const DEFAULT_HEIGHT: Record<FrennixLogoVariant, number> = {
  full: 36,
  icon: FRENNIX_BRAND_MARK_SIZE,
  mark: 48,
};

/** Keep wordmark text legible — the full export stacks icon + text vertically. */
const MIN_HEIGHT: Record<FrennixLogoVariant, number> = {
  full: 32,
  icon: 24,
  mark: 40,
};

/** Extra layout space so mobile web does not clip the wordmark baseline. */
const WORDMARK_BOTTOM_PAD: Record<FrennixLogoVariant, number> = {
  full: 8,
  icon: 0,
  mark: 4,
};

/** Inset inside square icon/mark containers so artwork never touches edges. */
const SQUARE_INSET_RATIO = 0.08;
const SQUARE_MIN_INSET = 3;

type FrennixLogoProps = {
  variant?: FrennixLogoVariant;
  /** Wordmark height (full) or outer square size (icon/mark). */
  height?: number;
  /** Outer square size for icon/mark; overrides height when set. */
  size?: number;
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

function isSquareVariant(variant: FrennixLogoVariant): boolean {
  return variant === "icon" || variant === "mark";
}

function squareInset(outerSize: number): number {
  return Math.max(SQUARE_MIN_INSET, Math.round(outerSize * SQUARE_INSET_RATIO));
}

function renderSquareImage({
  uri,
  innerSize,
  accessibilityLabel,
  source,
}: {
  uri?: string;
  innerSize: number;
  accessibilityLabel: string;
  source: number;
}) {
  const imageStyle: ImageStyle = {
    width: innerSize,
    height: innerSize,
    minWidth: innerSize,
    minHeight: innerSize,
    flexShrink: 0,
  };

  if (Platform.OS === "web" && uri) {
    return createElement("img", {
      src: uri,
      alt: accessibilityLabel,
      style: {
        display: "block",
        width: innerSize,
        height: innerSize,
        minWidth: innerSize,
        minHeight: innerSize,
        objectFit: "contain",
        overflow: "visible",
      },
    });
  }

  return (
    <CachedAssetImage
      source={source}
      style={[styles.image, imageStyle]}
      contentFit="contain"
      accessibilityLabel={accessibilityLabel}
    />
  );
}

export function FrennixLogo({
  variant = "full",
  height,
  size,
  style,
  accessibilityLabel = "Frennix",
}: FrennixLogoProps) {
  const defaultDimension = DEFAULT_HEIGHT[variant];
  const requested = size ?? height ?? defaultDimension;
  const resolvedDimension = Math.max(requested, MIN_HEIGHT[variant]);

  if (isSquareVariant(variant)) {
    const outerSize = resolvedDimension;
    const inset = squareInset(outerSize);
    const innerSize = outerSize - inset * 2;
    const asset = resolveAssetSource(SOURCES[variant]);

    return (
      <View
        style={[
          styles.squareContainer,
          { width: outerSize, height: outerSize, minWidth: outerSize, minHeight: outerSize },
          style,
        ]}
        accessibilityLabel={accessibilityLabel}
      >
        <View style={[styles.squareInner, { padding: inset }]}>
          {renderSquareImage({
            uri: asset?.uri,
            innerSize,
            accessibilityLabel,
            source: SOURCES[variant],
          })}
        </View>
      </View>
    );
  }

  const aspectRatio = getAspectRatio(variant);
  const width = resolvedDimension * aspectRatio;
  const bottomPad = WORDMARK_BOTTOM_PAD[variant];
  const imageStyle: ImageStyle = {
    height: resolvedDimension,
    width,
    minHeight: resolvedDimension,
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
              height: resolvedDimension,
              width,
              minHeight: resolvedDimension,
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

/** Profile header, settings, and other compact brand surfaces — same symbol sizing everywhere. */
export function FrennixBrandMark({
  style,
  accessibilityLabel = "Frennix",
}: {
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  return (
    <FrennixLogo
      variant="icon"
      size={FRENNIX_BRAND_MARK_SIZE}
      style={style}
      accessibilityLabel={accessibilityLabel}
    />
  );
}

const styles = StyleSheet.create({
  squareContainer: {
    overflow: "visible",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  squareInner: {
    width: "100%",
    height: "100%",
    overflow: "visible",
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    flexShrink: 0,
  },
});
