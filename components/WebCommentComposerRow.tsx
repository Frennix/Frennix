import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from "react";

export const WEB_COMMENT_FIELD_MIN_HEIGHT = 48;
export const WEB_COMMENT_FIELD_MAX_HEIGHT = 114;

export type WebCommentComposerRowProps = {
  value: string;
  placeholder: string;
  avatarUri?: string | null;
  avatarName?: string;
  posting: boolean;
  onChangeText: (text: string) => void;
  onPost: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  rowRef?: RefObject<HTMLDivElement>;
  onLayoutChange?: () => void;
  /** Portaled video overlay row — positioning handled by the parent portal. */
  overlay?: boolean;
};

function readAvatarInitials(name?: string): string {
  return (
    name
      ?.split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ?? "?"
  );
}

export function resetWebCommentFieldHeight(
  textarea: HTMLTextAreaElement,
  fieldWrapper: HTMLElement
): number {
  textarea.scrollTop = 0;
  textarea.style.height = "0px";
  textarea.style.overflowY = "hidden";
  fieldWrapper.style.setProperty("--comment-field-height", `${WEB_COMMENT_FIELD_MIN_HEIGHT}px`);
  textarea.style.height = "100%";
  return WEB_COMMENT_FIELD_MIN_HEIGHT;
}

export function syncWebCommentFieldHeight(
  textarea: HTMLTextAreaElement,
  fieldWrapper: HTMLElement
): number {
  textarea.style.height = "0px";
  const measuredScrollHeight = textarea.scrollHeight;
  const nextHeight = Math.max(
    WEB_COMMENT_FIELD_MIN_HEIGHT,
    Math.min(measuredScrollHeight, WEB_COMMENT_FIELD_MAX_HEIGHT)
  );

  fieldWrapper.style.setProperty("--comment-field-height", `${nextHeight}px`);
  textarea.style.height = "100%";
  textarea.style.overflowY =
    measuredScrollHeight > WEB_COMMENT_FIELD_MAX_HEIGHT ? "auto" : "hidden";

  return nextHeight;
}

/** Shared native HTML comment composer row for mobile web. */
export function WebCommentComposerRow({
  value,
  placeholder,
  avatarUri,
  avatarName,
  posting,
  onChangeText,
  onPost,
  onFocus,
  onBlur,
  rowRef,
  onLayoutChange,
  overlay = false,
}: WebCommentComposerRowProps) {
  const internalRowRef = useRef<HTMLDivElement>(null);
  const fieldWrapperRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [fieldHeight, setFieldHeight] = useState(WEB_COMMENT_FIELD_MIN_HEIGHT);

  const resolvedRowRef = rowRef ?? internalRowRef;

  const applyFieldHeight = useCallback(() => {
    const textarea = textareaRef.current;
    const fieldWrapper = fieldWrapperRef.current;
    if (!textarea || !fieldWrapper) return;

    const nextHeight = !value.trim()
      ? resetWebCommentFieldHeight(textarea, fieldWrapper)
      : syncWebCommentFieldHeight(textarea, fieldWrapper);
    setFieldHeight(nextHeight);
    onLayoutChange?.();
  }, [onLayoutChange, value]);

  useLayoutEffect(() => {
    applyFieldHeight();
  }, [applyFieldHeight]);

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChangeText(event.target.value);
    const fieldWrapper = fieldWrapperRef.current;
    if (!fieldWrapper) return;

    const nextHeight = !event.target.value.trim()
      ? resetWebCommentFieldHeight(event.target, fieldWrapper)
      : syncWebCommentFieldHeight(event.target, fieldWrapper);
    setFieldHeight(nextHeight);
    onLayoutChange?.();
  };

  const canPost = Boolean(value.trim()) && !posting;
  const initials = readAvatarInitials(avatarName);

  return (
    <div
      ref={resolvedRowRef}
      {...(overlay
        ? ({ "data-video-overlay-composer": "true" } as const)
        : ({ "data-web-comment-composer-row": "true" } as const))}
    >
      {avatarUri ? (
        <img src={avatarUri} alt={avatarName ?? "You"} />
      ) : (
        <span
          aria-hidden="true"
          style={{
            flex: "0 0 36px",
            width: 36,
            height: 36,
            borderRadius: "50%",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#14301f",
            color: "#20d760",
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          {initials}
        </span>
      )}
      <div
        ref={fieldWrapperRef}
        data-video-comment-field="true"
        style={{ "--comment-field-height": `${fieldHeight}px` } as React.CSSProperties}
      >
        <textarea
          ref={textareaRef}
          rows={1}
          enterKeyHint="enter"
          inputMode="text"
          value={value}
          placeholder={placeholder}
          autoComplete="off"
          autoCorrect="on"
          spellCheck={true}
          onChange={handleChange}
          onFocus={() => {
            onFocus?.();
            onLayoutChange?.();
          }}
          onBlur={() => {
            onBlur?.();
            onLayoutChange?.();
          }}
        />
      </div>
      <button type="button" disabled={!canPost} onClick={onPost}>
        Post
      </button>
    </div>
  );
}
