import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { createGroup, getErrorMessage } from "@frennix/api";
import { useAuth } from "@/providers/AuthProvider";
import { SubmitStatusBanner } from "@/components/SubmitStatusBanner";
import { useSuccessSubmit } from "@/lib/useSuccessSubmit";
import { Button, Input, colors, spacing } from "@frennix/ui";

export default function CreateGroupScreen() {
  const { session } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [error, setError] = useState("");
  const { isLocked, isSubmitting, isSuccess, submitWithSuccess } = useSuccessSubmit();

  async function submit() {
    if (!session?.user.id || isLocked) return;
    if (!name.trim()) {
      setError("Group name is required");
      return;
    }

    setError("");
    try {
      await submitWithSuccess(
        () =>
          createGroup({
            name: name.trim(),
            description: description.trim(),
            sport_tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
            owner_id: session.user.id,
          }),
        (group) => router.replace(`/group/${group.id}`)
      );
    } catch (e) {
      setError(getErrorMessage(e));
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Input
        label="Group name"
        value={name}
        onChangeText={setName}
        placeholder="Marathon Training NYC"
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
        label="Sport tags (comma-separated)"
        value={tags}
        onChangeText={setTags}
        placeholder="running, marathon"
        editable={!isLocked}
      />

      <SubmitStatusBanner
        isSubmitting={isSubmitting}
        isSuccess={isSuccess}
        submittingLabel="Creating group…"
        successLabel="Group created! Opening your group…"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button
        title={isSuccess ? "Group created!" : "Create group"}
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
