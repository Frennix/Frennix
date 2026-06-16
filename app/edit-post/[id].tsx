import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ACTIVITIES } from "@frennix/types";
import { getErrorMessage, getPost, updatePost } from "@frennix/api";
import { useAuth } from "@/providers/AuthProvider";
import { formatActivity } from "@/lib/labels";
import { showAlert, showSuccess } from "@/lib/alerts";
import { Button, Input, PostMedia, colors, radius, spacing, typography } from "@frennix/ui";

const CAPTION_MAX = 500;

export default function EditPostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const queryClient = useQueryClient();

  const [content, setContent] = useState("");
  const [workoutType, setWorkoutType] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { data: post, isLoading } = useQuery({
    queryKey: ["post", id, userId],
    queryFn: () => getPost(id!, userId),
    enabled: !!id && !!userId,
  });

  useEffect(() => {
    if (!post) return;
    if (post.author_id !== userId) {
      showAlert("Edit post", "You can only edit your own posts");
      router.back();
      return;
    }
    setContent(post.content ?? "");
    setWorkoutType(post.workout_type ?? null);
  }, [post, userId]);

  async function submit() {
    if (!id || !userId) return;
    if (!content.trim() && !workoutType && !post?.media_urls?.[0]) {
      setError("Add a caption or workout type");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await updatePost(id, userId, {
        content: content.trim() || null,
        workout_type: workoutType,
      });
      await queryClient.invalidateQueries({ queryKey: ["feed", userId] });
      await queryClient.invalidateQueries({ queryKey: ["post", id] });
      await queryClient.invalidateQueries({ queryKey: ["user-posts"] });
      await queryClient.invalidateQueries({ queryKey: ["group-posts"] });
      showSuccess("Post updated");
      router.back();
    } catch (e) {
      const message = getErrorMessage(e);
      setError(message);
      showAlert("Update failed", message);
    } finally {
      setLoading(false);
    }
  }

  if (isLoading || !post) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionLabel}>Workout type</Text>
      <View style={styles.chips}>
        {ACTIVITIES.map((activity) => (
          <Pressable
            key={activity}
            style={[styles.chip, workoutType === activity && styles.chipActive]}
            onPress={() => setWorkoutType(workoutType === activity ? null : activity)}
            disabled={loading}
          >
            <Text style={[styles.chipText, workoutType === activity && styles.chipTextActive]}>
              {formatActivity(activity)}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.captionBlock}>
        <Input
          label="Caption"
          value={content}
          onChangeText={setContent}
          multiline
          maxLength={CAPTION_MAX}
          editable={!loading}
          placeholder="Update your workout caption..."
        />
        <Text style={styles.charCount}>
          {content.length}/{CAPTION_MAX}
        </Text>
      </View>

      {post.media_urls?.[0] ? (
        <View style={styles.mediaSection}>
          <Text style={styles.sectionLabel}>Media</Text>
          <PostMedia
            uri={post.media_urls[0]}
            postType={post.post_type}
            thumbnailUrl={post.thumbnail_url}
          />
          <Text style={styles.mediaHint}>Media cannot be changed when editing.</Text>
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button title="Save changes" onPress={submit} loading={loading} disabled={loading} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  sectionLabel: { ...typography.body, fontWeight: "600", color: colors.text },
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
  captionBlock: { gap: spacing.xs },
  charCount: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: "right",
  },
  mediaSection: { gap: spacing.sm },
  mediaHint: { ...typography.caption, color: colors.textMuted },
  error: { ...typography.bodySmall, color: colors.danger },
});
