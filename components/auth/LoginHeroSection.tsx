import { useEffect, useRef } from "react";
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { FrennixLogo } from "@/components/FrennixLogo";
import { CachedAssetImage, colors, spacing, typography } from "@frennix/ui";

const HERO_SCRIM_STOPS: { offset: string; opacity: number }[] = [
  { offset: "0%", opacity: 0.45 },
  { offset: "18%", opacity: 0.22 },
  { offset: "36%", opacity: 0.1 },
  { offset: "56%", opacity: 0.5 },
  { offset: "82%", opacity: 0.94 },
  { offset: "100%", opacity: 1 },
];

const HERO_SOURCE = require("@/assets/brand/welcome-community-hero.png");

export const LOGIN_HERO_ALT =
  "A diverse group of everyday adults in a gym, smiling and encouraging each other after a workout.";

const HERO_HEIGHT_RATIO = 0.34;
const HERO_MIN_HEIGHT = 228;
const HERO_MAX_HEIGHT = 340;
const HERO_DESKTOP_MIN_WIDTH = 768;
const HERO_DESKTOP_HEIGHT_RATIO = 0.38;
const HERO_DESKTOP_MAX_HEIGHT = 380;
/** Anchor cover crop on the upper-center faces in welcome-community-hero.png */
const HERO_CONTENT_POSITION_MOBILE = { top: "20%", left: "50%" } as const;
const HERO_CONTENT_POSITION_DESKTOP = { top: "28%", left: "50%" } as const;
const HERO_COPY_BOTTOM_CLEARANCE = spacing.xxl;

type LoginHeroSectionProps = {
  style?: StyleProp<ViewStyle>;
  topInset?: number;
  showSupporting?: boolean;
};

export function LoginHeroSection({
  style,
  topInset = 0,
  showSupporting = true,
}: LoginHeroSectionProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isWide = windowWidth >= HERO_DESKTOP_MIN_WIDTH;
  const heroHeight = Math.round(
    Math.min(
      isWide ? HERO_DESKTOP_MAX_HEIGHT : HERO_MAX_HEIGHT,
      Math.max(HERO_MIN_HEIGHT, windowHeight * (isWide ? HERO_DESKTOP_HEIGHT_RATIO : HERO_HEIGHT_RATIO))
    )
  );
  const tight = windowHeight < 640;
  const heroContentPosition = isWide ? HERO_CONTENT_POSITION_DESKTOP : HERO_CONTENT_POSITION_MOBILE;
  const heroObjectPosition = isWide ? "50% 28%" : "50% 20%";

  const heroOpacity = useRef(new Animated.Value(0)).current;
  const heroScale = useRef(new Animated.Value(1.06)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const copyOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heroOpacity, {
        toValue: 1,
        duration: 520,
        useNativeDriver: true,
      }),
      Animated.timing(heroScale, {
        toValue: 1,
        duration: 880,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(80),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 420,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.delay(180),
        Animated.timing(copyOpacity, {
          toValue: 1,
          duration: 480,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [copyOpacity, heroOpacity, heroScale, logoOpacity]);

  return (
    <View style={[styles.shell, { height: heroHeight }, style]}>
      <Animated.View
        style={[
          styles.mediaLayer,
          {
            opacity: heroOpacity,
            transform: [{ scale: heroScale }],
          },
        ]}
      >
        <View
          style={[
            styles.heroMediaFrame,
            isWide ? styles.heroMediaFrameWide : styles.heroMediaFrameMobile,
          ]}
        >
          <CachedAssetImage
            source={HERO_SOURCE}
            style={[
              styles.heroImage,
              Platform.OS === "web"
                ? ({ objectPosition: heroObjectPosition } as object)
                : null,
            ]}
            contentFit="cover"
            contentPosition={heroContentPosition}
            accessibilityLabel={LOGIN_HERO_ALT}
          />
        </View>
      </Animated.View>

      <View style={styles.heroOverlay} pointerEvents="none">
        <Svg width="100%" height="100%" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="loginHeroScrim" x1="0" y1="0" x2="0" y2="1">
              {HERO_SCRIM_STOPS.map((stop) => (
                <Stop
                  key={stop.offset}
                  offset={stop.offset}
                  stopColor={colors.background}
                  stopOpacity={stop.opacity}
                />
              ))}
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#loginHeroScrim)" />
        </Svg>
      </View>

      <View
        style={[
          styles.overlayContent,
          { paddingBottom: HERO_COPY_BOTTOM_CLEARANCE },
        ]}
      >
        <View style={styles.brandingStack}>
          <Animated.View style={[styles.logoWrap, { opacity: logoOpacity }]}>
            <FrennixLogo variant="mark" height={tight ? 62 : 76} style={styles.logo} />
          </Animated.View>

          <Animated.View style={[styles.copyBlock, { opacity: copyOpacity }]}>
            <View style={styles.headlineStack} accessibilityRole="header">
              <Text style={styles.headlineLine}>CONNECT.</Text>
              <Text style={[styles.headlineLine, styles.headlineAccent]}>TRAIN.</Text>
              <Text style={styles.headlineLine}>ACHIEVE.</Text>
            </View>

            <Text style={[styles.lead, tight && styles.leadTight]}>
              Find your training partner. Reach your goals together.
            </Text>

            {showSupporting && !tight ? (
              <Text style={styles.supporting} accessibilityRole="text">
                A fitness community built to help real people stay motivated and consistent.
              </Text>
            ) : null}
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    width: "100%",
    overflow: "hidden",
    backgroundColor: colors.background,
  },
  mediaLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  heroMediaFrame: {
    position: "absolute",
    left: 0,
    right: 0,
  },
  heroMediaFrameMobile: {
    top: "-9%",
    height: "112%",
  },
  heroMediaFrameWide: {
    top: "-14%",
    height: "118%",
    left: "-8%",
    right: "-8%",
    ...(Platform.OS === "web"
      ? ({ transform: [{ scale: 0.93 }] } as object)
      : ({ transform: [{ scale: 0.95 }] } as object)),
  },
  heroImage: {
    width: "100%",
    height: "100%",
    ...(Platform.OS === "web" ? ({ objectFit: "cover" } as object) : null),
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  overlayContent: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    zIndex: 2,
  },
  brandingStack: {
    width: "100%",
    alignItems: "center",
    gap: spacing.md,
  },
  logoWrap: {
    marginTop: spacing.sm,
  },
  logo: {
    alignSelf: "center",
  },
  copyBlock: {
    width: "100%",
    maxWidth: 420,
    alignItems: "center",
    gap: spacing.sm,
    flexShrink: 1,
  },
  headlineStack: {
    alignItems: "center",
    gap: 2,
  },
  headlineLine: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "800",
    letterSpacing: 1.2,
    textAlign: "center",
    color: colors.text,
    textTransform: "uppercase",
  },
  headlineAccent: {
    color: colors.accent,
  },
  lead: {
    ...typography.section,
    fontSize: 17,
    lineHeight: 24,
    textAlign: "center",
    color: colors.text,
  },
  leadTight: {
    fontSize: 15,
    lineHeight: 21,
  },
  supporting: {
    ...typography.bodySmall,
    width: "100%",
    maxWidth: 420,
    textAlign: "center",
    color: colors.textSecondary,
    lineHeight: 20,
    paddingHorizontal: spacing.sm,
    flexShrink: 1,
    ...(Platform.OS === "web"
      ? ({
          overflow: "visible",
          whiteSpace: "normal",
          wordWrap: "break-word",
        } as object)
      : null),
  },
});
