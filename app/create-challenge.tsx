import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { createChallenge, getErrorMessage } from "@frennix/api";
import { useAuth } from "@/providers/AuthProvider";
import { SubmitStatusBanner } from "@/components/SubmitStatusBanner";
import { useSuccessSubmit } from "@/lib/useSuccessSubmit";
import { Button, Input, colors, spacing } from "@frennix/ui";

export default function CreateChallengeScreen() {
  const { session } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [days, setDays] = useState("7");
  const [error, setError] = useState("");
  const { isLocked, isSubmitting, isSuccess, submitWithSuccess } = useSuccessSubmit();

  async function submit() {
    if (!session?.user.id || isLocked) return;
    if (!title.trim()) {
      setError("Challenge title is required");
      return;
    }

    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + parseInt(days, 10) || 7);

    setError("");
    try {
      await submitWithSuccess(
        () =>
          createChallenge({
            title: title.trim(),
            description: description.trim(),
            start_date: start.toISOString(),
            end_date: end.toISOString(),
            created_by: session.user.id,
          }),
        (challenge) => router.replace(`/challenge/${challenge.id}`)
      );
    } catch (e) {
      setError(getErrorMessage(e));
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Input
        label="Challenge title"
        value={title}
        onChangeText={setTitle}
        placeholder="30-day run streak"
        editable={!isLocked}
      />
      <Input
        label="Description"
        value={description}
        onChangeText={setDescription}
        multiline
        editable={!isLocked}
      />
      <Input
        label="Duration (days)"
        value={days}
        onChangeText={setDays}
        keyboardType="number-pad"
        editable={!isLocked}
      />

      <SubmitStatusBanner
        isSubmitting={isSubmitting}
        isSuccess={isSuccess}
        submittingLabel="Creating challenge…"
        successLabel="Challenge created! Opening your challenge…"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button
        title={isSuccess ? "Challenge created!" : "Create challenge"}
        loadingTitle="Creating…"
        onPress={submit}
        loading={isSubmitting}
        disabled={isLocked}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md },
  error: { color: colors.danger },
});
