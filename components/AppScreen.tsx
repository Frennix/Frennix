import type { ReactNode } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";

type AppScreenProps = {
  children: ReactNode;
  style?: ViewStyle;
  nativeID?: string;
};

/** Shared viewport-safe screen wrapper for every tab and stack surface. */
export function AppScreen({ children, style, nativeID = "screen-root" }: AppScreenProps) {
  return (
    <View style={[styles.screen, style]} nativeID={nativeID}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    alignSelf: "stretch",
    overflow: "hidden",
  },
});
