import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { REACTION_EMOJIS } from "@frennix/types";
import { colors, radius, spacing, typography } from "./theme";

interface ReactionPickerProps {
  visible: boolean;
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export function ReactionPicker({ visible, onSelect, onClose }: ReactionPickerProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <Text style={styles.title}>React</Text>
          <View style={styles.row}>
            {REACTION_EMOJIS.map((emoji) => (
              <Pressable
                key={emoji}
                style={styles.emojiButton}
                onPress={() => onSelect(emoji)}
                accessibilityRole="button"
                accessibilityLabel={`React with ${emoji}`}
              >
                <Text style={styles.emoji}>{emoji}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
    padding: spacing.lg,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: { ...typography.body, fontWeight: "700", textAlign: "center" },
  row: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    gap: spacing.sm,
  },
  emojiButton: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceElevated,
  },
  emoji: { fontSize: 28, lineHeight: 32 },
});
