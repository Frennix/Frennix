import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { StoryQuestion } from "@frennix/types";
import { colors, overlays, spacing, typography } from "@frennix/ui";

type StoryQuestionCardProps = {
  question: StoryQuestion;
  isOwner?: boolean;
  disabled?: boolean;
  onSubmitAnswer?: (answer: string) => void | Promise<void>;
};

export function StoryQuestionCard({
  question,
  isOwner,
  disabled,
  onSubmitAnswer,
}: StoryQuestionCardProps) {
  const [answer, setAnswer] = useState(question.my_answer ?? "");
  const [submitting, setSubmitting] = useState(false);

  if (isOwner) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.label}>Training question</Text>
        <Text style={styles.question}>{question.question}</Text>
        <Text style={styles.meta}>
          {question.answer_count ?? 0} private {(question.answer_count ?? 0) === 1 ? "answer" : "answers"}
        </Text>
      </View>
    );
  }

  if (question.my_answer) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.label}>Your answer sent privately</Text>
        <Text style={styles.question}>{question.question}</Text>
        <Text style={styles.answerPreview}>{question.my_answer}</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.question}>{question.question}</Text>
      <TextInput
        style={styles.input}
        value={answer}
        onChangeText={setAnswer}
        placeholder="Answer privately…"
        placeholderTextColor={overlays.whiteFaint}
        editable={!disabled && !submitting}
        multiline
      />
      <Pressable
        style={styles.cta}
        disabled={disabled || submitting || !answer.trim()}
        onPress={async () => {
          if (!onSubmitAnswer) return;
          setSubmitting(true);
          try {
            await onSubmitAnswer(answer.trim());
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <Text style={styles.ctaText}>Send answer</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 14,
    backgroundColor: overlays.glassMedium,
    borderWidth: 1,
    borderColor: overlays.glassBorderStrong,
  },
  label: {
    ...typography.caption,
    color: overlays.whiteSoft,
    fontWeight: "700",
  },
  question: {
    ...typography.body,
    color: colors.white,
    fontWeight: "800",
  },
  meta: {
    ...typography.caption,
    color: overlays.whiteFaint,
  },
  answerPreview: {
    ...typography.bodySmall,
    color: overlays.whiteSoft,
  },
  input: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: overlays.glassBorder,
    backgroundColor: overlays.glass,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    color: colors.white,
    ...typography.bodySmall,
  },
  cta: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.accent,
  },
  ctaText: {
    ...typography.caption,
    color: colors.black,
    fontWeight: "800",
  },
});
