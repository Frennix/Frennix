import { useQueryClient } from "@tanstack/react-query";
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
import { createPost, getErrorMessage, isVideoMime, uploadPostMedia } from "@frennix/api";
import { generateAndUploadVideoThumbnail } from "@/lib/video-thumbnail";
import type { PostType } from "@frennix/types";
import { useAuth } from "@/providers/AuthProvider";
import { formatActivity } from "@/lib/labels";
import {
  formatVideoDuration,
  getVideoDurationSeconds,
  isVideoTooLong,
  VIDEO_TOO_LONG_MESSAGE,
} from "@/lib/media-duration";
import { showAlert } from "@/lib/alerts";
import { logCreatePostError, logCreatePostInfo } from "@/lib/create-post-logging";
import { requestPhotoAdjustment } from "@/lib/photo-adjustment-flow";
import { stackBackOptions } from "@/lib/stack-navigation";
import { useCreatePostDraft } from "@/lib/useCreatePostDraft";
import { Button, Input, colors, radius, spacing, typography } from "@frennix/ui";

const CAPTION_MAX = 500;
const SUCCESS_NAV_DELAY_MS = 2000;
const MAX_PHOTOS = 10;

type SelectedMediaItem = {
  uri: string;
  mimeType: string;
  file?: File;
  durationSeconds?: number | null;
};

type UploadStage = "idle" | "uploading_media" | "creating_post" | "success";

type PostDestination = "home" | "group" | "challenge" | "event";

function paramValue(value: string | string[] | undefined): string | undefined {
  if (value == null) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function mimeFromAsset(asset: ImagePicker.ImagePickerAsset): string {
  if (asset.mimeType) return asset.mimeType;
  if (asset.type === "video") return "video/mp4";
  return "image/jpeg";
}

function uploadStageLabel(stage: UploadStage, isContextPost: boolean) {
  if (stage === "uploading_media") return "Uploading media…";
  if (stage === "creating_post") return "Sharing…";
  if (stage === "success") {
    const shared = isContextPost ? "Post shared successfully" : "Workout shared successfully";
    return `${shared}. Opening your post…`;
  }
  return "";
}

function resolveDestination(
  groupId: string | null,
  challengeId: string | null,
  eventId: string | null
): PostDestination {
  if (groupId) return "group";
  if (challengeId) return "challenge";
  if (eventId) return "event";
  return "home";
}

async function refreshFeedForDestination(
  queryClient: ReturnType<typeof useQueryClient>,
  destination: PostDestination,
  userId: string,
  contextId: string | null
) {
  if (destination === "group" && contextId) {
    await queryClient.invalidateQueries({ queryKey: ["group-posts", contextId] });
    await queryClient.refetchQueries({ queryKey: ["group-posts", contextId] });
    return;
  }
  if (destination === "challenge" && contextId) {
    await queryClient.invalidateQueries({ queryKey: ["challenge-posts", contextId] });
    await queryClient.refetchQueries({ queryKey: ["challenge-posts", contextId] });
    return;
  }
  if (destination === "event" && contextId) {
    await queryClient.invalidateQueries({ queryKey: ["event-posts", contextId] });
    await queryClient.refetchQueries({ queryKey: ["event-posts", contextId] });
    return;
  }

  await queryClient.invalidateQueries({ queryKey: ["feed", userId] });
  await queryClient.invalidateQueries({ queryKey: ["feed-stories", userId] });
  await queryClient.invalidateQueries({ queryKey: ["user-posts"] });
  await queryClient.invalidateQueries({ queryKey: ["profile-stats", userId] });
  await queryClient.refetchQueries({ queryKey: ["feed", userId] });
}

function navigateAfterPost(postId: string) {
  router.replace(`/post/${postId}`);
}

export default function CreatePostScreen() {
  const params = useLocalSearchParams<{ groupId?: string; challengeId?: string; eventId?: string }>();
  const routeGroupId = paramValue(params.groupId);
  const routeChallengeId = paramValue(params.challengeId);
  const routeEventId = paramValue(params.eventId);

  const { session } = useAuth();
  const userId = session?.user.id;
  const queryClient = useQueryClient();
  const navigateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submittingRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [uploadStage, setUploadStage] = useState<UploadStage>("idle");
  const [error, setError] = useState("");
  const [selectedMedia, setSelectedMedia] = useState<SelectedMediaItem[]>([]);

  const {
    hydrated,
    content,
    setContent,
    workoutType,
    setWorkoutType,
    groupId,
    challengeId,
    eventId,
    mediaUri,
    mimeType,
    pickedFile,
    videoDurationSeconds,
    setVideoDurationSeconds,
    applyPickedMedia,
    clearMedia,
    clearDraft,
    setPersistPaused,
    flushDraft,
  } = useCreatePostDraft(userId, {
    groupId: routeGroupId,
    challengeId: routeChallengeId,
    eventId: routeEventId,
  });

  const destination = resolveDestination(groupId, challengeId, eventId);
  const contextId = groupId ?? challengeId ?? eventId;
  const isContextPost = destination !== "home";
  const hasVideo = selectedMedia.some((item) => isVideoMime(item.mimeType));
  const hasPhotos = selectedMedia.some((item) => !isVideoMime(item.mimeType));
  const isSubmitting = loading;
  const isSuccess = uploadStage === "success";
  const isFormLocked = isSubmitting || isSuccess;

  useEffect(() => {
    if (!hydrated || selectedMedia.length) return;
    if (mediaUri) {
      setSelectedMedia([
        {
          uri: mediaUri,
          mimeType,
          file: pickedFile,
          durationSeconds: videoDurationSeconds,
        },
      ]);
    }
  }, [hydrated, mediaUri, mimeType, pickedFile, videoDurationSeconds, selectedMedia.length]);

  useEffect(() => {
    return () => {
      if (navigateTimeoutRef.current) clearTimeout(navigateTimeoutRef.current);
    };
  }, []);

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

    const pickingVideo = selectedMedia.length === 0 || hasVideo;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: pickingVideo ? ImagePicker.MediaTypeOptions.All : ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      allowsMultipleSelection: !pickingVideo,
      selectionLimit: pickingVideo ? 1 : MAX_PHOTOS - selectedMedia.length,
      quality: 0.8,
      videoMaxDuration: 60,
    });

    if (result.canceled) return;

    const videoAssets = result.assets.filter((asset) => isVideoMime(mimeFromAsset(asset)));
    const photoAssets = result.assets.filter((asset) => !isVideoMime(mimeFromAsset(asset)));

    if (videoAssets.length > 0) {
      const asset = videoAssets[0];
      const mime = mimeFromAsset(asset);
      const file = "file" in asset ? asset.file ?? undefined : undefined;
      const durationSeconds = await getVideoDurationSeconds(asset, mime);
      if (isVideoTooLong(durationSeconds)) {
        showAlert("Video too long", VIDEO_TOO_LONG_MESSAGE);
        return;
      }
      setSelectedMedia([{ uri: asset.uri, mimeType: mime, file, durationSeconds }]);
      await applyPickedMedia(
        { uri: asset.uri } as ImagePicker.ImagePickerAsset,
        mime,
        file,
        durationSeconds ?? null
      );
      return;
    }

    if (!photoAssets.length) return;

    const adjustedPhotos: SelectedMediaItem[] = [];

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
      });
    }

    const merged = [...selectedMedia.filter((item) => !isVideoMime(item.mimeType)), ...adjustedPhotos].slice(
      0,
      MAX_PHOTOS
    );
    setSelectedMedia(merged);
    const first = merged[0];
    await applyPickedMedia(
      { uri: first.uri } as ImagePicker.ImagePickerAsset,
      first.mimeType,
      first.file,
      null
    );
  }

  async function removeMediaAt(index: number) {
    if (isFormLocked) return;
    setError("");
    const next = selectedMedia.filter((_, itemIndex) => itemIndex !== index);
    setSelectedMedia(next);
    if (!next.length) {
      await clearMedia();
      return;
    }
    const first = next[0];
    await applyPickedMedia(
      { uri: first.uri } as ImagePicker.ImagePickerAsset,
      first.mimeType,
      first.file,
      first.durationSeconds ?? null
    );
  }

  async function handleClearMedia() {
    if (isFormLocked) return;
    setError("");
    setSelectedMedia([]);
    await clearMedia();
  }

  async function submit() {
    if (submittingRef.current || loading || isSuccess || navigateTimeoutRef.current) return;

    if (!session?.user.id) {
      const message = "You must be signed in to post";
      setError(message);
      showAlert("Create post", message);
      return;
    }
    if (!content && !selectedMedia.length && !workoutType) {
      setError("Add a caption, workout type, or photo/video");
      return;
    }
    if (hasVideo && selectedMedia.some((item) => isVideoTooLong(item.durationSeconds ?? null))) {
      showAlert("Video too long", VIDEO_TOO_LONG_MESSAGE);
      return;
    }

    submittingRef.current = true;
    setPersistPaused(true);
    setLoading(true);
    setUploadStage("idle");
    setError("");

    const postDestination = destination;
    const postContextId = contextId;

    try {
      await flushDraft();

      let mediaUrls: string[] = [];
      let thumbnailUrl: string | null = null;
      let postType: PostType = "text";

      if (selectedMedia.length) {
        setUploadStage("uploading_media");
        try {
          for (const item of selectedMedia) {
            const url = await uploadPostMedia(session.user.id, item.uri, item.mimeType, item.file);
            mediaUrls.push(url);
          }

          if (hasVideo) {
            const video = selectedMedia[0];
            postType = "video";
            thumbnailUrl = await generateAndUploadVideoThumbnail(
              session.user.id,
              video.uri,
              video.mimeType,
              video.file
            );
            if (!thumbnailUrl) {
              logCreatePostInfo(
                "media_upload",
                "Video thumbnail generation failed; feed will use first-frame fallback"
              );
            }
          } else {
            postType = "photo";
          }
        } catch (uploadError) {
          logCreatePostError("media_upload", uploadError, {
            mimeType: selectedMedia[0]?.mimeType,
            hasMedia: true,
            destination: postDestination,
          });
          throw uploadError;
        }
      } else if (workoutType || content) {
        postType = "workout_update";
      }

      setUploadStage("creating_post");
      let created;
      try {
        created = await createPost({
          author_id: session.user.id,
          content: content || undefined,
          media_urls: mediaUrls,
          thumbnail_url: thumbnailUrl,
          post_type: postType,
          workout_type: workoutType,
          group_id: groupId ?? null,
          challenge_id: challengeId ?? null,
          event_id: eventId ?? null,
        });
      } catch (saveError) {
        logCreatePostError("post_save", saveError, {
          postType,
          destination: postDestination,
          hasMedia: Boolean(selectedMedia.length),
        });
        throw saveError;
      }

      if (selectedMedia.length && !created.media_urls?.length) {
        throw new Error("Post saved but media URL is missing from the response");
      }
      if (hasVideo && created.post_type !== "video") {
        throw new Error(`Post saved but post_type is "${created.post_type}" instead of video`);
      }

      try {
        await refreshFeedForDestination(queryClient, postDestination, session.user.id, postContextId);
      } catch (refreshError) {
        logCreatePostError("post_save", refreshError, {
          action: "refresh_feed",
          destination: postDestination,
        });
      }

      await clearDraft();
      setSelectedMedia([]);
      setLoading(false);
      setUploadStage("success");
      logCreatePostInfo("navigation", "Post created", {
        destination: postDestination,
        postId: created.id,
      });

      navigateTimeoutRef.current = setTimeout(() => {
        try {
          navigateAfterPost(created.id);
        } catch (navigationError) {
          logCreatePostError("navigation", navigationError, { destination: postDestination });
        } finally {
          setUploadStage("idle");
          submittingRef.current = false;
          setPersistPaused(false);
        }
      }, SUCCESS_NAV_DELAY_MS);
    } catch (e) {
      const message = getErrorMessage(e);
      setError(message);
      setUploadStage("idle");
      setLoading(false);
      submittingRef.current = false;
      setPersistPaused(false);
      void flushDraft();
    }
  }

  const progressLabel = uploadStageLabel(uploadStage, isContextPost);
  const showSubmittingUi = isSubmitting || uploadStage === "uploading_media" || uploadStage === "creating_post";
  const screenOptions = stackBackOptions(isContextPost ? "Share post" : "Share workout", {
    presentation: "modal",
  });

  if (!hydrated) {
    return (
      <>
        <Stack.Screen options={screenOptions} />
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={screenOptions} />
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
            label="What did you accomplish?"
            value={content}
            onChangeText={setContent}
            multiline
            maxLength={CAPTION_MAX}
            editable={!isFormLocked}
            placeholder="Crushed leg day, hit a PR, finished a 5K..."
          />
          <Text style={styles.charCount}>
            {content.length}/{CAPTION_MAX}
          </Text>
        </View>

        {selectedMedia.length ? (
          <View style={styles.mediaSection}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mediaRow}>
              {selectedMedia.map((item, index) => {
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
              {hasVideo && selectedMedia[0]?.durationSeconds != null
                ? `Video selected · ${formatVideoDuration(selectedMedia[0].durationSeconds)}`
                : hasPhotos
                  ? `${selectedMedia.length} photo${selectedMedia.length === 1 ? "" : "s"} selected`
                  : "Media selected"}
            </Text>

            {!hasVideo && selectedMedia.length < MAX_PHOTOS ? (
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

        {progressLabel ? (
          <View
            style={[
              styles.statusBanner,
              isSuccess ? styles.successBanner : styles.progressBanner,
            ]}
          >
            {!isSuccess ? (
              <ActivityIndicator color={colors.accent} size="small" />
            ) : (
              <Text style={styles.successIcon}>✓</Text>
            )}
            <Text style={[styles.statusText, isSuccess && styles.successText]}>{progressLabel}</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorIcon}>!</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Button
          title={
            isSuccess
              ? isContextPost
                ? "Post shared!"
                : "Workout shared!"
              : isContextPost
                ? "Share post"
                : "Share workout"
          }
          loadingTitle="Sharing…"
          onPress={submit}
          loading={showSubmittingUi}
          disabled={isFormLocked}
        />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  sectionLabel: { ...typography.body, fontWeight: "600" },
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
  mediaRow: { gap: spacing.sm },
  previewWrapper: {
    position: "relative",
    width: 220,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  preview: {
    width: "100%",
    height: 220,
    backgroundColor: colors.surfaceElevated,
  },
  previewClose: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(10, 10, 11, 0.85)",
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  previewCloseText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 18,
  },
  typeBadge: {
    position: "absolute",
    bottom: spacing.sm,
    left: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  typeBadgeText: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: "700",
  },
  mediaHint: { ...typography.caption, color: colors.textSecondary },
  addMediaBlock: { gap: spacing.xs },
  mediaHelper: { ...typography.caption, color: colors.textMuted, textAlign: "center" },
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  progressBanner: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  successBanner: {
    backgroundColor: colors.accentMuted,
    borderColor: colors.accent,
  },
  statusText: { ...typography.bodySmall, color: colors.textSecondary, flex: 1 },
  successText: { color: colors.accent, fontWeight: "600" },
  successIcon: {
    color: colors.accent,
    fontSize: 18,
    fontWeight: "700",
    width: 20,
    textAlign: "center",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderColor: colors.danger,
  },
  errorIcon: {
    color: colors.danger,
    fontSize: 16,
    fontWeight: "700",
    width: 20,
    textAlign: "center",
    lineHeight: 20,
  },
  errorText: { ...typography.bodySmall, color: colors.danger, flex: 1 },
});
