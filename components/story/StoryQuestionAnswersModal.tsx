import { FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import type { StoryQuestionAnswer } from "@frennix/types";
import { Avatar, colors, spacing, typography } from "@frennix/ui";

type StoryQuestionAnswersModalProps = {
  visible: boolean;
  answers: StoryQuestionAnswer[];
  loading?: boolean;
  onClose: () => void;
  onShareAnswer?: (answerId: string) => void;
};

export function StoryQuestionAnswersModal({
  visible,
  answers,
  loading,
  onClose,
  onShareAnswer,
}: StoryQuestionAnswersModalProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <Text style={styles.title}>Training answers</Text>
          <Text style={styles.subtitle}>Private until you share a response on your story.</Text>
          {loading ? (
            <Text style={styles.empty}>Loading…</Text>
          ) : answers.length ? (
            <FlatList
              data={answers}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.row}>
                  <Avatar
                    uri={item.profile?.avatar_url ?? null}
                    name={item.profile?.display_name ?? "Athlete"}
                    size={40}
                  />
                  <View style={styles.meta}>
                    <Text style={styles.name}>{item.profile?.display_name ?? "Athlete"}</Text>
                    <Text style={styles.answer}>{item.answer_text}</Text>
                    {item.shared_at ? (
                      <Text style={styles.shared}>Shared on story</Text>
                    ) : onShareAnswer ? (
                      <Pressable onPress={() => onShareAnswer(item.id)}>
                        <Text style={styles.shareCta}>Share response</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              )}
            />
          ) : (
            <Text style={styles.empty}>No answers yet.</Text>
          )}
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
  },
  sheet: {
    maxHeight: "70%",
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    ...typography.heading,
    color: colors.text,
    fontWeight: "800",
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  row: {
    flexDirection: "row",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  meta: { flex: 1, gap: 4 },
  name: {
    ...typography.body,
    color: colors.text,
    fontWeight: "700",
  },
  answer: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  shared: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: "700",
  },
  shareCta: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: "800",
  },
  empty: {
    ...typography.body,
    color: colors.textMuted,
    paddingVertical: spacing.lg,
  },
});
