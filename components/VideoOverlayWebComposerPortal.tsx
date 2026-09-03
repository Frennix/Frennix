import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { WebCommentComposerRow, type WebCommentComposerRowProps } from "@/components/WebCommentComposerRow";

export type VideoOverlayWebComposerPortalProps = WebCommentComposerRowProps;

const COMPOSER_CLEARANCE_PX = 12;

function applyComposerPosition(composerRow: HTMLElement): void {
  const viewport = window.visualViewport;
  const visibleBottom = viewport
    ? viewport.pageTop + viewport.height
    : window.scrollY + window.innerHeight;
  const composerTop = visibleBottom - composerRow.offsetHeight - COMPOSER_CLEARANCE_PX;

  composerRow.style.top = `${composerTop}px`;
  composerRow.style.bottom = "auto";
}

/** Web-only portaled composer for the immersive video comments overlay. */
export function VideoOverlayWebComposerPortal(props: VideoOverlayWebComposerPortalProps) {
  const composerRowRef = useRef<HTMLDivElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const focusBlurTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const focusBlurFrameRef = useRef<number | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(typeof document !== "undefined");
  }, []);

  const recalcComposerPosition = useCallback(() => {
    const composerRow = composerRowRef.current;
    if (!composerRow) return;
    applyComposerPosition(composerRow);
  }, []);

  const clearFocusBlurSchedules = useCallback(() => {
    if (focusBlurFrameRef.current != null) {
      cancelAnimationFrame(focusBlurFrameRef.current);
      focusBlurFrameRef.current = null;
    }
    focusBlurTimersRef.current.forEach(clearTimeout);
    focusBlurTimersRef.current = [];
  }, []);

  const scheduleComposerPositionRecalculation = useCallback(() => {
    clearFocusBlurSchedules();
    recalcComposerPosition();
    focusBlurFrameRef.current = requestAnimationFrame(() => {
      recalcComposerPosition();
      focusBlurFrameRef.current = null;
    });
    focusBlurTimersRef.current.push(
      setTimeout(() => {
        recalcComposerPosition();
      }, 100)
    );
    focusBlurTimersRef.current.push(
      setTimeout(() => {
        recalcComposerPosition();
      }, 300)
    );
  }, [clearFocusBlurSchedules, recalcComposerPosition]);

  useLayoutEffect(() => {
    if (!mounted) return;

    recalcComposerPosition();

    const composerRow = composerRowRef.current;
    if (composerRow && typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(() => {
        recalcComposerPosition();
      });
      observer.observe(composerRow);
      resizeObserverRef.current = observer;
    }

    return () => {
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
    };
  }, [mounted, recalcComposerPosition]);

  useEffect(() => {
    if (!mounted) return;

    const onViewportChange = () => {
      recalcComposerPosition();
    };

    window.addEventListener("scroll", onViewportChange, { passive: true });
    window.visualViewport?.addEventListener("resize", onViewportChange);
    window.visualViewport?.addEventListener("scroll", onViewportChange);

    return () => {
      window.removeEventListener("scroll", onViewportChange);
      window.visualViewport?.removeEventListener("resize", onViewportChange);
      window.visualViewport?.removeEventListener("scroll", onViewportChange);
      clearFocusBlurSchedules();
    };
  }, [clearFocusBlurSchedules, mounted, recalcComposerPosition]);

  if (!mounted) {
    return null;
  }

  return createPortal(
    <WebCommentComposerRow
      {...props}
      overlay
      rowRef={composerRowRef}
      onFocus={() => {
        props.onFocus?.();
        scheduleComposerPositionRecalculation();
      }}
      onBlur={() => {
        props.onBlur?.();
        scheduleComposerPositionRecalculation();
      }}
      onLayoutChange={recalcComposerPosition}
    />,
    document.body
  );
}
