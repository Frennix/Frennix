import type { QueryClient } from "@tanstack/react-query";
import type { PostType, StoryPrivacy, StoryShareMode, WorkoutStoryMetrics } from "@frennix/types";
import {
  createPost,
  isVideoMime,
  publishStory,
  uploadPostMedia,
  uploadStoryMedia,
  withTimeout,
  POST_CREATE_TIMEOUT_MS,
  THUMBNAIL_CAPTURE_TIMEOUT_MS,
} from "@frennix/api";
import { generateAndUploadVideoThumbnail } from "@/lib/video-thumbnail";
import {
  formatStoryCalories,
  formatStoryDistance,
  formatStoryDuration,
} from "@/lib/story-format";

export type WorkoutShareMedia = {
  uri: string;
  mimeType: string;
  file?: File;
  durationSeconds?: number | null;
};

export type WorkoutShareInput = {
  userId: string;
  content?: string;
  workoutTypes: string[];
  metrics: WorkoutStoryMetrics;
  gym?: string | null;
  locationName?: string | null;
  locationType?: string | null;
  media: WorkoutShareMedia[];
  storyPrivacy?: StoryPrivacy;
  groupId?: string | null;
  challengeId?: string | null;
  eventId?: string | null;
};

function buildWorkoutSlideData(
  metrics: WorkoutStoryMetrics,
  gym?: string | null,
  locationName?: string | null
): WorkoutStoryMetrics & Record<string, unknown> {
  const durationLabel = formatStoryDuration(metrics.duration_seconds);
  const distanceLabel = formatStoryDistance(metrics.distance_meters);
  const caloriesLabel = formatStoryCalories(metrics.calories);

  return {
    ...metrics,
    duration_label: durationLabel,
    distance_label: distanceLabel,
    calories_label: caloriesLabel,
    gym: gym ?? null,
    location: locationName ?? null,
  };
}

async function uploadFeedMediaAssets(userId: string, media: WorkoutShareMedia[]) {
  const mediaUrls: string[] = [];
  let thumbnailUrl: string | null = null;
  let postType: PostType = "text";
  const hasVideo = media.some((item) => isVideoMime(item.mimeType));
  const primaryVideo = hasVideo ? media.find((item) => isVideoMime(item.mimeType)) ?? media[0] : null;

  if (hasVideo && primaryVideo) {
    postType = "video";
    try {
      thumbnailUrl = await withTimeout(
        generateAndUploadVideoThumbnail(
          userId,
          primaryVideo.uri,
          primaryVideo.mimeType,
          primaryVideo.file
        ),
        THUMBNAIL_CAPTURE_TIMEOUT_MS + 30_000,
        "Video thumbnail upload"
      );
    } catch {
      thumbnailUrl = null;
    }
  } else if (media.length) {
    postType = "photo";
  } else if (media.length === 0) {
    postType = "workout_update";
  }

  for (const item of media) {
    const url = await uploadPostMedia(userId, item.uri, item.mimeType, item.file);
    mediaUrls.push(url);
  }

  return { mediaUrls, thumbnailUrl, postType };
}

async function uploadStoryMediaAssets(userId: string, media: WorkoutShareMedia[]) {
  const mediaUrls: string[] = [];

  for (const item of media) {
    const url = await uploadStoryMedia(userId, item.uri, item.mimeType, item.file);
    mediaUrls.push(url);
  }

  return mediaUrls;
}

function buildStorySlidesFromInput(
  input: WorkoutShareInput,
  mediaUrls: string[]
) {
  const workoutData = buildWorkoutSlideData(input.metrics, input.gym, input.locationName);
  const primaryType = input.workoutTypes[0] ?? "Workout";

  if (input.media.length) {
    return input.media.map((item, index) => ({
      media_url: mediaUrls[index] ?? null,
      media_type: isVideoMime(item.mimeType) ? ("video" as const) : ("photo" as const),
      caption: index === 0 ? input.content ?? null : null,
      workout_type: primaryType,
      workout_data: workoutData,
      sort_order: index,
    }));
  }

  return [
    {
      media_type: "workout" as const,
      caption: input.content ?? null,
      workout_type: primaryType,
      workout_data: workoutData,
      sort_order: 0,
    },
  ];
}

export async function shareWorkout(
  mode: StoryShareMode | "done",
  input: WorkoutShareInput,
  queryClient: QueryClient
) {
  if (mode === "done") return { postId: null, storyId: null };

  const shouldFeed = mode === "feed" || mode === "both";
  const shouldStory = mode === "story" || mode === "both";

  let createdPost: Awaited<ReturnType<typeof createPost>> | null = null;
  let storyId: string | null = null;

  if (shouldFeed) {
    const { mediaUrls, thumbnailUrl, postType } = await uploadFeedMediaAssets(input.userId, input.media);
    createdPost = await withTimeout(
      createPost({
        author_id: input.userId,
        content: input.content,
        media_urls: mediaUrls,
        thumbnail_url: thumbnailUrl,
        post_type: postType,
        workout_types: input.workoutTypes,
        workout_metrics: input.metrics,
        group_id: input.groupId ?? null,
        challenge_id: input.challengeId ?? null,
        event_id: input.eventId ?? null,
      }),
      POST_CREATE_TIMEOUT_MS,
      "Creating post"
    );

    if (shouldStory) {
      const slides = buildStorySlidesFromInput(input, mediaUrls);
      const story = await publishStory({
        user_id: input.userId,
        privacy: input.storyPrivacy ?? "followers",
        post_id: createdPost.id,
        workout_tag: input.workoutTypes[0] ?? null,
        location_name: input.locationName ?? input.gym ?? null,
        location_type: (input.locationType as import("@frennix/types").StoryLocationType) ?? null,
        slides,
      });
      storyId = story.id;
    }
  } else if (shouldStory) {
    const storyMediaUrls = input.media.length
      ? await uploadStoryMediaAssets(input.userId, input.media)
      : [];
    const slides = buildStorySlidesFromInput(input, storyMediaUrls);
    const story = await publishStory({
      user_id: input.userId,
      privacy: input.storyPrivacy ?? "followers",
      post_id: null,
      workout_tag: input.workoutTypes[0] ?? null,
      location_name: input.locationName ?? input.gym ?? null,
      location_type: (input.locationType as import("@frennix/types").StoryLocationType) ?? null,
      slides,
    });
    storyId = story.id;
  }

  await queryClient.invalidateQueries({ queryKey: ["feed", input.userId] });
  await queryClient.invalidateQueries({ queryKey: ["feed-stories", input.userId] });
  await queryClient.invalidateQueries({ queryKey: ["user-posts"] });

  return { postId: createdPost?.id ?? null, storyId };
}
