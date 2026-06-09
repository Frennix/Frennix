import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { createChallenge } from "@frennix/api";
import { useAuth } from "@/providers/AuthProvider";
import { Button, Input, colors, spacing } from "@frennix/ui";

export default function CreateChallengeScreen() {
  const { session } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [days, setDays] = useState("7");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!session?.user.id) return;
    setLoading(true);
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + parseInt(days, 10) || 7);
    try {
      const challenge = await createChallenge({
        title,
        description,
        start_date: start.toISOString(),
        end_date: end.toISOString(),
        created_by: session.user.id,
      });
      router.replace(`/challenge/${challenge.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create challenge");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Input label="Challenge title" value={title} onChangeText={setTitle} placeholder="30-day run streak" />
      <Input label="Description" value={description} onChangeText={setDescription} multiline />
      <Input label="Duration (days)" value={days} onChangeText={setDays} keyboardType="number-pad" />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title="Create challenge" onPress={submit} loading={loading} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md },
  error: { color: colors.danger },
});
