import { useQueryClient } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Video, ResizeMode } from "expo-av";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  ACTIVITIES,
  STORY_PRIVACY_OPTIONS,
  type StoryPrivacy,
  type StoryShareMode,
} from "@frennix/types";
import { isVideoMime } from "@frennix/api";
import { getSharePostUserMessage } from "@/lib/share-post-errors";
import { WorkoutSavedSheet } from "@/components/WorkoutSavedSheet";
import { shareWorkout } from "@/lib/share-workout";
import { resolveVideoUploadFile } from "@/lib/video-upload";
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
import { ReorderablePhotoStrip } from "@/components/ReorderablePhotoStrip";
import { UploadProgressBar } from "@/components/UploadProgressBar";
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

function uploadStageLabel(
  stage: UploadStage,
  isContextPost: boolean,
  uploadingVideo: boolean
) {
  if (stage === "uploading_media") {
    return uploadingVideo ? "Uploading video…" : "Uploading media…";
  }
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
  const [pickingMedia, setPickingMedia] = useState(false);
  const [uploadStage, setUploadStage] = useState<UploadStage>("idle");
  const [error, setError] = useState("");
  const [selectedMedia, setSelectedMedia] = useState<SelectedMediaItem[]>([]);
  const [storyPrivacy, setStoryPrivacy] = useState<StoryPrivacy>("followers");
  const [savedSheetVisible, setSavedSheetVisible] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState("");
  const [distanceKm, setDistanceKm] = useState("");
  const [calories, setCalories] = useState("");
  const [gym, setGym] = useState("");
  const [locationName, setLocationName] = useState("");

  const {
    hydrated,
    content,
    setContent,
    workoutTypes,
    setWorkoutTypes,
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
    setPickingMedia(true);
    try {
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
      const pickedFile = "file" in asset ? asset.file ?? undefined : undefined;
      const file = await resolveVideoUploadFile(asset.uri, mime, pickedFile);
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
    } finally {
      setPickingMedia(false);
    }
  }

  function reorderMedia(fromIndex: number, toIndex: number) {
    if (isFormLocked || fromIndex === toIndex) return;
    setSelectedMedia((current) => {
      const next = [...current];
      const [item] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, item);
      return next;
    });
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

  function buildWorkoutMetrics() {
    const duration = Number(durationMinutes);
    const distance = Number(distanceKm);
    const cal = Number(calories);
    return {
      duration_seconds: Number.isFinite(duration) && duration > 0 ? Math.round(duration * 60) : null,
      distance_meters: Number.isFinite(distance) && distance > 0 ? Math.round(distance * 1000) : null,
      calories: Number.isFinite(cal) && cal > 0 ? Math.round(cal) : null,
      extra: {
        gym: gym.trim() || null,
        location: locationName.trim() || null,
      },
    };
  }

  async function executeShare(mode: StoryShareMode | "done") {
    if (!session?.user.id) return;

    setLoading(true);
    setUploadStage("creating_post");
    setSavedSheetVisible(false);

    try {
      if (mode === "done") {
        await clearDraft();
        setSelectedMedia([]);
        router.back();
        return;
      }

      const result = await shareWorkout(
        mode,
        {
          userId: session.user.id,
          content: content || undefined,
          workoutTypes,
          metrics: buildWorkoutMetrics(),
          gym: gym.trim() || null,
          locationName: locationName.trim() || null,
          media: selectedMedia.map((item) => ({
            uri: item.uri,
            mimeType: item.mimeType,
            file: item.file,
            durationSeconds: item.durationSeconds,
          })),
          storyPrivacy,
        },
        queryClient
      );

      await clearDraft();
      setSelectedMedia([]);
      setUploadStage("success");

      navigateTimeoutRef.current = setTimeout(() => {
        if (result.postId) {
          navigateAfterPost(result.postId);
        } else {
          router.back();
        }
        setUploadStage("idle");
        submittingRef.current = false;
        setPersistPaused(false);
        setLoading(false);
      }, SUCCESS_NAV_DELAY_MS);
    } catch (e) {
      const message = getSharePostUserMessage(e);
      setError(message);
      showAlert("Could not share", message);
      setUploadStage("idle");
      setLoading(false);
      submittingRef.current = false;
      setPersistPaused(false);
    }
  }

  async function submit() {
    if (submittingRef.current || loading || isSuccess || navigateTimeoutRef.current) return;

    if (!session?.user.id) {
      const message = "You must be signed in to post";
      setError(message);
      showAlert("Create post", message);
      return;
    }
    if (!content && !selectedMedia.length && !workoutTypes.length) {
      setError("Add a caption, workout type, or photo/video");
      return;
    }
    if (hasVideo && selectedMedia.some((item) => isVideoTooLong(item.durationSeconds ?? null))) {
      showAlert("Video too long", VIDEO_TOO_LONG_MESSAGE);
      return;
    }

    submittingRef.current = true;
    setPersistPaused(true);
    setError("");

    try {
      await flushDraft();

      if (!isContextPost) {
        submittingRef.current = false;
        setPersistPaused(false);
        setSavedSheetVisible(true);
        return;
      }

      setLoading(true);
      setUploadStage("idle");
      const postDestination = destination;
      const postContextId = contextId;

      setLoading(true);
      setUploadStage("creating_post");

      const result = await shareWorkout(
        "feed",
        {
          userId: session.user.id,
          content: content || undefined,
          workoutTypes,
          metrics: buildWorkoutMetrics(),
          gym: gym.trim() || null,
          locationName: locationName.trim() || null,
          media: selectedMedia.map((item) => ({
            uri: item.uri,
            mimeType: item.mimeType,
            file: item.file,
            durationSeconds: item.durationSeconds,
          })),
          groupId: groupId ?? null,
          challengeId: challengeId ?? null,
          eventId: eventId ?? null,
        },
        queryClient
      );

      await refreshFeedForDestination(queryClient, postDestination, session.user.id, postContextId);
      await clearDraft();
      setSelectedMedia([]);
      setLoading(false);
      setUploadStage("success");

      navigateTimeoutRef.current = setTimeout(() => {
        if (result.postId) {
          navigateAfterPost(result.postId);
        } else {
          router.back();
        }
        setUploadStage("idle");
        submittingRef.current = false;
        setPersistPaused(false);
      }, SUCCESS_NAV_DELAY_MS);
    } catch (e) {
      const message = getSharePostUserMessage(e);
      setError(message);
      showAlert("Could not post", message);
      setUploadStage("idle");
      setLoading(false);
      submittingRef.current = false;
      setPersistPaused(false);
      void flushDraft();
    }
  }

  const progressLabel = uploadStageLabel(uploadStage, isContextPost, hasVideo);
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
        <Text style={styles.sectionLabel}>Workout types</Text>
        <View style={styles.chips}>
          {ACTIVITIES.map((activity) => (
            <Pressable
              key={activity}
              style={[styles.chip, workoutTypes.includes(activity) && styles.chipActive]}
              onPress={() =>
                setWorkoutTypes((current) =>
                  current.includes(activity)
                    ? current.filter((item) => item !== activity)
                    : [...current, activity]
                )
              }
              disabled={isFormLocked}
            >
              <Text style={[styles.chipText, workoutTypes.includes(activity) && styles.chipTextActive]}>
                {formatActivity(activity)}
              </Text>
            </Pressable>
          ))}
        </View>

        {!isContextPost ? (
          <>
            <Text style={styles.sectionLabel}>Workout details</Text>
            <View style={styles.metricsRow}>
              <Input
                label="Duration (min)"
                value={durationMinutes}
                onChangeText={setDurationMinutes}
                keyboardType="numeric"
                editable={!isFormLocked}
                placeholder="42"
              />
              <Input
                label="Distance (km)"
                value={distanceKm}
                onChangeText={setDistanceKm}
                keyboardType="decimal-pad"
                editable={!isFormLocked}
                placeholder="5.2"
              />
            </View>
            <View style={styles.metricsRow}>
              <Input
                label="Calories"
                value={calories}
                onChangeText={setCalories}
                keyboardType="numeric"
                editable={!isFormLocked}
                placeholder="610"
              />
              <Input
                label="Gym"
                value={gym}
                onChangeText={setGym}
                editable={!isFormLocked}
                placeholder="LA Fitness"
              />
            </View>
            <Input
              label="Location"
              value={locationName}
              onChangeText={setLocationName}
              editable={!isFormLocked}
              placeholder="Portland Waterfront"
            />

            <Text style={styles.sectionLabel}>Story privacy</Text>
            <Text style={styles.sectionHint}>Used when sharing to Story</Text>
            <View style={styles.chips}>
              {STORY_PRIVACY_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  style={[styles.chip, storyPrivacy === option.value && styles.chipActive]}
                  onPress={() => setStoryPrivacy(option.value)}
                  disabled={isFormLocked}
                >
                  <Text
                    style={[styles.chipText, storyPrivacy === option.value && styles.chipTextActive]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

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
            {hasVideo ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mediaRow}>
                {selectedMedia.map((item, index) => (
                  <View key={`${item.uri}-${index}`} style={styles.previewWrapper}>
                    <Video
                      source={{ uri: item.uri }}
                      style={styles.preview}
                      useNativeControls
                      resizeMode={ResizeMode.CONTAIN}
                      isLooping={false}
                    />
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
                      <Text style={styles.typeBadgeText}>Video</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mediaRow}>
                <ReorderablePhotoStrip
                  photos={selectedMedia.map((item) => ({ uri: item.uri, key: item.uri }))}
                  onReorder={reorderMedia}
                  onRemove={removeMediaAt}
                  disabled={isFormLocked}
                />
              </ScrollView>
            )}

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
              disabled={isFormLocked || pickingMedia}
              loading={pickingMedia}
              loadingTitle="Opening library…"
            />
            <Text style={styles.mediaHelper}>
              Add up to {MAX_PHOTOS} photos or one workout video up to 60 seconds.
            </Text>
          </View>
        )}

        {progressLabel || showSubmittingUi ? (
          <UploadProgressBar
            active={showSubmittingUi && !isSuccess}
            success={isSuccess}
            label={progressLabel || (pickingMedia ? "Opening photo library…" : "Preparing…")}
          />
        ) : null}

        {pickingMedia && !progressLabel ? (
          <View style={styles.pickingRow}>
            <ActivityIndicator color={colors.accent} size="small" accessibilityLabel="Loading media" />
            <Text style={styles.pickingText}>Preparing media…</Text>
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
                : "Save Workout"
          }
          loadingTitle={isContextPost ? "Sharing…" : "Saving…"}
          onPress={submit}
          loading={showSubmittingUi}
          disabled={isFormLocked}
        />
      </ScrollView>
      <WorkoutSavedSheet
        visible={savedSheetVisible}
        loading={loading}
        onSelect={(mode) => void executeShare(mode)}
        onClose={() => setSavedSheetVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  sectionLabel: { ...typography.body, fontWeight: "600" },
  sectionHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  metricsRow: { flexDirection: "row", gap: spacing.sm },
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
  pickingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  pickingText: { ...typography.caption, color: colors.textMuted },
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
