import { DarkTheme, type Theme } from "@react-navigation/native";
import { colors } from "@frennix/ui";

/** Ensures navigation chrome (tab bar fallbacks, scene gaps) stays on-brand dark. */
export const frennixNavigationTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.accent,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    notification: colors.accent,
  },
};
