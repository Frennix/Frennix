import { memo, type ReactNode } from "react";
import { View } from "react-native";
import type { PostType } from "@frennix/types";
import { FeedMediaSlot } from "../FeedMediaSlot";
import { FeedLayout } from "./FeedLayout";

export type FeedMediaProps = {
  mediaUrls: string[];
  postType?: PostType;
  thumbnailUrl?: string | null;
  onMediaPress?: (uri: string, index: number) => void;
  pageIndex?: number;
  onPageIndexChange?: (index: number) => void;
  /** Defer heavy media until the row is near the viewport. */
  visible?: boolean;
  /** Scope id for feed video playback coordination (typically post id). */
  playbackScopeId?: string;
  /** Inset embedded card (shared posts) instead of edge-to-edge. */
  embedded?: boolean;
  /** Extension: overlay on media — premium gate, play badge, ad marker. */
  overlay?: ReactNode;
  onPrimaryMediaReady?: (source: "image" | "video") => void;
};

/**
 * Canonical feed media component — every feed post type must mount media through this.
 * Applies FeedLayout shell spacing + deferred loading + aspect-preserving carousel/video.
 */
export const FeedMedia = memo(function FeedMedia({
  mediaUrls,
  postType,
  thumbnailUrl,
  onMediaPress,
  pageIndex,
  onPageIndexChange,
  visible = true,
  playbackScopeId,
  embedded = false,
  overlay,
  onPrimaryMediaReady,
}: FeedMediaProps) {
  if (!mediaUrls.length) return null;

  return (
    <FeedLayout.Media embedded={embedded}>
      <View style={styles.mediaShell}>
        <FeedMediaSlot
          mediaUrls={mediaUrls}
          postType={postType}
          thumbnailUrl={thumbnailUrl}
          onMediaPress={onMediaPress}
          pageIndex={pageIndex}
          onPageIndexChange={onPageIndexChange}
          visible={visible}
          playbackScopeId={playbackScopeId}
          onPrimaryMediaReady={onPrimaryMediaReady}
        />
        {overlay ? <FeedLayout.MediaOverlay>{overlay}</FeedLayout.MediaOverlay> : null}
      </View>
    </FeedLayout.Media>
  );
});

const styles = {
  mediaShell: {
    width: "100%" as const,
    position: "relative" as const,
  },
};
