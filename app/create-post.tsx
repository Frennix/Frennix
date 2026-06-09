import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ACTIVITIES } from "@frennix/types";
import { createPost, uploadPostMedia } from "@frennix/api";
import type { PostType } from "@frennix/types";
import { useAuth } from "@/providers/AuthProvider";
import { formatActivity } from "@/lib/labels";
import { Button, Input, colors, spacing, typography } from "@frennix/ui";

export default function CreatePostScreen() {
  const { session } = useAuth();
  const [content, setContent] = useState("");
  const [workoutType, setWorkoutType] = useState<string | null>(null);
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState("image/jpeg");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function pickMedia() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      quality: 0.8,
      videoMaxDuration: 60,
    });
    if (!result.canceled) {
      setMediaUri(result.assets[0].uri);
      setMimeType(result.assets[0].mimeType ?? "image/jpeg");
    }
  }

  async function submit() {
    if (!session?.user.id) return;
    if (!content && !mediaUri && !workoutType) {
      setError("Add a caption, workout type, or photo/video");
      return;
    }
    setLoading(true);
    setError("");
    try {
      let mediaUrls: string[] = [];
      let postType: PostType = "text";

      if (mediaUri) {
        const url = await uploadPostMedia(session.user.id, mediaUri, mimeType);
        mediaUrls = [url];
        postType = mimeType.startsWith("video") ? "video" : "photo";
      } else if (workoutType || content) {
        postType = "workout_update";
      }

      await createPost({
        author_id: session.user.id,
        content: content || undefined,
        media_urls: mediaUrls,
        post_type: postType,
        workout_type: workoutType,
      });

      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to post");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Workout type</Text>
      <View style={styles.chips}>
        {ACTIVITIES.map((activity) => (
          <Pressable
            key={activity}
            style={[styles.chip, workoutType === activity && styles.chipActive]}
            onPress={() => setWorkoutType(workoutType === activity ? null : activity)}
          >
            <Text style={[styles.chipText, workoutType === activity && styles.chipTextActive]}>
              {formatActivity(activity)}
            </Text>
          </Pressable>
        ))}
      </View>

      <Input
        label="What did you accomplish?"
        value={content}
        onChangeText={setContent}
        multiline
        placeholder="Crushed leg day, hit a PR, finished a 5K..."
      />
      {mediaUri ? <Image source={{ uri: mediaUri }} style={styles.preview} /> : null}
      <Button title="Add photo or video" variant="secondary" onPress={pickMedia} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title="Share workout" onPress={submit} loading={loading} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md },
  label: { ...typography.body, fontWeight: "600" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.accentMuted, borderColor: colors.accent },
  chipText: { ...typography.bodySmall, color: colors.textSecondary },
  chipTextActive: { color: colors.accent, fontWeight: "600" },
  preview: { width: "100%", height: 200, borderRadius: 12 },
  error: { color: colors.danger },
});
