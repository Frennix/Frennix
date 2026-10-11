import { StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

const SCRIM = "#0a0a0b";

/** Short enough to sit behind the story header and fade out before the photo. */
export const STORY_HEADER_FADE_HEIGHT = 128;

/** Sits behind captions and meal labels, then fades to the photo. */
export const STORY_FOOTER_FADE_HEIGHT = 188;

const HEADER_STOPS = [
  { offset: "0%", opacity: 0.58 },
  { offset: "46%", opacity: 0.2 },
  { offset: "78%", opacity: 0.04 },
  { offset: "100%", opacity: 0 },
] as const;

const FOOTER_STOPS = [
  { offset: "0%", opacity: 0 },
  { offset: "36%", opacity: 0.08 },
  { offset: "70%", opacity: 0.3 },
  { offset: "100%", opacity: 0.64 },
] as const;

function StoryEdgeFade({
  id,
  edge,
  height,
  stops,
}: {
  id: string;
  edge: "top" | "bottom";
  height: number;
  stops: ReadonlyArray<{ offset: string; opacity: number }>;
}) {
  return (
    <View
      pointerEvents="none"
      style={[styles.fade, edge === "top" ? styles.top : styles.bottom, { height }]}
    >
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            {stops.map((stop) => (
              <Stop
                key={`${id}-${stop.offset}`}
                offset={stop.offset}
                stopColor={SCRIM}
                stopOpacity={stop.opacity}
              />
            ))}
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/** Header fade. The last stop is fully transparent, so the photo has no hard edge. */
export function StoryHeaderFade() {
  return (
    <StoryEdgeFade
      id="storyHeaderFade"
      edge="top"
      height={STORY_HEADER_FADE_HEIGHT}
      stops={HEADER_STOPS}
    />
  );
}

/** Subtle bottom fade so captions and Nutrition labels stay readable. */
export function StoryFooterGradient() {
  return (
    <StoryEdgeFade
      id="storyFooterFade"
      edge="bottom"
      height={STORY_FOOTER_FADE_HEIGHT}
      stops={FOOTER_STOPS}
    />
  );
}

const styles = StyleSheet.create({
  fade: {
    position: "absolute",
    left: 0,
    right: 0,
  },
  top: {
    top: 0,
    zIndex: 1,
  },
  bottom: {
    bottom: 0,
    zIndex: 2,
  },
});
