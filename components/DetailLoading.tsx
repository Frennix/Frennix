import { ActivityIndicator, StyleSheet, View } from "react-native";
import { colors } from "@frennix/ui";

export function DetailLoading() {
  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.accent} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
});
