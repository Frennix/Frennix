import type { Post } from "@frennix/types";
import type { FeedVideoFullscreenHandoff } from "@frennix/ui";

/** Playback snapshot when leaving the immersive viewer for comments. */
export type VideoViewerPlaybackState = {
  mediaIndex: number;
  currentTime: number;
  muted: boolean;
  wasPlaying: boolean;
  playbackId?: string;
};

export type ImmersiveVideoPostActions = {
  post: Post;
  onLike: () => void;
  onRespect: () => void;
  /** Opens dedicated /comments/[postId] after saving viewer playback state. */
  onComment: (playback: VideoViewerPlaybackState, draft?: string) => void;
  onShare: () => void;
  onMore: () => void;
  onAuthorPress: () => void;
  onFollow?: () => void;
  showFollow?: boolean;
};

export type ImmersiveVideoGalleryContext = {
  postActions: ImmersiveVideoPostActions;
  /** Resume handoff when returning from the comments route. */
  resumeHandoff?: FeedVideoFullscreenHandoff;
};
