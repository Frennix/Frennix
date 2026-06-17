import { InteractionManager } from "react-native";
import { router, type Href } from "expo-router";

/** Run navigation after current touch/animation work finishes so presses feel instant. */
export function deferNavigation(action: () => void) {
  InteractionManager.runAfterInteractions(action);
}

export function navigateTo(href: Href) {
  deferNavigation(() => {
    router.push(href);
  });
}

/** Wraps a handler so rapid double-taps are ignored. */
export function guardDoublePress<T extends (...args: never[]) => void>(
  handler: T,
  cooldownMs = 450
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
