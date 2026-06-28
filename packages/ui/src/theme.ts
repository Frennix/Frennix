import { Platform, type ViewStyle } from "react-native";

export const colors = {
  background: "#0A0A0B",
  surface: "#141416",
  surfaceElevated: "#1C1C1F",
  border: "#2A2A2E",
  text: "#FAFAFA",
  textSecondary: "#A1A1AA",
  textMuted: "#71717A",
  accent: "#22C55E",
  accentMuted: "#166534",
  danger: "#EF4444",
  warning: "#F59E0B",
  white: "#FFFFFF",
  black: "#000000",
};

/** Semi-transparent overlays for story viewers, modals, and glass surfaces. */
export const overlays = {
  glass: "rgba(10, 10, 11, 0.62)",
  glassMedium: "rgba(10, 10, 11, 0.55)",
  glassStrong: "rgba(10, 10, 11, 0.72)",
  glassBorder: "rgba(255,255,255,0.12)",
  glassBorderStrong: "rgba(255,255,255,0.14)",
  glassBorderEmphasis: "rgba(255,255,255,0.16)",
  accentTint: "rgba(34, 197, 94, 0.16)",
  accentTintStrong: "rgba(34, 197, 94, 0.18)",
  accentTintSoft: "rgba(34, 197, 94, 0.14)",
  accentBorder: "rgba(34, 197, 94, 0.55)",
  warningTint: "rgba(234, 179, 8, 0.16)",
  warningTintSoft: "rgba(234, 179, 8, 0.14)",
  warningBorder: "rgba(234, 179, 8, 0.55)",
  warningBorderSoft: "rgba(234, 179, 8, 0.45)",
  whiteMuted: "rgba(255,255,255,0.62)",
  whiteSoft: "rgba(255,255,255,0.78)",
  whiteFaint: "rgba(255,255,255,0.72)",
  whiteSubtle: "rgba(255,255,255,0.85)",
  whiteDim: "rgba(255,255,255,0.55)",
  whiteGhost: "rgba(255,255,255,0.06)",
  whiteGhostBorder: "rgba(255,255,255,0.08)",
  whiteStrong: "rgba(255,255,255,0.88)",
};

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 9999,
};

export const typography = {
  title: { fontSize: 28, fontWeight: "700" as const, color: colors.text, lineHeight: 34 },
  screenTitle: { fontSize: 24, fontWeight: "700" as const, color: colors.text, lineHeight: 30 },
  heading: { fontSize: 20, fontWeight: "600" as const, color: colors.text, lineHeight: 26 },
  section: { fontSize: 18, fontWeight: "600" as const, color: colors.text, lineHeight: 24 },
  body: { fontSize: 16, fontWeight: "400" as const, color: colors.text, lineHeight: 22 },
  bodySmall: { fontSize: 14, fontWeight: "400" as const, color: colors.textSecondary, lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: "500" as const, color: colors.textMuted, lineHeight: 16 },
  button: { fontSize: 16, fontWeight: "600" as const, color: colors.text, lineHeight: 20 },
  badge: { fontSize: 11, fontWeight: "700" as const, color: colors.text, lineHeight: 14 },
  menuIcon: { fontSize: 22, lineHeight: 24, color: colors.textSecondary, fontWeight: "700" as const },
  menuIconCompact: { fontSize: 18, lineHeight: 20, color: colors.textSecondary, fontWeight: "700" as const },
  overlayHeadline: { fontSize: 16, fontWeight: "700" as const, color: overlays.whiteSubtle, lineHeight: 22 },
  overlayBody: { fontSize: 14, fontWeight: "500" as const, color: overlays.whiteSoft, lineHeight: 20 },
};

export const iconSize = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 28,
  xl: 32,
};

/** Minimum touch target per accessibility guidelines (44pt). */
export const touchTarget = 44;

export const animation = {
  stackFadeMs: 200,
  feedEnter: { duration: 260, damping: 22 },
  pressScale: 0.97,
  skeletonPulseMs: 700,
};

type ShadowStyle = Pick<
  ViewStyle,
  "shadowColor" | "shadowOffset" | "shadowOpacity" | "shadowRadius" | "elevation"
>;

export const shadows: Record<"sm" | "md" | "lg", ShadowStyle> = {
  sm: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 8,
  },
};

/** Cross-platform shadow helper — web ignores elevation. */
export function applyShadow(level: keyof typeof shadows): ViewStyle {
  return Platform.select({
    web: {
      boxShadow: level === "sm" ? "0 1px 3px rgba(0,0,0,0.18)" : level === "md" ? "0 2px 8px rgba(0,0,0,0.22)" : "0 4px 16px rgba(0,0,0,0.28)",
    },
    default: shadows[level],
  }) as ViewStyle;
}
