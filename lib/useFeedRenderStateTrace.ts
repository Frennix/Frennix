import { useEffect } from "react";
import { markFeedRender } from "@/lib/feed-render-trace";

type FeedRenderState = {
  userId: string;
  storiesCount: number;
  postsCount: number;
  listRowsCount: number;
  isLoading: boolean;
  isFeedReady: boolean;
  isError: boolean;
  isStoriesLoading: boolean;
  suggestionsCount: number;
  branch: "scroll-test" | "error" | "main";
};

/** Logs feed data/query transitions after feed-route mount (production path). */
export function useFeedRenderStateTrace(state: FeedRenderState) {
  useEffect(() => {
    markFeedRender("feed:data:stories", "data", `count=${state.storiesCount}`);
  }, [state.storiesCount]);

  useEffect(() => {
    markFeedRender(
      "feed:data:feed-query",
      "data",
      `loading=${state.isLoading} ready=${state.isFeedReady} posts=${state.postsCount} rows=${state.listRowsCount} error=${state.isError}`
    );
  }, [state.isError, state.isFeedReady, state.isLoading, state.listRowsCount, state.postsCount]);

  useEffect(() => {
    markFeedRender("feed:data:suggestions", "data", `count=${state.suggestionsCount}`);
  }, [state.suggestionsCount]);

  useEffect(() => {
    markFeedRender(`feed:branch:${state.branch}`, "data");
  }, [state.branch]);

  useEffect(() => {
    if (!state.userId) return;
    markFeedRender("feed:HomeScreen:mounted", "effect", `user=${state.userId.slice(0, 8)}`);
  }, [state.userId]);
}
