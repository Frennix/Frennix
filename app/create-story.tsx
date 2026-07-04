import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Video, ResizeMode } from "expo-av";
import * as ImagePicker from "expo-image-picker";
import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  STORY_LOCATION_TYPES,
  STORY_PRIVACY_OPTIONS,
  STORY_WORKOUT_TAGS,
  type StoryLocationType,
  type StoryPrivacy,
  type StorySlideDraft,
} from "@frennix/types";
import {
  getErrorMessage,
  isVideoMime,
  publishStory,
  uploadStoryMedia,
  withTimeout,
  POST_CREATE_TIMEOUT_MS,
} from "@frennix/api";
import { resolveVideoUploadFile } from "@/lib/video-upload";
import {
  formatVideoDuration,
  getVideoDurationSeconds,
  isVideoTooLong,
  VIDEO_TOO_LONG_MESSAGE,
} from "@/lib/media-duration";
import { showAlert } from "@/lib/alerts";
import { requestPhotoAdjustment } from "@/lib/photo-adjustment-flow";
import { ReorderablePhotoStrip } from "@/components/ReorderablePhotoStrip";
import { useAuth } from "@/providers/AuthProvider";
import { Button, Input, colors, radius, spacing, typography } from "@frennix/ui";

const MAX_SLIDES = 10;
const CAPTION_MAX = 280;

function mimeFromAsset(asset: ImagePicker.ImagePickerAsset): string {
  if (asset.mimeType) return asset.mimeType;
  if (asset.type === "video") return "video/mp4";
  return "image/jpeg";
}

function newDraftId() {
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function CreateStoryScreen() {
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const queryClient = useQueryClient();
  const submittingRef = useRef(false);

  const [slides, setSlides] = useState<StorySlideDraft[]>([]);
  const [privacy, setPrivacy] = useState<StoryPrivacy>("followers");
  const [workoutTag, setWorkoutTag] = useState<string | null>(null);
  const [locationName, setLocationName] = useState("");
  const [locationType, setLocationType] = useState<StoryLocationType | null>(null);
  const [caption, setCaption] = useState("");
  const [previewMode, setPreviewMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const hasVideo = slides.some((slide) => isVideoMime(slide.mimeType));
  const previewSlide = slides[0] ?? null;

  async function pickMedia() {
    if (loading) return;
    setError("");

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      const message = "Photo library access is required to add story media";
      setError(message);
      showAlert("Media access", message);
      return;
    }

    const pickingVideo = slides.length === 0 || hasVideo;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: pickingVideo ? ImagePicker.MediaTypeOptions.All : ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      allowsMultipleSelection: !pickingVideo,
      selectionLimit: pickingVideo ? 1 : MAX_SLIDES - slides.length,
      quality: 0.85,
      videoMaxDuration: 60,
    });

    if (result.canceled) return;

    const videoAssets = result.assets.filter((asset) => isVideoMime(mimeFromAsset(asset)));
    const photoAssets = result.assets.filter((asset) => !isVideoMime(mimeFromAsset(asset)));

    if (videoAssets.length) {
      const asset = videoAssets[0];
      const mime = mimeFromAsset(asset);
      const file = "file" in asset ? asset.file ?? undefined : undefined;
      const resolved = await resolveVideoUploadFile(asset.uri, mime, file);
      const durationSeconds = await getVideoDurationSeconds(asset, mime);
      if (isVideoTooLong(durationSeconds)) {
        showAlert("Video too long", VIDEO_TOO_LONG_MESSAGE);
        return;
      }
      setSlides([
        {
          localId: newDraftId(),
          uri: asset.uri,
          mimeType: mime,
          file: resolved,
          durationSeconds,
        },
      ]);
      return;
    }

    const nextSlides: StorySlideDraft[] = [];
    for (const asset of photoAssets) {
      const mime = mimeFromAsset(asset);
      const file = "file" in asset ? asset.file ?? undefined : undefined;
      const adjusted = await requestPhotoAdjustment({ uri: asset.uri, mimeType: mime });
      if (!adjusted) return;
      nextSlides.push({
        localId: newDraftId(),
        uri: adjusted.uri,
        mimeType: adjusted.mimeType,
        file: adjusted.file ?? file,
      });
    }

    setSlides((current) => [...current.filter((item) => !isVideoMime(item.mimeType)), ...nextSlides].slice(0, MAX_SLIDES));
  }

  function reorderSlides(fromIndex: number, toIndex: number) {
    if (loading || fromIndex === toIndex) return;
    setSlides((current) => {
      const next = [...current];
      const [item] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, item);
      return next;
    });
  }

  function removeSlideAt(index: number) {
    if (loading) return;
    setSlides((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  const captionForPublish = useMemo(() => caption.trim().slice(0, CAPTION_MAX), [caption]);

  async function publish() {
    if (submittingRef.current || loading) return;
    if (!userId) {
      showAlert("Create story", "You must be signed in");
      return;
    }
    if (!slides.length) {
      setError("Add at least one photo or video");
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    setError("");

    try {
      const uploadedSlides = [];
      for (let index = 0; index < slides.length; index += 1) {
        const slide = slides[index];
        const mediaUrl = await uploadStoryMedia(userId, slide.uri, slide.mimeType, slide.file);
        uploadedSlides.push({
          media_url: mediaUrl,
          media_type: isVideoMime(slide.mimeType) ? ("video" as const) : ("photo" as const),
          caption: index === 0 ? captionForPublish || null : null,
          workout_type: workoutTag,
          sort_order: index,
        });
      }

      await withTimeout(
        publishStory({
          user_id: userId,
          privacy,
          workout_tag: workoutTag,
          location_name: locationName.trim() || null,
          location_type: locationType,
          slides: uploadedSlides,
        }),
        POST_CREATE_TIMEOUT_MS,
        "Publishing story"
      );

      await queryClient.invalidateQueries({ queryKey: ["feed-stories", userId] });
      router.back();
    } catch (publishError) {
      setError(getErrorMessage(publishError));
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.lead}>
          Stories disappear after 24 hours. Add slides, rearrange, preview, then publish.
        </Text>

        {previewMode && previewSlide ? (
          <View style={styles.previewCard}>
            {isVideoMime(previewSlide.mimeType) ? (
              <Video
                source={{ uri: previewSlide.uri }}
                style={styles.previewMedia}
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay
                isLooping
                useNativeControls
              />
            ) : (
              <View style={styles.previewMedia}>
                <Text style={styles.previewPlaceholder}>Photo preview</Text>
              </View>
            )}
            {captionForPublish ? <Text style={styles.previewCaption}>{captionForPublish}</Text> : null}
          </View>
        ) : (
          <>
            <Pressable style={styles.mediaPicker} onPress={pickMedia} disabled={loading}>
              <Text style={styles.mediaPickerTitle}>
                {slides.length ? "Add or replace media" : "Upload photos or video"}
              </Text>
              <Text style={styles.mediaPickerHint}>Up to {MAX_SLIDES} slides · 60s video max</Text>
            </Pressable>

            {slides.length ? (
              <ReorderablePhotoStrip
                items={slides.map((slide) => slide.uri)}
                onReorder={reorderSlides}
                onRemove={removeSlideAt}
              />
            ) : null}
          </>
        )}

        <Input
          label="Caption (optional)"
          value={caption}
          onChangeText={setCaption}
          maxLength={CAPTION_MAX}
          placeholder="Great workout with @sarah"
          editable={!loading}
        />

        <Text style={styles.sectionLabel}>Privacy</Text>
        <View style={styles.chipRow}>
          {STORY_PRIVACY_OPTIONS.map((option) => (
            <Pressable
              key={option.value}
              style={[styles.chip, privacy === option.value && styles.chipActive]}
              onPress={() => setPrivacy(option.value)}
            >
              <Text style={[styles.chipText, privacy === option.value && styles.chipTextActive]}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Workout tag</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {STORY_WORKOUT_TAGS.map((tag) => (
            <Pressable
              key={tag}
              style={[styles.chip, workoutTag === tag && styles.chipActive]}
              onPress={() => setWorkoutTag((current) => (current === tag ? null : tag))}
            >
              <Text style={[styles.chipText, workoutTag === tag && styles.chipTextActive]}>{tag}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Input
          label="Location (optional)"
          value={locationName}
          onChangeText={setLocationName}
          placeholder="Portland Waterfront"
          editable={!loading}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {STORY_LOCATION_TYPES.map((option) => (
            <Pressable
              key={option.value}
              style={[styles.chip, locationType === option.value && styles.chipActive]}
              onPress={() =>
                setLocationType((current) => (current === option.value ? null : option.value))
              }
            >
              <Text style={[styles.chipText, locationType === option.value && styles.chipTextActive]}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.actions}>
          <Button
            variant="secondary"
            label={previewMode ? "Edit slides" : "Preview"}
            onPress={() => setPreviewMode((current) => !current)}
            disabled={!slides.length || loading}
          />
          <Button
            label={loading ? "Publishing…" : "Publish Story"}
            onPress={publish}
            disabled={loading || !slides.length}
          />
        </View>

        {loading ? <ActivityIndicator color={colors.accent} /> : null}
      </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  lead: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  mediaPicker: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.xs,
    backgroundColor: colors.surface,
  },
  mediaPickerTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: "700",
  },
  mediaPickerHint: {
    ...typography.caption,
    color: colors.textMuted,
  },
  sectionLabel: {
    ...typography.bodySmall,
    color: colors.textMuted,
    fontWeight: "700",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
  },
  chipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  chipText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: "600",
  },
  chipTextActive: {
    color: colors.accent,
    fontWeight: "800",
  },
  previewCard: {
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.black,
    minHeight: 320,
    gap: spacing.sm,
    padding: spacing.md,
  },
  previewMedia: {
    width: "100%",
    height: 280,
    alignItems: "center",
    justifyContent: "center",
  },
  previewPlaceholder: {
    ...typography.body,
    color: colors.textMuted,
  },
  previewCaption: {
    ...typography.body,
    color: colors.text,
  },
  actions: {
    gap: spacing.sm,
  },
  error: {
    ...typography.bodySmall,
    color: colors.danger,
  },
});
