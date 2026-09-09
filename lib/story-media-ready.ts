export const STORY_MEDIA_LOAD_TIMEOUT_MS = 20_000;
export const STORY_PRIVATE_MEDIA_PREFIX = "stories-private:";

export type StoryMediaReadyState = {
  timerKey: string;
  ready: boolean;
  failed: boolean;
};

export function storySlideNeedsMedia(slide: { kind: string } | null | undefined): boolean {
  return slide?.kind === "media";
}

export function createStoryMediaReadyState(
  timerKey: string,
  needsMedia: boolean
): StoryMediaReadyState {
  return { timerKey, ready: !needsMedia, failed: false };
}

export function applyStoryMediaReady(state: StoryMediaReadyState): StoryMediaReadyState {
  return { ...state, ready: true, failed: false };
}

export function applyStoryMediaFailed(state: StoryMediaReadyState): StoryMediaReadyState {
  return { ...state, ready: false, failed: true };
}

export function retryStoryMediaReady(
  state: StoryMediaReadyState,
  needsMedia: boolean
): StoryMediaReadyState {
  return createStoryMediaReadyState(state.timerKey, needsMedia);
}

export function shouldStartStoryProgressTimer(input: {
  visible: boolean;
  hasStory: boolean;
  mediaReady: boolean;
  mediaFailed: boolean;
  autoAdvancePaused: boolean;
}): boolean {
  return (
    input.visible &&
    input.hasStory &&
    input.mediaReady &&
    !input.mediaFailed &&
    !input.autoAdvancePaused
  );
}

export function isAuthorizedStoryMediaUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  if (url.startsWith(STORY_PRIVATE_MEDIA_PREFIX)) return false;
  return /^(https?:|blob:|data:image\/)/i.test(url);
}

export function collectAuthorizedStoryPreloadUrls(
  slides: Array<{ kind: string; url?: string; thumbnailUrl?: string | null }>,
  currentIndex: number
): string[] {
  const urls: string[] = [];
  for (const index of [currentIndex, currentIndex + 1]) {
    const slide = slides[index];
    if (!slide || slide.kind !== "media") continue;
    if (isAuthorizedStoryMediaUrl(slide.url)) urls.push(slide.url as string);
    if (isAuthorizedStoryMediaUrl(slide.thumbnailUrl)) urls.push(slide.thumbnailUrl as string);
  }
  return [...new Set(urls)];
}

export function collectViewerPreloadUrls(input: {
  currentSlides: Array<{ kind: string; url?: string; thumbnailUrl?: string | null }>;
  currentIndex: number;
  nextStoryFirstSlide?: { kind: string; url?: string; thumbnailUrl?: string | null };
}): string[] {
  const urls = collectAuthorizedStoryPreloadUrls(input.currentSlides, input.currentIndex);
  if (input.currentIndex >= input.currentSlides.length - 1 && input.nextStoryFirstSlide) {
    urls.push(...collectAuthorizedStoryPreloadUrls([input.nextStoryFirstSlide], 0));
  }
  return [...new Set(urls)];
}
