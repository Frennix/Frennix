/**
 * Temporary iPhone Safari diagnostics for the comment composer rectangle / clip bug.
 * Remove after the opaque layer node is identified and fixed.
 */
import { Platform } from "react-native";
import { isMobileWeb } from "@/lib/safari-visual-viewport";

export function commentComposerDomDiagEnabled(): boolean {
  return Platform.OS === "web" && isMobileWeb();
}

export type CommentComposerDomNodeSnapshot = {
  tagName: string;
  id: string | null;
  className: string | null;
  dataAttributes: Record<string, string>;
  backgroundColor: string;
  borderRadius: string;
  overflow: string;
  overflowY: string;
  position: string;
  height: string;
  clientHeight: number | null;
  scrollHeight: number | null;
  padding: string;
  boxSizing: string;
  rect: { top: number; left: number; width: number; height: number } | null;
  parent: {
    tagName: string;
    className: string | null;
    dataAttributes: Record<string, string>;
  } | null;
};

export type CommentComposerDomInspectContext = {
  maxOuterHeight?: number;
  nextOuterHeight?: number;
  exceedsVisibleLines?: boolean;
};

function readDataAttributes(element: Element): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const attr of Array.from(element.attributes)) {
    if (attr.name.startsWith("data-")) attrs[attr.name] = attr.value;
  }
  return attrs;
}

export function snapshotCommentComposerDomNode(
  element: Element | null | undefined
): CommentComposerDomNodeSnapshot | null {
  if (!element || typeof window === "undefined") return null;

  const styles = window.getComputedStyle(element);
  const html = element as HTMLElement;
  const rect = html.getBoundingClientRect?.();
  const parent = element.parentElement;

  return {
    tagName: element.tagName.toLowerCase(),
    id: element.id || null,
    className: typeof element.className === "string" ? element.className || null : null,
    dataAttributes: readDataAttributes(element),
    backgroundColor: styles.backgroundColor,
    borderRadius: styles.borderRadius,
    overflow: styles.overflow,
    overflowY: styles.overflowY,
    position: styles.position,
    height: styles.height,
    clientHeight: "clientHeight" in html ? html.clientHeight : null,
    scrollHeight: "scrollHeight" in html ? html.scrollHeight : null,
    padding: styles.padding,
    boxSizing: styles.boxSizing,
    rect: rect
      ? {
          top: Math.round(rect.top),
          left: Math.round(rect.left),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        }
      : null,
    parent: parent
      ? {
          tagName: parent.tagName.toLowerCase(),
          className: typeof parent.className === "string" ? parent.className || null : null,
          dataAttributes: readDataAttributes(parent),
        }
      : null,
  };
}

function isOpaqueBackground(color: string): boolean {
  if (!color || color === "transparent" || color === "rgba(0, 0, 0, 0)") return false;
  const match = color.match(/rgba?\(([^)]+)\)/);
  if (!match) return true;
  const parts = match[1].split(",").map((part) => part.trim());
  if (parts.length === 4) {
    const alpha = Number.parseFloat(parts[3]);
    return Number.isFinite(alpha) ? alpha > 0.05 : true;
  }
  return true;
}

function collectOpaqueNodes(root: Element): CommentComposerDomNodeSnapshot[] {
  const opaque: CommentComposerDomNodeSnapshot[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let node = walker.currentNode as Element | null;
  while (node) {
    if (typeof window !== "undefined") {
      const bg = window.getComputedStyle(node).backgroundColor;
      if (isOpaqueBackground(bg)) {
        const snapshot = snapshotCommentComposerDomNode(node);
        if (snapshot) opaque.push(snapshot);
      }
    }
    node = walker.nextNode() as Element | null;
  }
  return opaque;
}

function buildAncestorChain(textarea: HTMLTextAreaElement): CommentComposerDomNodeSnapshot[] {
  const chain: CommentComposerDomNodeSnapshot[] = [];
  let current: Element | null = textarea;
  while (current) {
    const snapshot = snapshotCommentComposerDomNode(current);
    if (snapshot) chain.push(snapshot);
    if (current.matches('[data-frennix-comment-composer-row="true"]')) break;
    current = current.parentElement;
  }
  return chain;
}

function buildHitTargetSamples(textarea: HTMLTextAreaElement) {
  const rect = textarea.getBoundingClientRect();
  const samples = [
    { label: "typed-text-start", x: rect.left + 18, y: rect.top + 12 },
    { label: "textarea-center", x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
    { label: "textarea-top-left", x: rect.left + 2, y: rect.top + 2 },
    { label: "bubble-top-left", x: rect.left - 6, y: rect.top - 6 },
  ];

  return samples.map(({ label, x, y }) => ({
    label,
    x: Math.round(x),
    y: Math.round(y),
    hit: snapshotCommentComposerDomNode(document.elementFromPoint(x, y)),
  }));
}

function isCommentComposerAtMaxHeight(
  textarea: HTMLTextAreaElement,
  context?: CommentComposerDomInspectContext
): boolean {
  const maxOuterHeight = context?.maxOuterHeight;
  if (maxOuterHeight == null) {
    return textarea.clientHeight >= 120;
  }
  const outerHeight = context.nextOuterHeight ?? textarea.clientHeight;
  return context.exceedsVisibleLines === true || outerHeight >= maxOuterHeight - 1;
}

function shouldAutoLogCommentComposerDom(
  reason: string,
  textarea: HTMLTextAreaElement,
  context?: CommentComposerDomInspectContext
): boolean {
  if (reason === "composer-visible" || reason === "focus") return true;
  return isCommentComposerAtMaxHeight(textarea, context);
}

function buildCommentComposerDomReport(
  textarea: HTMLTextAreaElement,
  reason: string,
  context?: CommentComposerDomInspectContext
): Record<string, unknown> {
  const wrap = textarea.closest('[data-frennix-comment-input-wrap="true"]');
  const field = textarea.closest('[data-frennix-comment-composer-field="true"]');
  const row = textarea.closest('[data-frennix-comment-composer-row="true"]');
  const hitTargets = buildHitTargetSamples(textarea);

  return {
    reason,
    atMaxHeight: isCommentComposerAtMaxHeight(textarea, context),
    maxOuterHeight: context?.maxOuterHeight ?? null,
    nextOuterHeight: context?.nextOuterHeight ?? null,
    exceedsVisibleLines: context?.exceedsVisibleLines ?? null,
    textarea: snapshotCommentComposerDomNode(textarea),
    wrapper: snapshotCommentComposerDomNode(wrap),
    composerField: snapshotCommentComposerDomNode(field),
    ancestorChain: buildAncestorChain(textarea),
    hitTargets,
    typedTextStartHit:
      hitTargets.find((target) => target.label === "typed-text-start")?.hit ?? null,
    opaqueNodesInComposerRow: row ? collectOpaqueNodes(row) : [],
    textareaScroll: {
      valueLength: textarea.value.length,
      scrollTop: textarea.scrollTop,
      clientHeight: textarea.clientHeight,
      scrollHeight: textarea.scrollHeight,
      selectionStart: textarea.selectionStart,
      selectionEnd: textarea.selectionEnd,
    },
  };
}

function emitCommentComposerDomPing(
  reason: string,
  textarea: HTMLTextAreaElement,
  context?: CommentComposerDomInspectContext
): void {
  if (typeof console === "undefined") return;
  console.info("[comment-composer-dom-ping]", {
    reason,
    valueLength: textarea.value.length,
    clientHeight: textarea.clientHeight,
    scrollHeight: textarea.scrollHeight,
    atMaxHeight: isCommentComposerAtMaxHeight(textarea, context),
  });
}

function emitCommentComposerDomReport(
  textarea: HTMLTextAreaElement,
  reason: string,
  context?: CommentComposerDomInspectContext
): void {
  const report = buildCommentComposerDomReport(textarea, reason, context);
  console.info("[comment-composer-dom]", report);
}

export function autoInspectCommentComposerDom(
  textarea: HTMLTextAreaElement | null | undefined,
  reason: string,
  context?: CommentComposerDomInspectContext
): void {
  if (!commentComposerDomDiagEnabled() || !textarea || typeof document === "undefined") return;
  if (!textarea.isConnected) return;

  emitCommentComposerDomPing(reason, textarea, context);

  if (!shouldAutoLogCommentComposerDom(reason, textarea, context)) return;

  const run = () => {
    if (!textarea.isConnected) return;
    try {
      emitCommentComposerDomReport(textarea, reason, context);
    } catch (error) {
      console.warn("[comment-composer-dom-error]", { reason, error });
    }
  };

  if (typeof requestAnimationFrame === "undefined") {
    run();
    return;
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(run);
  });
}

export function inspectCommentComposerDom(
  textarea: HTMLTextAreaElement | null | undefined,
  reason: string,
  context?: CommentComposerDomInspectContext
): Record<string, unknown> | null {
  if (!commentComposerDomDiagEnabled() || !textarea || typeof document === "undefined") return null;
  try {
    const report = buildCommentComposerDomReport(textarea, reason, context);
    console.info("[comment-composer-dom]", report);
    return report;
  } catch (error) {
    console.warn("[comment-composer-dom-error]", { reason, error });
    return null;
  }
}

export function inspectCommentComposerAtPoint(x: number, y: number): Record<string, unknown> {
  if (typeof document === "undefined") return { error: "document-unavailable" };

  const hit = document.elementFromPoint(x, y);
  const report = {
    x,
    y,
    hit: snapshotCommentComposerDomNode(hit),
    hitAncestors: [] as Array<CommentComposerDomNodeSnapshot | null>,
  };

  let current = hit;
  while (current) {
    report.hitAncestors.push(snapshotCommentComposerDomNode(current));
    if (current.matches('[data-frennix-comment-composer-row="true"]')) break;
    current = current.parentElement;
  }

  console.info("[comment-composer-dom-at-point]", report);
  return report;
}

export function installCommentComposerDomInspectors(): void {
  if (!commentComposerDomDiagEnabled() || typeof window === "undefined") return;

  const globalWindow = window as Window & {
    __frennixInspectCommentComposer?: () => unknown;
    __frennixInspectCommentComposerAtPoint?: (x: number, y: number) => unknown;
  };

  globalWindow.__frennixInspectCommentComposer = () => {
    const textarea = document.querySelector(
      'textarea[data-frennix-comment-input="true"]'
    ) as HTMLTextAreaElement | null;
    return inspectCommentComposerDom(textarea, "manual-console");
  };

  globalWindow.__frennixInspectCommentComposerAtPoint = (x: number, y: number) =>
    inspectCommentComposerAtPoint(x, y);
}
