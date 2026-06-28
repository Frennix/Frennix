import type { FeedStoryLastWorkout, ProfileAchievement } from "@frennix/types";
import { normalizePostMediaItems } from "@frennix/types";
import { prefetchCachedImages } from "../packages/ui/src/CachedImage";

export type StorySlide =
  | {
      kind: "media";
      url: string;
      mediaKind: "image" | "video";
      thumbnailUrl?: string | null;
    }
  | { kind: "text"; content: string }
  | { kind: "empty" };

export function buildStorySlides(lastWorkout: FeedStoryLastWorkout | null): StorySlide[] {
  if (!lastWorkout) return [{ kind: "empty" }];

  if (lastWorkout.media_urls?.length) {
    return normalizePostMediaItems(lastWorkout.media_urls, {
      postType: lastWorkout.post_type,
      thumbnailUrl: lastWorkout.thumbnail_url,
    }).map((item) => ({
      kind: "media" as const,
      url: item.url,
      mediaKind: item.kind,
      thumbnailUrl: item.thumbnailUrl,
    }));
  }

  if (lastWorkout.content?.trim()) {
    return [{ kind: "text", content: lastWorkout.content.trim() }];
  }

  return [{ kind: "empty" }];
}

/** Best-effort streak achievement for story overlay. */
export function streakAchievementForStory(streak: number): ProfileAchievement | null {
  if (streak >= 30) {
    return {
      id: "streak_30",
      emoji: "👑",
      label: "Streak legend",
      description: "30-day workout streak",
    };
  }
  if (streak >= 7) {
    return {
      id: "streak_7",
      emoji: "💪",
      label: "Week warrior",
      description: "7-day workout streak",
    };
  }
  if (streak >= 3) {
    return {
      id: "streak_3",
      emoji: "🔥",
      label: "On fire",
      description: "3-day workout streak",
    };
  }
  return null;
}

export function prefetchStorySlide(slide: StorySlide | undefined) {
  if (!slide || slide.kind !== "media" || slide.mediaKind !== "image") return;
  void prefetchCachedImages([slide.url]);
  if (slide.thumbnailUrl) void prefetchCachedImages([slide.thumbnailUrl]);
}
