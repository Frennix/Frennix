import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { getErrorMessage, getGroup, updateGroup } from "@frennix/api";
import { useAuth } from "@/providers/AuthProvider";
import { showAlert, showSuccess } from "@/lib/alerts";
import { ownershipMessages } from "@/lib/ownership/messages";
import { Button, Input, colors, spacing } from "@frennix/ui";

export default function EditGroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { data: group, isLoading } = useQuery({
    queryKey: ["group", id],
    queryFn: () => getGroup(id!),
    enabled: !!id,
  });

  useEffect(() => {
    if (!group) return;
    if (group.owner_id !== userId) {
      showAlert("Edit group", "Only the group owner can edit this group.");
      router.back();
      return;
    }
    setName(group.name);
    setDescription(group.description ?? "");
    setTags(group.sport_tags.join(", "));
  }, [group, userId]);

  async function save() {
    if (!id || !group || loading) return;
    if (!name.trim()) {
      setError("Group name is required");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await updateGroup(id, userId, {
        name: name.trim(),
        description: description.trim() || null,
        sport_tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      });
      await queryClient.invalidateQueries({ queryKey: ["group", id] });
      await queryClient.invalidateQueries({ queryKey: ["discover-groups"] });
      showSuccess(ownershipMessages.updated("Group"));
      router.back();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  if (isLoading) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Input label="Group name" value={name} onChangeText={setName} editable={!loading} />
      <Input
        label="Description"
        value={description}
        onChangeText={setDescription}
        multiline
        editable={!loading}
      />
      <Input
        label="Sport tags (comma-separated)"
        value={tags}
        onChangeText={setTags}
        editable={!loading}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title="Save changes" onPress={save} loading={loading} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md },
  error: { color: colors.danger },
});
