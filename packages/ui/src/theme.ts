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

export const spacing = {
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
  title: { fontSize: 28, fontWeight: "700" as const, color: colors.text },
  heading: { fontSize: 20, fontWeight: "600" as const, color: colors.text },
  body: { fontSize: 16, fontWeight: "400" as const, color: colors.text },
  bodySmall: { fontSize: 14, fontWeight: "400" as const, color: colors.textSecondary },
  caption: { fontSize: 12, fontWeight: "500" as const, color: colors.textMuted },
};
