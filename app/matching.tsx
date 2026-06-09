import { StyleSheet, Text, View } from "react-native";
import { EmptyState, colors } from "@frennix/ui";

export default function MatchingStubScreen() {
  return (
    <View style={styles.container}>
      <EmptyState
        title="Partner matching"
        description="Swipe to find training partners who share your goals. Coming in a future release — the data model is already in place."
      />
      <Text style={styles.note}>Enable matching_enabled on your profile when this launches.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  note: { textAlign: "center", color: colors.textMuted, padding: 24, fontSize: 13 },
});
