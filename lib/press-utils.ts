import { router, type Href } from "expo-router";
import type { FeedCategory } from "@frennix/types";
import { getSelectedHomeFeedTab } from "@/lib/selected-home-feed-tab";

/** Push a stack/modal screen immediately (no deferred queue). */
export function pushScreen(href: Href) {
  router.push(href);
}

/** Switch an existing bottom tab without stacking duplicate tab routes. */
export function switchTab(href: Href) {
  if (router.canDismiss()) {
    router.dismissAll();
  }
  router.navigate(href);
}

/** @deprecated Use pushScreen — kept for call-site compatibility. */
export function navigateTo(href: Href) {
  pushScreen(href);
}

/** Wraps a handler so rapid double-taps are ignored (short cooldown only). */
export function guardDoublePress<T extends (...args: never[]) => void>(
  handler: T,
  cooldownMs = 300
): T {
  let locked = false;

  return ((...args: Parameters<T>) => {
    if (locked) return;
    locked = true;
    handler(...args);
    setTimeout(() => {
      locked = false;
    }, cooldownMs);
  }) as T;
}

let createPostNavLocked = false;

type OpenCreatePostOptions = {
  /** Opens the existing create-post flow with Reels journey chrome. */
  intent?: "reel";
  /** Opens the composer with Workout, Nutrition, or General selected. */
  category?: FeedCategory;
};

/** Open create-post modal once per tap — never queued behind other navigation. */
export function openCreatePost(options?: OpenCreatePostOptions) {
  if (createPostNavLocked) return;
  createPostNavLocked = true;
  router.push({
    pathname: "/create-post",
    params: {
      intent: options?.intent === "reel" ? "reel" : "",
      category: options?.category ?? "",
    },
  });
  setTimeout(() => {
    createPostNavLocked = false;
  }, 400);
}

/** Bottom Post button. Nutrition stays selected so a second meal can be published. */
export function openCreatePostForCurrentFeed() {
  if (getSelectedHomeFeedTab() === "nutrition") {
    openCreatePost({ category: "nutrition" });
    return;
  }
  openCreatePost();
}

let createStoryNavLocked = false;

/** Open dedicated story creator. */
export function openCreateStory() {
  if (createStoryNavLocked) return;
  createStoryNavLocked = true;
  router.push("/create-story");
  setTimeout(() => {
    createStoryNavLocked = false;
  }, 400);
}
