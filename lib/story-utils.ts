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
    routeMap: null,
    wearable: lastWorkout.metrics?.extra?.wearable as Record<string, unknown> | null,
    aiSummary: null,
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
