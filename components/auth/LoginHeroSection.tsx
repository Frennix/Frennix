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
import { FrennixLogo } from "@/components/FrennixLogo";
import { CachedAssetImage, colors, spacing, typography } from "@frennix/ui";

const HERO_SOURCE = require("@/assets/brand/welcome-community-hero.png");

export const LOGIN_HERO_ALT =
  "A diverse group of everyday adults in a gym, smiling and encouraging each other after a workout.";

const HERO_HEIGHT_RATIO = 0.34;
const HERO_MIN_HEIGHT = 228;
const HERO_MAX_HEIGHT = 340;
const HERO_EXTRA_TOP_SAFE_AREA = 24;

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
  const { height: windowHeight } = useWindowDimensions();
  const heroHeight = Math.round(
    Math.min(HERO_MAX_HEIGHT, Math.max(HERO_MIN_HEIGHT, windowHeight * HERO_HEIGHT_RATIO))
  );
  const tight = windowHeight < 640;

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
        <CachedAssetImage
          source={HERO_SOURCE}
          style={styles.heroImage}
          contentFit="cover"
          accessibilityLabel={LOGIN_HERO_ALT}
        />
      </Animated.View>

      <View style={styles.heroScrimTop} pointerEvents="none" />
      {Platform.OS === "web" ? (
        <View style={styles.heroScrimBottom} pointerEvents="none" />
      ) : (
        <>
          <View style={styles.heroScrimBottomNativeA} pointerEvents="none" />
          <View style={styles.heroScrimBottomNativeB} pointerEvents="none" />
          <View style={styles.heroScrimBottomNativeC} pointerEvents="none" />
        </>
      )}
      <View style={styles.heroScrimFade} pointerEvents="none" />

      <View
        style={[
          styles.overlayContent,
          { paddingTop: topInset + spacing.lg + spacing.sm },
        ]}
      >
        <View
          style={[
            styles.brandingStack,
            { transform: [{ translateY: HERO_EXTRA_TOP_SAFE_AREA }] },
          ]}
        >
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
              <Text style={styles.supporting}>
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
  heroImage: {
    width: "100%",
    height: "100%",
  },
  heroScrimTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "30%",
    backgroundColor: "rgba(10, 10, 11, 0.45)",
  },
  heroScrimBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "72%",
    ...(Platform.OS === "web"
      ? ({
          backgroundImage:
            "linear-gradient(180deg, rgba(10,10,11,0) 0%, rgba(10,10,11,0.48) 26%, rgba(10,10,11,0.94) 58%, #0A0A0B 100%)",
        } as object)
      : null),
  },
  heroScrimBottomNativeA: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "55%",
    backgroundColor: "rgba(10, 10, 11, 0.38)",
  },
  heroScrimBottomNativeB: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "38%",
    backgroundColor: "rgba(10, 10, 11, 0.68)",
  },
  heroScrimBottomNativeC: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "22%",
    backgroundColor: "rgba(10, 10, 11, 0.94)",
  },
  heroScrimFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: -1,
    height: 48,
    backgroundColor: colors.background,
  },
  overlayContent: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
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
    textAlign: "center",
    color: colors.textSecondary,
    lineHeight: 20,
    paddingHorizontal: spacing.sm,
  },
});
