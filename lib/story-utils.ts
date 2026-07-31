import type {
  FeedStoryLastWorkout,
  FrennixStory,
  StorySlide,
  WorkoutStorySlideMeta,
} from "@frennix/types";
import { normalizePostMediaItems } from "@frennix/types";
import { prefetchCachedImages } from "../packages/ui/src/CachedImage";

export type WorkoutStorySlide =
  | {
      kind: "media";
      url: string;
      mediaKind: "image" | "video";
      thumbnailUrl?: string | null;
      meta?: WorkoutStorySlideMeta;
      slideId?: string;
      storyId?: string;
      caption?: string | null;
      workoutType?: string | null;
      workoutData?: Record<string, unknown> | null;
    }
  | {
      kind: "text";
      content: string;
      meta?: WorkoutStorySlideMeta;
      slideId?: string;
      storyId?: string;
    }
  | {
      kind: "workout";
      title: string;
      activity?: string | null;
      metrics: {
        distance?: string | null;
        duration?: string | null;
        calories?: string | null;
        location?: string | null;
        gym?: string | null;
      };
      caption?: string | null;
      meta?: WorkoutStorySlideMeta;
      slideId?: string;
      storyId?: string;
    }
  | { kind: "empty"; meta?: WorkoutStorySlideMeta };

/** @deprecated Use WorkoutStorySlide */
export type StorySlide = WorkoutStorySlide;

function slideMetaFromWorkout(lastWorkout: FeedStoryLastWorkout | null): WorkoutStorySlideMeta {
  if (!lastWorkout?.metrics) {
    return { musicTrackId: null, routeMap: null, wearable: null, aiSummary: null };
  }

  return {
    musicTrackId: null,
    routeMap: lastWorkout.metrics.route_polyline
      ? {
          polyline: lastWorkout.metrics.route_polyline,
          distance_meters: lastWorkout.metrics.distance_meters ?? undefined,
          pace_seconds_per_km:
            (lastWorkout.metrics.extra?.pace_seconds_per_km as number | undefined) ?? undefined,
          elevation_meters:
            (lastWorkout.metrics.extra?.elevation_meters as number | undefined) ?? undefined,
          location_shared: lastWorkout.metrics.location_shared,
        }
      : null,
    wearable: lastWorkout.metrics.source
      ? {
          provider: lastWorkout.metrics.source,
          payload: lastWorkout.metrics.extra?.wearable as Record<string, unknown> | undefined,
        }
      : null,
    aiSummary: (lastWorkout.metrics.extra?.ai_summary as string | undefined) ?? null,
  };
}

function dedicatedSlideToViewerSlide(
  slide: StorySlide,
  story: FrennixStory,
  locationName?: string | null
): WorkoutStorySlide {
  if (slide.media_type === "workout") {
    const data = (slide.workout_data ?? {}) as Record<string, unknown>;
    const extra = (data.extra ?? {}) as Record<string, unknown>;
    return {
      kind: "workout",
      title: slide.workout_type ?? slide.caption ?? "Workout",
      activity: slide.workout_type ?? null,
      metrics: {
        distance: (data.distance_label as string | undefined) ?? null,
        duration: (data.duration_label as string | undefined) ?? null,
        calories: (data.calories_label as string | undefined) ?? null,
        location: locationName ?? (data.location as string | undefined) ?? (extra.location as string | undefined) ?? null,
        gym: (data.gym as string | undefined) ?? (extra.gym as string | undefined) ?? null,
      },
      caption: slide.caption,
      slideId: slide.id,
      storyId: story.id,
    };
  }

  if (slide.media_type === "text" || (!slide.media_url && slide.caption)) {
    return {
      kind: "text",
      content: slide.caption ?? "",
      slideId: slide.id,
      storyId: story.id,
    };
  }

  if (slide.media_url) {
    const isVideo = slide.media_type === "video";
    return {
      kind: "media",
      url: slide.media_url,
      mediaKind: isVideo ? "video" : "image",
      thumbnailUrl: null,
      slideId: slide.id,
      storyId: story.id,
      caption: slide.caption,
      workoutType: slide.workout_type,
      workoutData: slide.workout_data as Record<string, unknown> | null,
    };
  }

  return { kind: "empty" };
}

/** Build viewer slides from dedicated story collections. */
export function buildDedicatedStorySlides(stories: FrennixStory[]): WorkoutStorySlide[] {
  if (!stories.length) return [{ kind: "empty" }];

  const slides: WorkoutStorySlide[] = [];
  for (const story of stories) {
    for (const slide of story.slides ?? []) {
      slides.push(dedicatedSlideToViewerSlide(slide, story, story.location_name));
    }
  }

  return slides.length ? slides : [{ kind: "empty" }];
}

/** @deprecated Post-derived slides */
export function buildStorySlides(lastWorkout: FeedStoryLastWorkout | null): WorkoutStorySlide[] {
  if (!lastWorkout) return [{ kind: "empty" }];

  const meta = slideMetaFromWorkout(lastWorkout);

  if (lastWorkout.media_urls?.length) {
    return normalizePostMediaItems(lastWorkout.media_urls, {
      postType: lastWorkout.post_type,
      thumbnailUrl: lastWorkout.thumbnail_url,
    }).map((item) => ({
      kind: "media" as const,
      url: item.url,
      mediaKind: item.kind,
      thumbnailUrl: item.thumbnailUrl,
      meta,
    }));
  }

  if (lastWorkout.content?.trim()) {
    return [{ kind: "text", content: lastWorkout.content.trim(), meta }];
  }

  return [{ kind: "empty", meta }];
}

export function prefetchStorySlide(slide: WorkoutStorySlide | undefined) {
  if (!slide || slide.kind !== "media" || slide.mediaKind !== "image") return;
  void prefetchCachedImages([slide.url]);
  if (slide.thumbnailUrl) void prefetchCachedImages([slide.thumbnailUrl]);
}

/** Map flat slide index to story + slide ids for engagement tracking. */
export function resolveSlideContext(
  stories: FrennixStory[],
  flatIndex: number
): { storyId: string; slideId: string | null; storyOwnerId: string } | null {
  let cursor = 0;
  for (const story of stories) {
    for (const slide of story.slides ?? []) {
      if (cursor === flatIndex) {
        return { storyId: story.id, slideId: slide.id, storyOwnerId: story.user_id };
      }
      cursor += 1;
    }
  }
  return null;
}
