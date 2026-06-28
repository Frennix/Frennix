import type {
  FeedStoryLastWorkout,
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
    }
  | { kind: "text"; content: string; meta?: WorkoutStorySlideMeta }
  | { kind: "empty"; meta?: WorkoutStorySlideMeta };

/** @deprecated Use WorkoutStorySlide */
export type StorySlide = WorkoutStorySlide;

export function buildStorySlides(lastWorkout: FeedStoryLastWorkout | null): WorkoutStorySlide[] {
  if (!lastWorkout) return [{ kind: "empty" }];

  const meta: WorkoutStorySlideMeta = {
    musicTrackId: null,
    routeMap: lastWorkout.metrics?.route_polyline
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
    wearable: lastWorkout.metrics?.source
      ? {
          provider: lastWorkout.metrics.source,
          payload: lastWorkout.metrics.extra?.wearable as Record<string, unknown> | undefined,
        }
      : null,
    aiSummary:
      (lastWorkout.metrics?.extra?.ai_summary as string | undefined) ??
      null,
  };

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
