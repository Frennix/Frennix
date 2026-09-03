import type { Post } from "@frennix/types";
import type { FeedVideoFullscreenHandoff } from "@frennix/ui";
import type { ImmersiveVideoGalleryContext } from "@/lib/immersive-video-gallery";
import type { ImmersiveVideoPlaylistEntry } from "@/lib/immersive-video-playlist";

export type ImmersiveVideoPlaylistFetchResult = {
  entries: ImmersiveVideoPlaylistEntry[];
  hasMore: boolean;
};

export type ImmersiveVideoPlaylistState = {
  entries: ImmersiveVideoPlaylistEntry[];
  initialIndex: number;
  initialHandoff?: FeedVideoFullscreenHandoff;
  initialHandoffPlaybackId?: string;
  hasMore: boolean;
  getPost: (postId: string) => Post | undefined;
  buildImmersiveContext: (post: Post) => ImmersiveVideoGalleryContext | undefined;
  fetchMore?: () => Promise<ImmersiveVideoPlaylistFetchResult>;
  /** Original tapped post media index — restored to feed carousel on close. */
  originMediaIndex: number;
};
