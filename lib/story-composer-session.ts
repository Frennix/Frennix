let needsFreshStart = false;

/** The story still on screen stays filled. The next open starts empty. */
export function markStoryPublished() {
  needsFreshStart = true;
}

export function storyNeedsFreshStart() {
  return needsFreshStart;
}

export function consumeStoryFreshStart() {
  const needed = needsFreshStart;
  needsFreshStart = false;
  return needed;
}
