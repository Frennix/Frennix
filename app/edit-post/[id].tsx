import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Video, ResizeMode } from "expo-av";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ACTIVITIES } from "@frennix/types";
import {
  getErrorMessage,
  getPost,
  isVideoMime,
  updatePost,
  uploadPostMedia,
  withTimeout,
  THUMBNAIL_CAPTURE_TIMEOUT_MS,
} from "@frennix/api";
import type { PostType } from "@frennix/types";
import { useAuth } from "@/providers/AuthProvider";
import { formatActivity } from "@/lib/labels";
import { showAlert, showSuccess } from "@/lib/alerts";
import { generateAndUploadVideoThumbnail } from "@/lib/video-thumbnail";
import { resolveVideoUploadFile } from "@/lib/video-upload";
import {
  formatVideoDuration,
  getVideoDurationSeconds,
  isVideoTooLong,
  VIDEO_TOO_LONG_MESSAGE,
} from "@/lib/media-duration";
import { requestPhotoAdjustment } from "@/lib/photo-adjustment-flow";
import { stackBackOptions } from "@/lib/stack-navigation";
import { invalidatePostQueries, updatePostInAllCaches } from "@/lib/post-cache";
import { Button, Input, colors, radius, spacing, typography } from "@frennix/ui";

const CAPTION_MAX = 500;
const MAX_PHOTOS = 10;

type EditMediaItem = {
  uri: string;
  mimeType: string;
  file?: File;
  durationSeconds?: number | null;
  isRemote: boolean;
};

function isRemoteUri(uri: string) {
  return uri.startsWith("http://") || uri.startsWith("https://");
}

function mimeFromAsset(asset: ImagePicker.ImagePickerAsset): string {
  if (asset.mimeType) return asset.mimeType;
  if (asset.type === "video") return "video/mp4";
  return "image/jpeg";
}

function mediaItemsFromPost(post: { media_urls?: string[] | null; post_type: PostType }) {
  const urls = post.media_urls ?? [];
  if (!urls.length) return [];

  const isVideo = post.post_type === "video";
  return urls.map((uri, index) => ({
    uri,
    mimeType: isVideo && index === 0 ? "video/mp4" : "image/jpeg",
    durationSeconds: null,
    isRemote: true,
  }));
}

export default function EditPostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const queryClient = useQueryClient();
  const originalMediaRef = useRef<string[]>([]);
  const originalThumbnailRef = useRef<string | null>(null);

  const [content, setContent] = useState("");
  const [workoutType, setWorkoutType] = useState<string | null>(null);
  const [mediaItems, setMediaItems] = useState<EditMediaItem[]>([]);
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
      showAlert("Edit post", "You can only edit your own posts.");
      router.back();
      return;
    }
    setContent(post.content ?? "");
    setWorkoutType(post.workout_type ?? null);
    setMediaItems(mediaItemsFromPost(post));
    originalMediaRef.current = post.media_urls ?? [];
    originalThumbnailRef.current = post.thumbnail_url ?? null;
  }, [post, userId]);

  const hasVideo = mediaItems.some((item) => isVideoMime(item.mimeType));
  const hasPhotos = mediaItems.some((item) => !isVideoMime(item.mimeType));
  const isFormLocked = loading;

  async function pickMedia() {
    if (isFormLocked) return;
    setError("");

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      const message = "Photo library access is required to add photos or videos";
      setError(message);
      showAlert("Media access", message);
      return;
    }

    const pickingVideo = mediaItems.length === 0 || hasVideo;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: pickingVideo ? ImagePicker.MediaTypeOptions.All : ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      allowsMultipleSelection: !pickingVideo,
      selectionLimit: pickingVideo ? 1 : MAX_PHOTOS - mediaItems.length,
      quality: 0.8,
      videoMaxDuration: 60,
    });

    if (result.canceled) return;

    const videoAssets = result.assets.filter((asset) => isVideoMime(mimeFromAsset(asset)));
    const photoAssets = result.assets.filter((asset) => !isVideoMime(mimeFromAsset(asset)));

    if (videoAssets.length > 0) {
      const asset = videoAssets[0];
      const mime = mimeFromAsset(asset);
      const pickedFile = "file" in asset ? asset.file ?? undefined : undefined;
      const file = await resolveVideoUploadFile(asset.uri, mime, pickedFile);
      const durationSeconds = await getVideoDurationSeconds(asset, mime);
      if (isVideoTooLong(durationSeconds)) {
        showAlert("Video too long", VIDEO_TOO_LONG_MESSAGE);
        return;
      }
      setMediaItems([{ uri: asset.uri, mimeType: mime, file, durationSeconds, isRemote: false }]);
      return;
    }

    if (!photoAssets.length) return;

    const adjustedPhotos: EditMediaItem[] = [];
    for (const asset of photoAssets) {
      const mime = mimeFromAsset(asset);
      const file = "file" in asset ? asset.file ?? undefined : undefined;
      const adjusted = await requestPhotoAdjustment({ uri: asset.uri, mimeType: mime });
      if (!adjusted) return;
      adjustedPhotos.push({
        uri: adjusted.uri,
        mimeType: adjusted.mimeType,
        file: adjusted.file ?? file,
        durationSeconds: null,
        isRemote: false,
      });
    }

    const merged = [...mediaItems.filter((item) => !isVideoMime(item.mimeType)), ...adjustedPhotos].slice(
      0,
      MAX_PHOTOS
    );
    setMediaItems(merged);
  }

  function removeMediaAt(index: number) {
    if (isFormLocked) return;
    setError("");
    setMediaItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function moveMedia(index: number, direction: -1 | 1) {
    if (isFormLocked) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= mediaItems.length) return;
    setMediaItems((current) => {
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(targetIndex, 0, item);
      return next;
    });
  }

  function handleClearMedia() {
    if (isFormLocked) return;
    setError("");
    setMediaItems([]);
  }

  async function submit() {
    if (!id || !userId || !post) return;
    if (!content.trim() && !workoutType && !mediaItems.length) {
      setError("Add a caption, workout type, or media");
      return;
    }
    if (hasVideo && mediaItems.some((item) => isVideoTooLong(item.durationSeconds ?? null))) {
      showAlert("Video too long", VIDEO_TOO_LONG_MESSAGE);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const finalMediaUrls: string[] = [];
      for (const item of mediaItems) {
        if (item.isRemote && isRemoteUri(item.uri)) {
          finalMediaUrls.push(item.uri);
          continue;
        }
        const url = await uploadPostMedia(userId, item.uri, item.mimeType, item.file);
        finalMediaUrls.push(url);
      }

      let thumbnailUrl: string | null = post.thumbnail_url ?? null;
      let postType: PostType = "text";

      if (mediaItems.length) {
        if (hasVideo) {
          postType = "video";
          const video = mediaItems[0];
          const videoChanged = !video.isRemote;
          if (videoChanged) {
            try {
              thumbnailUrl = await withTimeout(
                generateAndUploadVideoThumbnail(userId, video.uri, video.mimeType, video.file),
                THUMBNAIL_CAPTURE_TIMEOUT_MS + 30_000,
                "Video thumbnail upload"
              );
            } catch {
              thumbnailUrl = null;
            }
          }
        } else {
          postType = "photo";
          if (!hasVideo) thumbnailUrl = null;
        }
      } else if (workoutType || content.trim()) {
        postType = "workout_update";
        thumbnailUrl = null;
      }

      const removedMediaUrls = originalMediaRef.current.filter((url) => !finalMediaUrls.includes(url));
      const thumbnailRemoved =
        originalThumbnailRef.current &&
        originalThumbnailRef.current !== thumbnailUrl &&
        !finalMediaUrls.includes(originalThumbnailRef.current)
          ? originalThumbnailRef.current
          : null;

      const updated = await updatePost(
        id,
        userId,
        {
          content: content.trim() || null,
          workout_type: workoutType,
          media_urls: finalMediaUrls,
          thumbnail_url: thumbnailUrl,
          post_type: postType,
        },
        { removedMediaUrls, removedThumbnailUrl: thumbnailRemoved }
      );

      updatePostInAllCaches(queryClient, userId, { ...post, ...updated });
      await invalidatePostQueries(queryClient, userId, id);
      showSuccess("Workout updated successfully.");
      router.back();
    } catch (e) {
      const message = getErrorMessage(e) || "Something went wrong. Please try again.";
      setError(message);
      showAlert("Update failed", message);
    } finally {
      setLoading(false);
    }
  }

  if (isLoading || !post) {
    return (
      <>
        <Stack.Screen options={stackBackOptions("Edit workout", { presentation: "modal" })} />
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={stackBackOptions("Edit workout", { presentation: "modal" })} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.sectionLabel}>Workout type</Text>
        <View style={styles.chips}>
          {ACTIVITIES.map((activity) => (
            <Pressable
              key={activity}
              style={[styles.chip, workoutType === activity && styles.chipActive]}
              onPress={() => setWorkoutType(workoutType === activity ? null : activity)}
              disabled={isFormLocked}
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
            editable={!isFormLocked}
            placeholder="Update your workout caption..."
          />
          <Text style={styles.charCount}>
            {content.length}/{CAPTION_MAX}
          </Text>
        </View>

        {mediaItems.length ? (
          <View style={styles.mediaSection}>
            <Text style={styles.sectionLabel}>Media</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mediaRow}>
              {mediaItems.map((item, index) => {
                const itemIsVideo = isVideoMime(item.mimeType);
                return (
                  <View key={`${item.uri}-${index}`} style={styles.previewWrapper}>
                    {itemIsVideo ? (
                      <Video
                        source={{ uri: item.uri }}
                        style={styles.preview}
                        useNativeControls
                        resizeMode={ResizeMode.CONTAIN}
                        isLooping={false}
                      />
                    ) : (
                      <Image source={{ uri: item.uri }} style={styles.preview} resizeMode="cover" />
                    )}

                    <Pressable
                      style={styles.previewClose}
                      onPress={() => removeMediaAt(index)}
                      disabled={isFormLocked}
                      accessibilityRole="button"
                      accessibilityLabel="Remove media"
                    >
                      <Text style={styles.previewCloseText}>✕</Text>
                    </Pressable>

                    {!itemIsVideo && mediaItems.length > 1 ? (
                      <View style={styles.reorderControls}>
                        <Pressable
                          style={[styles.reorderButton, index === 0 && styles.reorderDisabled]}
                          onPress={() => moveMedia(index, -1)}
                          disabled={isFormLocked || index === 0}
                        >
                          <Text style={styles.reorderText}>←</Text>
                        </Pressable>
                        <Pressable
                          style={[
                            styles.reorderButton,
                            index === mediaItems.length - 1 && styles.reorderDisabled,
                          ]}
                          onPress={() => moveMedia(index, 1)}
                          disabled={isFormLocked || index === mediaItems.length - 1}
                        >
                          <Text style={styles.reorderText}>→</Text>
                        </Pressable>
                      </View>
                    ) : null}

                    <View style={styles.typeBadge}>
                      <Text style={styles.typeBadgeText}>
                        {itemIsVideo ? "Video" : `Photo ${index + 1}`}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            <Text style={styles.mediaHint}>
              {hasVideo && mediaItems[0]?.durationSeconds != null
                ? `Video · ${formatVideoDuration(mediaItems[0].durationSeconds)}`
                : hasPhotos
                  ? `${mediaItems.length} photo${mediaItems.length === 1 ? "" : "s"}`
                  : "Media selected"}
            </Text>

            {!hasVideo && mediaItems.length < MAX_PHOTOS ? (
              <Button
                title="Add more photos"
                variant="secondary"
                onPress={pickMedia}
                disabled={isFormLocked}
              />
            ) : null}
            <Button
              title={hasVideo ? "Replace video" : "Replace photos"}
              variant="secondary"
              onPress={pickMedia}
              disabled={isFormLocked}
            />
            <Button
              title="Remove all media"
              variant="danger"
              onPress={handleClearMedia}
              disabled={isFormLocked}
            />
          </View>
        ) : (
          <View style={styles.addMediaBlock}>
            <Button
              title="Add photos or video"
              variant="secondary"
              onPress={pickMedia}
              disabled={isFormLocked}
            />
            <Text style={styles.mediaHelper}>
              Add up to {MAX_PHOTOS} photos or one workout video up to 60 seconds.
            </Text>
          </View>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button title="Save changes" onPress={submit} loading={loading} disabled={isFormLocked} />
      </ScrollView>
    </>
  );
}

const PREVIEW_SIZE = 160;

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
  mediaRow: { gap: spacing.sm, paddingVertical: spacing.xs },
  previewWrapper: {
    width: PREVIEW_SIZE,
    height: PREVIEW_SIZE,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.surface,
    position: "relative",
  },
  preview: { width: "100%", height: "100%" },
  previewClose: {
    position: "absolute",
    top: spacing.xs,
    right: spacing.xs,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  previewCloseText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  reorderControls: {
    position: "absolute",
    bottom: spacing.xs,
    left: spacing.xs,
    flexDirection: "row",
    gap: 4,
  },
  reorderButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  reorderDisabled: { opacity: 0.35 },
  reorderText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  typeBadge: {
    position: "absolute",
    bottom: spacing.xs,
    right: spacing.xs,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  typeBadgeText: { ...typography.caption, color: "#fff", fontWeight: "600" },
  mediaHint: { ...typography.caption, color: colors.textMuted },
  addMediaBlock: { gap: spacing.sm },
  mediaHelper: { ...typography.caption, color: colors.textMuted },
  error: { ...typography.bodySmall, color: colors.danger },
});
