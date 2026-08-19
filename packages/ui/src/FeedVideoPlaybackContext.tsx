import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type PauseHandler = () => void;

type FeedVideoPlaybackContextValue = {
  /** Global gate — false when Feed tab is unfocused or app is hidden. */
  playbackAllowed: boolean;
  activeVideoId: string | null;
  requestPlay: (videoId: string) => void;
  releaseDueToVisibility: (videoId: string) => void;
  isActive: (videoId: string) => boolean;
  registerPauseHandler: (videoId: string, pause: PauseHandler) => () => void;
};

const FeedVideoPlaybackContext = createContext<FeedVideoPlaybackContextValue | null>(null);

export type FeedVideoPlaybackProviderProps = {
  children: ReactNode;
  /** Pass false when leaving the Feed tab or when the app/browser is hidden. */
  playbackAllowed?: boolean;
};

export function FeedVideoPlaybackProvider({
  children,
  playbackAllowed = true,
}: FeedVideoPlaybackProviderProps) {
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const pauseHandlersRef = useRef<Map<string, PauseHandler>>(new Map());

  const pauseAllMedia = useCallback(() => {
    pauseHandlersRef.current.forEach((pause) => {
      pause();
    });
    setActiveVideoId(null);
  }, []);

  const pauseOtherMedia = useCallback((exceptVideoId: string) => {
    pauseHandlersRef.current.forEach((pause, videoId) => {
      if (videoId !== exceptVideoId) pause();
    });
  }, []);

  useEffect(() => {
    if (!playbackAllowed) {
      pauseAllMedia();
    }
  }, [playbackAllowed, pauseAllMedia]);

  const registerPauseHandler = useCallback((videoId: string, pause: PauseHandler) => {
    pauseHandlersRef.current.set(videoId, pause);
    return () => {
      const current = pauseHandlersRef.current.get(videoId);
      if (current === pause) {
        pauseHandlersRef.current.delete(videoId);
      }
    };
  }, []);

  const requestPlay = useCallback(
    (videoId: string) => {
      if (!playbackAllowed) return;
      pauseOtherMedia(videoId);
      setActiveVideoId(videoId);
    },
    [playbackAllowed, pauseOtherMedia]
  );

  const releaseDueToVisibility = useCallback((videoId: string) => {
    setActiveVideoId((current) => (current === videoId ? null : current));
  }, []);

  const isActive = useCallback(
    (videoId: string) => playbackAllowed && activeVideoId === videoId,
    [activeVideoId, playbackAllowed]
  );

  const value = useMemo(
    () => ({
      playbackAllowed,
      activeVideoId,
      requestPlay,
      releaseDueToVisibility,
      isActive,
      registerPauseHandler,
    }),
    [
      playbackAllowed,
      activeVideoId,
      requestPlay,
      releaseDueToVisibility,
      isActive,
      registerPauseHandler,
    ]
  );

  return (
    <FeedVideoPlaybackContext.Provider value={value}>{children}</FeedVideoPlaybackContext.Provider>
  );
}

export function useFeedVideoPlayback() {
  return useContext(FeedVideoPlaybackContext);
}

export function buildFeedVideoPlaybackId(scopeId: string, mediaIndex: number) {
  return `${scopeId}:${mediaIndex}`;
}
