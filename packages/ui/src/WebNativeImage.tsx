import { createElement } from "react";
import { Platform, type StyleProp, type ViewStyle } from "react-native";

export type WebNativeImageProps = {
  uri: string;
  contentFit?: "cover" | "contain";
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  onLoad?: () => void;
  onError?: () => void;
};

/**
 * Safari/WebKit-safe feed image path — plain HTML img with object-fit.
 * Used on web instead of expo-image for PNG/JPEG mismatch tolerance.
 */
export function WebNativeImage({
  uri,
  contentFit = "cover",
  style,
  accessibilityLabel,
  onLoad,
  onError,
}: WebNativeImageProps) {
  if (Platform.OS !== "web") {
    return null;
  }

  const flatStyle = Array.isArray(style)
    ? Object.assign({}, ...style.filter(Boolean))
    : style ?? {};

  return createElement("img", {
    src: uri,
    alt: accessibilityLabel ?? "",
    draggable: false,
    style: {
      width: "100%",
      height: "100%",
      objectFit: contentFit,
      objectPosition: "center",
      display: "block",
      ...flatStyle,
    },
    onLoad: () => onLoad?.(),
    onError: () => onError?.(),
  });
}
