import { useEffect, type ReactNode } from "react";
import { markFeedRender } from "@/lib/feed-render-trace";

interface FeedRenderTraceProbeProps {
  id: string;
  detail?: string;
  children?: ReactNode;
}

/** Records production feed subtree mount for optional dev traces. */
export function FeedRenderTraceProbe({ id, detail, children }: FeedRenderTraceProbeProps) {
  markFeedRender(`${id}:render`, "sync", detail);

  useEffect(() => {
    markFeedRender(id, "effect", detail);
  }, [id, detail]);

  return children ?? null;
}
