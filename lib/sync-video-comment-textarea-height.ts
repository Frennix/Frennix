export const VIDEO_COMMENT_LINE_HEIGHT_PX = 22;
export const VIDEO_COMMENT_MAX_LINES = 4;
export const VIDEO_COMMENT_VERTICAL_PADDING_PX = 20;
export const VIDEO_COMMENT_MAX_TEXTAREA_HEIGHT_PX =
  VIDEO_COMMENT_LINE_HEIGHT_PX * VIDEO_COMMENT_MAX_LINES + VIDEO_COMMENT_VERTICAL_PADDING_PX;

/** Autosize the video comment textarea to at most 4 lines, then scroll internally. */
export function syncVideoCommentTextareaHeight(textarea: HTMLTextAreaElement): number {
  textarea.style.setProperty("box-sizing", "border-box", "important");
  textarea.style.setProperty("height", "auto", "important");

  const nextHeight = Math.min(textarea.scrollHeight, VIDEO_COMMENT_MAX_TEXTAREA_HEIGHT_PX);

  textarea.style.setProperty("height", `${nextHeight}px`, "important");
  textarea.style.setProperty("max-height", `${VIDEO_COMMENT_MAX_TEXTAREA_HEIGHT_PX}px`, "important");
  textarea.style.setProperty(
    "overflow-y",
    textarea.scrollHeight > VIDEO_COMMENT_MAX_TEXTAREA_HEIGHT_PX ? "auto" : "hidden",
    "important"
  );

  return nextHeight;
}
