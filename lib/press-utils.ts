import { router, type Href } from "expo-router";
import { scheduleWebViewportNormalize } from "@/lib/web-viewport-normalize";

/** Push a stack/modal screen immediately (no deferred queue). */
export function pushScreen(href: Href) {
  router.push(href);
  scheduleWebViewportNormalize();
}

/** Switch an existing bottom tab without stacking duplicate tab routes. */
export function switchTab(href: Href) {
  if (router.canDismiss()) {
    router.dismissAll();
  }
  router.navigate(href);
  scheduleWebViewportNormalize();
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

/** Open create-post modal once per tap — never queued behind other navigation. */
export function openCreatePost() {
  if (createPostNavLocked) return;
  createPostNavLocked = true;
  router.push("/create-post");
  scheduleWebViewportNormalize();
  setTimeout(() => {
    createPostNavLocked = false;
  }, 400);
}

let createStoryNavLocked = false;

/** Open dedicated story creator. */
export function openCreateStory() {
  if (createStoryNavLocked) return;
  createStoryNavLocked = true;
  router.push("/create-story");
  scheduleWebViewportNormalize();
  setTimeout(() => {
    createStoryNavLocked = false;
  }, 400);
}
