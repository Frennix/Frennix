import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { createGroup } from "@frennix/api";
import { useAuth } from "@/providers/AuthProvider";
import { Button, Input, colors, spacing } from "@frennix/ui";

export default function CreateGroupScreen() {
  const { session } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!session?.user.id) return;
    setLoading(true);
    try {
      const group = await createGroup({
        name,
        description,
        sport_tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        owner_id: session.user.id,
      });
      router.replace(`/group/${group.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create group");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Input label="Group name" value={name} onChangeText={setName} placeholder="Marathon Training NYC" />
      <Input label="Description" value={description} onChangeText={setDescription} multiline />
      <Input label="Sport tags (comma-separated)" value={tags} onChangeText={setTags} placeholder="running, marathon" />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title="Create group" onPress={submit} loading={loading} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md },
  error: { color: colors.danger },
});
