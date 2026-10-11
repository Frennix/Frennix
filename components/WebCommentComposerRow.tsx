import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from "react";
import {
  logCommentComposerHeightDiagnostics,
  logCommentsSheetRuntimeDiagnostics,
} from "@/lib/comments-sheet-runtime-diagnostics";

export const WEB_COMMENT_LINE_HEIGHT_PX = 22;
export const WEB_COMMENT_MAX_VISIBLE_LINES = 6;
export const WEB_COMMENT_FIELD_MIN_HEIGHT = 48;
/** Fallback six-line cap: 6 × 22px line-height + 12px + 12px padding. */
export const WEB_COMMENT_FIELD_MAX_HEIGHT =
  WEB_COMMENT_MAX_VISIBLE_LINES * WEB_COMMENT_LINE_HEIGHT_PX + 24;

export function computeWebCommentFieldMaxHeight(textarea?: HTMLTextAreaElement | null): number {
  if (!textarea || typeof window === "undefined") return WEB_COMMENT_FIELD_MAX_HEIGHT;
  const style = window.getComputedStyle(textarea);
  const lineHeight = Number.parseFloat(style.lineHeight);
  const padding =
    (Number.parseFloat(style.paddingTop) || 0) + (Number.parseFloat(style.paddingBottom) || 0);
  const border =
    (Number.parseFloat(style.borderTopWidth) || 0) + (Number.parseFloat(style.borderBottomWidth) || 0);
  const resolvedLine = Number.isFinite(lineHeight) && lineHeight > 0 ? lineHeight : WEB_COMMENT_LINE_HEIGHT_PX;
  return Math.ceil(WEB_COMMENT_MAX_VISIBLE_LINES * resolvedLine + padding + border);
}

/** Unconstrained content height. Parent overflow/contain must not participate. */
export function measureWebCommentContentHeight(textarea: HTMLTextAreaElement): number {
  if (typeof document === "undefined") return textarea.scrollHeight;

  const style = window.getComputedStyle(textarea);
  const probe = document.createElement("textarea");
  probe.value = textarea.value;
  probe.rows = 1;
  probe.setAttribute("data-frennix-comment-measure-probe", "true");
  probe.setAttribute("aria-hidden", "true");
  probe.tabIndex = -1;
  probe.style.cssText = [
    "position:absolute",
    "left:-9999px",
    "top:0",
    "height:auto",
    "min-height:0",
    "max-height:none",
    "overflow:hidden",
    "visibility:hidden",
    "pointer-events:none",
    `width:${Math.max(textarea.clientWidth, 1)}px`,
    `font-size:${style.fontSize}`,
    `line-height:${style.lineHeight}`,
    `font-family:${style.fontFamily}`,
    `font-weight:${style.fontWeight}`,
    `letter-spacing:${style.letterSpacing}`,
    `padding:${style.paddingTop} ${style.paddingRight} ${style.paddingBottom} ${style.paddingLeft}`,
    "border:none",
    `box-sizing:${style.boxSizing}`,
    "white-space:pre-wrap",
    "word-wrap:break-word",
    "resize:none",
  ].join(";");
  document.body.appendChild(probe);
  const measured = probe.scrollHeight;
  probe.remove();

  const inPlace = textarea.scrollHeight;
  return Math.max(measured, inPlace);
}

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
  /** Instagram-style Reel bar — no avatar, input + Send only. */
  hideAvatar?: boolean;
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

function setTextareaBox(
  textarea: HTMLTextAreaElement,
  height: string,
  overflowY: "hidden" | "auto"
): void {
  textarea.style.setProperty("height", height, "important");
  textarea.style.setProperty("min-height", height === "auto" ? "0px" : height, "important");
  textarea.style.setProperty("overflow-y", overflowY, "important");
}

function releaseFieldWrapperClip(fieldWrapper: HTMLElement, maxHeight: number): void {
  fieldWrapper.style.setProperty("height", "auto", "important");
  fieldWrapper.style.setProperty("min-height", `${WEB_COMMENT_FIELD_MIN_HEIGHT}px`, "important");
  fieldWrapper.style.setProperty("max-height", "none", "important");
  fieldWrapper.style.setProperty("overflow", "visible", "important");
  fieldWrapper.style.setProperty("contain", "none", "important");
  fieldWrapper.style.setProperty("flex-shrink", "0", "important");
  fieldWrapper.style.setProperty("--comment-field-max-height", `${maxHeight}px`);
}

export function resetWebCommentFieldHeight(
  textarea: HTMLTextAreaElement,
  fieldWrapper: HTMLElement
): number {
  const maxHeight = computeWebCommentFieldMaxHeight(textarea);
  textarea.scrollTop = 0;
  releaseFieldWrapperClip(fieldWrapper, maxHeight);
  fieldWrapper.style.setProperty("--comment-field-height", `${WEB_COMMENT_FIELD_MIN_HEIGHT}px`);
  setTextareaBox(textarea, `${WEB_COMMENT_FIELD_MIN_HEIGHT}px`, "hidden");
  textarea.style.setProperty("max-height", `${maxHeight}px`, "important");
  return WEB_COMMENT_FIELD_MIN_HEIGHT;
}

export function syncWebCommentFieldHeight(
  textarea: HTMLTextAreaElement,
  fieldWrapper: HTMLElement
): number {
  const maxHeight = computeWebCommentFieldMaxHeight(textarea);
  releaseFieldWrapperClip(fieldWrapper, maxHeight);
  setTextareaBox(textarea, "auto", "hidden");
  textarea.style.setProperty("max-height", "none", "important");

  const measuredScrollHeight = measureWebCommentContentHeight(textarea);
  const nextHeight = Math.max(
    WEB_COMMENT_FIELD_MIN_HEIGHT,
    Math.min(measuredScrollHeight, maxHeight)
  );

  fieldWrapper.style.setProperty("--comment-field-height", `${nextHeight}px`);
  textarea.style.setProperty("max-height", `${maxHeight}px`, "important");
  setTextareaBox(textarea, `${nextHeight}px`, measuredScrollHeight > maxHeight ? "auto" : "hidden");

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
  hideAvatar = false,
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
    if (hideAvatar) {
      logCommentComposerHeightDiagnostics("composer-height", textarea, fieldWrapper, nextHeight);
    }
    onLayoutChange?.();
  }, [hideAvatar, onLayoutChange, value]);

  useLayoutEffect(() => {
    applyFieldHeight();
  }, [applyFieldHeight]);

  useLayoutEffect(() => {
    const fieldWrapper = fieldWrapperRef.current;
    if (!fieldWrapper || typeof ResizeObserver === "undefined") return;
    let lastWidth = fieldWrapper.getBoundingClientRect().width;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? lastWidth;
      if (Math.abs(width - lastWidth) < 1) return;
      lastWidth = width;
      applyFieldHeight();
    });
    observer.observe(fieldWrapper);
    return () => observer.disconnect();
  }, [applyFieldHeight]);

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChangeText(event.target.value);
    const fieldWrapper = fieldWrapperRef.current;
    if (!fieldWrapper) return;

    const nextHeight = !event.target.value.trim()
      ? resetWebCommentFieldHeight(event.target, fieldWrapper)
      : syncWebCommentFieldHeight(event.target, fieldWrapper);
    setFieldHeight(nextHeight);
    if (hideAvatar) {
      logCommentComposerHeightDiagnostics("composer-change", event.target, fieldWrapper, nextHeight);
    }
    onLayoutChange?.();
  };

  const canPost = Boolean(value.trim()) && !posting;
  const initials = readAvatarInitials(avatarName);

  const focusInput = () => {
    textareaRef.current?.focus({ preventScroll: true });
  };

  return (
    <div
      ref={resolvedRowRef}
      data-web-comment-composer-row="true"
      {...(hideAvatar ? ({ "data-frennix-reel-comment-composer": "true" } as const) : null)}
      {...(overlay ? ({ "data-video-overlay-composer": "true" } as const) : null)}
      style={
        hideAvatar
          ? {
              display: "flex",
              flexDirection: "row",
              alignItems: "flex-end",
              width: "100%",
              minHeight: 44,
              height: "auto",
              flexShrink: 0,
              background: "transparent",
            }
          : undefined
      }
      onPointerUp={(event) => {
        const target = event.target as HTMLElement | null;
        if (target?.closest("button")) return;
        focusInput();
      }}
    >
      {hideAvatar ? null : avatarUri ? (
        <img src={avatarUri} alt={avatarName ?? "You"} />
      ) : (
        <span
          aria-hidden="true"
          style={{
            flex: "0 0 36px",
            width: 36,
            height: 36,
            maxWidth: 36,
            maxHeight: 36,
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
        style={{
          "--comment-field-height": `${fieldHeight}px`,
          ...(hideAvatar
            ? {
                display: "flex",
                flexDirection: "row",
                alignItems: "flex-end",
                flex: "1 1 auto",
                flexShrink: 0,
                minWidth: 0,
                height: "auto",
                overflow: "visible",
                background: "#1b1b1e",
                borderRadius: 24,
                border: "1px solid #34343a",
              }
            : null),
        } as React.CSSProperties}
        onPointerUp={focusInput}
      >
        <textarea
          ref={textareaRef}
          rows={1}
          enterKeyHint="enter"
          inputMode="text"
          data-frennix-comment-input="true"
          value={value}
          placeholder={placeholder}
          autoComplete="off"
          autoCorrect="on"
          spellCheck={true}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing && event.shiftKey === false) {
              event.stopPropagation();
            }
          }}
          onChange={handleChange}
          onFocus={() => {
            onFocus?.();
            onLayoutChange?.();
            if (hideAvatar) {
              logCommentsSheetRuntimeDiagnostics("composer-focus");
            }
          }}
          onBlur={() => {
            onBlur?.();
            onLayoutChange?.();
            if (hideAvatar) {
              logCommentsSheetRuntimeDiagnostics("composer-blur");
            }
          }}
          style={
            hideAvatar
              ? {
                  appearance: "none",
                  WebkitAppearance: "none",
                  background: "transparent",
                  color: "#fff",
                  colorScheme: "dark",
                  flex: "1 1 auto",
                  minWidth: 0,
                  width: "auto",
                  border: 0,
                  outline: 0,
                  resize: "none",
                  fontSize: 16,
                  lineHeight: "22px",
                  padding: "11px 12px",
                }
              : undefined
          }
        />
        {hideAvatar ? (
          <button
            type="button"
            data-frennix-comment-send="true"
            disabled={!canPost}
            onClick={onPost}
            style={{
              appearance: "none",
              WebkitAppearance: "none",
              background: "transparent",
              border: 0,
              color: canPost ? "#20d760" : "#71717a",
              fontSize: 16,
              fontWeight: 700,
              minHeight: 44,
              minWidth: 52,
              padding: "0 14px 0 8px",
              flex: "0 0 auto",
              alignSelf: "flex-end",
            }}
          >
            Send
          </button>
        ) : null}
      </div>
      {hideAvatar ? null : (
        <button
          type="button"
          data-frennix-comment-send="true"
          disabled={!canPost}
          onClick={onPost}
        >
          Post
        </button>
      )}
    </div>
  );
}
