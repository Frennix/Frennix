import { getImmersiveSessionLayoutHeight } from "@/lib/immersive-session-layout";

type ElementDiag = {
  selector: string;
  mounted: boolean;
  count: number;
  bounds: { x: number; y: number; width: number; height: number } | null;
  styles: Record<string, string> | null;
  clipped: boolean;
  outsideViewport: boolean;
};

const SELECTORS = [
  '[data-frennix-comments-video-overlay="true"]',
  '[data-frennix-comments-sheet-surface="true"]',
  '[data-frennix-comments-sheet-header="true"]',
  '[data-frennix-comments-sheet-body="true"]',
  '[data-frennix-comments-list="true"]',
  '[data-frennix-comments-state="true"]',
  '[data-frennix-comment-composer-host="true"]',
  '[data-frennix-reel-comment-composer="true"]',
  '[data-web-comment-composer-row="true"]',
  '[data-web-comment-composer-row="true"] img',
  '[data-video-comment-field="true"]',
  'textarea[data-frennix-comment-input="true"]',
  '[data-frennix-comment-send="true"]',
] as const;

function readRect(node: Element | null): { x: number; y: number; width: number; height: number; top: number; bottom: number } | null {
  if (!(node instanceof HTMLElement)) return null;
  const rect = node.getBoundingClientRect();
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
    top: Math.round(rect.top),
    bottom: Math.round(rect.bottom),
  };
}

function readStyles(node: Element): Record<string, string> {
  const computed = window.getComputedStyle(node);
  return {
    display: computed.display,
    visibility: computed.visibility,
    opacity: computed.opacity,
    position: computed.position,
    zIndex: computed.zIndex,
    overflow: computed.overflow,
    overflowY: computed.overflowY,
    pointerEvents: computed.pointerEvents,
    height: computed.height,
    minHeight: computed.minHeight,
    maxHeight: computed.maxHeight,
    flex: computed.flex,
    backgroundColor: computed.backgroundColor,
    top: computed.top,
    bottom: computed.bottom,
    transform: computed.transform,
  };
}

function describeElement(selector: string): ElementDiag {
  const nodes = Array.from(document.querySelectorAll(selector));
  const node = nodes[0] ?? null;
  if (!node) {
    return {
      selector,
      mounted: false,
      count: 0,
      bounds: null,
      styles: null,
      clipped: false,
      outsideViewport: true,
    };
  }

  const rect = node.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  const outsideViewport =
    rect.bottom <= 0 ||
    rect.right <= 0 ||
    rect.top >= viewportHeight ||
    rect.left >= viewportWidth;
  const clipped = rect.width <= 1 || rect.height <= 1;

  return {
    selector,
    mounted: true,
    count: nodes.length,
    bounds: {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    },
    styles: readStyles(node),
    clipped,
    outsideViewport,
  };
}

function readAncestorHeightChain(start: HTMLElement | null, limit = 10) {
  const chain: Array<Record<string, string | number | null>> = [];
  let node: HTMLElement | null = start;
  while (node && chain.length < limit) {
    const computed = window.getComputedStyle(node);
    chain.push({
      tag: node.tagName.toLowerCase(),
      id: node.id || null,
      reelComposer: node.getAttribute("data-frennix-reel-comment-composer"),
      field: node.getAttribute("data-video-comment-field"),
      host: node.getAttribute("data-frennix-comment-composer-host"),
      sheet: node.getAttribute("data-frennix-comments-sheet-surface"),
      overlay: node.getAttribute("data-frennix-comments-video-overlay"),
      height: computed.height,
      minHeight: computed.minHeight,
      maxHeight: computed.maxHeight,
      overflow: computed.overflow,
      overflowY: computed.overflowY,
      flex: computed.flex,
      flexShrink: computed.flexShrink,
      flexBasis: computed.flexBasis,
      contain: computed.contain,
      boxSizing: computed.boxSizing,
      clientHeight: Math.round(node.clientHeight),
    });
    node = node.parentElement;
  }
  return chain;
}

export function logCommentComposerHeightDiagnostics(
  reason: string,
  textarea: HTMLTextAreaElement,
  fieldWrapper: HTMLElement,
  requestedHeight: number
) {
  if (typeof document === "undefined" || typeof window === "undefined") return;
  if (typeof __DEV__ !== "undefined" && !__DEV__) return;

  const style = window.getComputedStyle(textarea);
  const lineCount = textarea.value.split("\n").length;
  const report = {
    reason,
    requestedHeight,
    textarea: {
      valueLines: lineCount,
      scrollHeight: textarea.scrollHeight,
      clientHeight: textarea.clientHeight,
      offsetHeight: textarea.offsetHeight,
      inlineHeight: textarea.style.height,
      computedHeight: style.height,
      computedMaxHeight: style.maxHeight,
      computedMinHeight: style.minHeight,
      lineHeight: style.lineHeight,
      paddingTop: style.paddingTop,
      paddingBottom: style.paddingBottom,
      boxSizing: style.boxSizing,
      overflowY: style.overflowY,
    },
    field: {
      clientHeight: fieldWrapper.clientHeight,
      offsetHeight: fieldWrapper.offsetHeight,
      computedHeight: window.getComputedStyle(fieldWrapper).height,
      computedMaxHeight: window.getComputedStyle(fieldWrapper).maxHeight,
      overflow: window.getComputedStyle(fieldWrapper).overflow,
      contain: window.getComputedStyle(fieldWrapper).contain,
    },
    ancestors: readAncestorHeightChain(textarea),
  };
  (window as Window & { __FRENNIX_COMPOSER_HEIGHT_DIAG__?: unknown }).__FRENNIX_COMPOSER_HEIGHT_DIAG__ =
    report;
  console.info("[frennix-composer-height]", report);
}

export function logCommentsSheetRuntimeDiagnostics(reason: string, extra?: Record<string, unknown>) {
  if (typeof document === "undefined" || typeof window === "undefined") return;
  if (typeof __DEV__ !== "undefined" && !__DEV__) return;

  const vv = window.visualViewport;
  const rootStyles = getComputedStyle(document.documentElement);
  const overlay = document.querySelector('[data-frennix-comments-video-overlay="true"]');
  const sheet = document.querySelector('[data-frennix-comments-sheet-surface="true"]');
  const list = document.querySelector('[data-frennix-comments-sheet-body="true"]');
  const composer = document.querySelector('[data-frennix-comment-composer-host="true"]');
  const input = document.querySelector('textarea[data-frennix-comment-input="true"]');
  const overlayRect = readRect(overlay);
  const sheetRect = readRect(sheet);
  const listRect = readRect(list);
  const composerRect = readRect(composer);
  const inputRect = readRect(input);
  const visibleBottom = Math.round((vv?.height ?? window.innerHeight) + (vv?.offsetTop ?? 0));
  const overlayStyles = overlay instanceof HTMLElement ? getComputedStyle(overlay) : null;
  const sheetStyles = sheet instanceof HTMLElement ? getComputedStyle(sheet) : null;
  const inputEl = input instanceof HTMLTextAreaElement ? input : null;
  const report = {
    reason,
    at: new Date().toISOString(),
    extra: extra ?? null,
    invariants: {
      sheetBottomWithinVisible: sheetRect ? sheetRect.bottom <= visibleBottom + 1 : false,
      composerBottomWithinVisible: composerRect ? composerRect.bottom <= visibleBottom + 1 : false,
      sheetTopPlusHeightEqualsVisible:
        sheetRect && overlayRect
          ? Math.abs(sheetRect.top + sheetRect.height - visibleBottom) <= 2 ||
            Math.abs((overlayRect.top ?? 0) + (overlayRect.height ?? 0) - visibleBottom) <= 2
          : false,
    },
    focus: {
      inputMounted: Boolean(inputEl),
      inputDisabled: inputEl?.disabled ?? null,
      inputReadOnly: inputEl?.readOnly ?? null,
      activeTag: document.activeElement instanceof HTMLElement ? document.activeElement.tagName : null,
      activeIsCommentInput: document.activeElement === inputEl,
    },
    rects: {
      overlay: overlayRect,
      sheet: sheetRect,
      list: listRect,
      composer: composerRect,
      input: inputRect,
      overlayTop: overlayStyles?.top ?? null,
      overlayBottom: overlayStyles?.bottom ?? null,
      overlayHeight: overlayStyles?.height ?? null,
      sheetTop: sheetStyles?.top ?? null,
      sheetBottom: sheetStyles?.bottom ?? null,
      sheetHeight: sheetStyles?.height ?? null,
    },
    viewport: {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      sessionLayoutHeight: getImmersiveSessionLayoutHeight(),
      visualOffsetTop: vv?.offsetTop ?? null,
      visualOffsetLeft: vv?.offsetLeft ?? null,
      visualWidth: vv?.width ?? null,
      visualHeight: vv?.height ?? null,
      keyboardGuess:
        (getImmersiveSessionLayoutHeight() ?? window.innerHeight) - (vv?.height ?? window.innerHeight) > 140,
    },
    safeArea: {
      top: rootStyles.getPropertyValue("--frennix-safe-top").trim(),
      bottom: rootStyles.getPropertyValue("--frennix-safe-bottom").trim(),
    },
    elements: SELECTORS.map(describeElement),
  };

  (window as Window & { __FRENNIX_COMMENTS_DIAG__?: unknown }).__FRENNIX_COMMENTS_DIAG__ = report;
  console.info("[frennix-comments-diag]", report);
  return report;
}
