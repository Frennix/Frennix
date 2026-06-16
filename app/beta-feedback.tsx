import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { getErrorMessage, submitFeedback } from "@frennix/api";
import type { FeedbackType } from "@frennix/types";
import { useAuth } from "@/providers/AuthProvider";
import { showAlert, showSuccess } from "@/lib/alerts";
import { Button, Input, colors, radius, spacing, typography } from "@frennix/ui";

type Tab = FeedbackType;

const TABS: { id: Tab; label: string }[] = [
  { id: "bug", label: "Report Bug" },
  { id: "feature", label: "Suggest Feature" },
  { id: "rating", label: "Rate Experience" },
];

function StarRating({
  value,
  onChange,
}: {
  value: number;
  onChange: (rating: number) => void;
}) {
  return (
    <View style={starStyles.row}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Pressable key={star} onPress={() => onChange(star)} hitSlop={8}>
          <Text style={[starStyles.star, star <= value && starStyles.starActive]}>
            {star <= value ? "★" : "☆"}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const starStyles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.sm, justifyContent: "center", paddingVertical: spacing.md },
  star: { fontSize: 36, color: colors.textMuted },
  starActive: { color: colors.accent },
});

export default function BetaFeedbackScreen() {
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const [tab, setTab] = useState<Tab>("bug");
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState(0);

  const submitMutation = useMutation({
    mutationFn: () => {
      if (tab === "rating") {
        return submitFeedback({ user_id: userId, type: "rating", rating, message });
      }
      return submitFeedback({ user_id: userId, type: tab, message });
    },
    onSuccess: () => {
      setMessage("");
      setRating(0);
      showSuccess("Thanks for your feedback!");
    },
    onError: (error) => showAlert("Could not submit", getErrorMessage(error)),
  });

  function handleSubmit() {
    if (!userId) {
      showAlert("Sign in required", "Sign in to send feedback.");
      return;
    }
    submitMutation.mutate();
  }

  const canSubmit =
    tab === "rating" ? rating >= 1 : message.trim().length > 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.intro}>
        Help us improve Frennix during beta. Your feedback goes directly to the team.
      </Text>

      <View style={styles.tabs}>
        {TABS.map((item) => (
          <Pressable
            key={item.id}
            style={[styles.tab, tab === item.id && styles.tabActive]}
            onPress={() => setTab(item.id)}
          >
            <Text style={[styles.tabText, tab === item.id && styles.tabTextActive]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.form}>
        {tab === "bug" ? (
          <>
            <Text style={styles.label}>What went wrong?</Text>
            <Input
              value={message}
              onChangeText={setMessage}
              placeholder="Describe the bug, what you expected, and steps to reproduce…"
              multiline
              numberOfLines={5}
            />
          </>
        ) : null}

        {tab === "feature" ? (
          <>
            <Text style={styles.label}>What would you like to see?</Text>
            <Input
              value={message}
              onChangeText={setMessage}
              placeholder="Describe the feature and how it would help your training…"
              multiline
              numberOfLines={5}
            />
          </>
        ) : null}

        {tab === "rating" ? (
          <>
            <Text style={styles.label}>How is your Frennix experience?</Text>
            <StarRating value={rating} onChange={setRating} />
            <Text style={styles.optionalLabel}>Additional comments (optional)</Text>
            <Input
              value={message}
              onChangeText={setMessage}
              placeholder="Tell us what you love or what we could do better…"
              multiline
              numberOfLines={4}
            />
          </>
        ) : null}

        <Button
          title="Submit feedback"
          onPress={handleSubmit}
          loading={submitMutation.isPending}
          disabled={!canSubmit}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg },
  intro: { ...typography.body, color: colors.textSecondary, lineHeight: 24 },
  tabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tabActive: {
    borderColor: colors.accent,
    backgroundColor: colors.surfaceElevated,
  },
  tabText: { ...typography.bodySmall, color: colors.textSecondary, fontWeight: "600" },
  tabTextActive: { color: colors.accent },
  form: { gap: spacing.md },
  label: { ...typography.body, fontWeight: "600", color: colors.text },
  optionalLabel: { ...typography.caption, color: colors.textMuted },
});
