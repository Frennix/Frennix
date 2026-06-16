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
import { createPost, getErrorMessage, isVideoMime, postTypeFromMime, uploadPostMedia } from "@frennix/api";
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
import { useCreatePostDraft } from "@/lib/useCreatePostDraft";
import { Button, Input, colors, radius, spacing, typography } from "@frennix/ui";

const CAPTION_MAX = 500;
const SUCCESS_NAV_DELAY_MS = 2000;

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
  const isVideo = isVideoMime(mimeType);
  const mediaTypeLabel = isVideo ? "Video" : "Photo";
  const isSubmitting = loading;
  const isSuccess = uploadStage === "success";
  const isFormLocked = isSubmitting || isSuccess;

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

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: false,
      quality: 0.8,
      videoMaxDuration: 60,
    });

    if (result.canceled) return;

    const asset = result.assets[0];
    const mime = mimeFromAsset(asset);

    if (isVideoMime(mime)) {
      const durationSeconds = await getVideoDurationSeconds(asset, mime);
      if (isVideoTooLong(durationSeconds)) {
        showAlert("Video too long", VIDEO_TOO_LONG_MESSAGE);
        return;
      }
      const file = "file" in asset ? asset.file ?? undefined : undefined;
      await applyPickedMedia(asset, mime, file, durationSeconds);
      return;
    }

    const file = "file" in asset ? asset.file ?? undefined : undefined;
    await applyPickedMedia(asset, mime, file, null);
  }

  async function handleClearMedia() {
    if (isFormLocked) return;
    setError("");
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
    if (!content && !mediaUri && !workoutType) {
      setError("Add a caption, workout type, or photo/video");
      return;
    }
    if (mediaUri && isVideo && isVideoTooLong(videoDurationSeconds)) {
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

      if (mediaUri) {
        setUploadStage("uploading_media");
        try {
          const url = await uploadPostMedia(session.user.id, mediaUri, mimeType, pickedFile);
          mediaUrls = [url];
          postType = postTypeFromMime(mimeType);

          if (isVideo) {
            thumbnailUrl = await generateAndUploadVideoThumbnail(
              session.user.id,
              mediaUri,
              mimeType,
              pickedFile
            );
            if (!thumbnailUrl) {
              logCreatePostInfo(
                "media_upload",
                "Video thumbnail generation failed; feed will use first-frame fallback"
              );
            }
          }
        } catch (uploadError) {
          logCreatePostError("media_upload", uploadError, {
            mimeType,
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
          hasMedia: Boolean(mediaUri),
        });
        throw saveError;
      }

      if (mediaUri && !created.media_urls?.[0]) {
        throw new Error("Post saved but media URL is missing from the response");
      }
      if (mediaUri && isVideo && created.post_type !== "video") {
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

  if (!hydrated) {
    return (
      <>
        <Stack.Screen options={{ title: isContextPost ? "Share post" : "Share workout" }} />
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: isContextPost ? "Share post" : "Share workout" }} />
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

        {mediaUri ? (
          <View style={styles.mediaSection}>
            <View style={styles.previewWrapper}>
              {isVideo ? (
                <Video
                  source={{ uri: mediaUri }}
                  style={styles.preview}
                  useNativeControls
                  resizeMode={ResizeMode.CONTAIN}
                  isLooping={false}
                />
              ) : (
                <Image source={{ uri: mediaUri }} style={styles.preview} resizeMode="cover" />
              )}

              <Pressable
                style={styles.previewClose}
                onPress={handleClearMedia}
                disabled={isFormLocked}
                accessibilityRole="button"
                accessibilityLabel="Remove media"
              >
                <Text style={styles.previewCloseText}>✕</Text>
              </Pressable>

              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>{mediaTypeLabel}</Text>
              </View>
            </View>

            <Text style={styles.mediaHint}>
              {isVideo && videoDurationSeconds != null
                ? `Video selected · ${formatVideoDuration(videoDurationSeconds)}`
                : `${mediaTypeLabel} selected`}
            </Text>

            <Button
              title="Replace Media"
              variant="secondary"
              onPress={pickMedia}
              disabled={isFormLocked}
            />
            <Button
              title="Remove Media"
              variant="danger"
              onPress={handleClearMedia}
              disabled={isFormLocked}
            />
          </View>
        ) : (
          <View style={styles.addMediaBlock}>
            <Button
              title="Add photo or video"
              variant="secondary"
              onPress={pickMedia}
              disabled={isFormLocked}
            />
            <Text style={styles.mediaHelper}>Videos can be up to 60 seconds.</Text>
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
  previewWrapper: {
    position: "relative",
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
