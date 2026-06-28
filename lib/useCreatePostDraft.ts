import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import type { ImagePickerAsset } from "expo-image-picker";
import {
  clearCreatePostDraft,
  peekMemoryDraft,
  readMediaBytesForDraft,
  restoreCreatePostDraft,
  saveCreatePostDraft,
  writeMemoryDraft,
  type CreatePostDraft,
} from "./create-post-draft";
import { logCreatePostError } from "./create-post-logging";

type RouteContext = {
  groupId?: string;
  challengeId?: string;
  eventId?: string;
};

export function useCreatePostDraft(userId: string | undefined, routeContext: RouteContext) {
  const memorySeed = userId ? peekMemoryDraft(userId) : undefined;

  const [hydrated, setHydrated] = useState(() => Boolean(memorySeed));
  const [content, setContent] = useState(() => memorySeed?.draft.content ?? "");
  const [workoutTypes, setWorkoutTypes] = useState<string[]>(() => memorySeed?.draft.workoutTypes ?? []);
  const [groupId, setGroupId] = useState<string | null>(() => memorySeed?.draft.groupId ?? null);
  const [challengeId, setChallengeId] = useState<string | null>(() => memorySeed?.draft.challengeId ?? null);
  const [eventId, setEventId] = useState<string | null>(() => memorySeed?.draft.eventId ?? null);
  const [mediaUri, setMediaUri] = useState<string | null>(() => memorySeed?.draft.mediaUri ?? null);
  const [mimeType, setMimeType] = useState(() => memorySeed?.draft.mimeType ?? "image/jpeg");
  const [pickedFile, setPickedFile] = useState<File | undefined>(() => memorySeed?.pickedFile);
  const [videoDurationSeconds, setVideoDurationSeconds] = useState<number | null>(
    () => memorySeed?.draft.videoDurationSeconds ?? null
  );

  const mediaBytesRef = useRef<ArrayBuffer | null>(memorySeed?.mediaBytes ?? null);
  const skipPersistRef = useRef(false);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydratedForUserRef = useRef<string | null>(memorySeed && userId ? userId : null);
  const routeAppliedRef = useRef(false);

  const buildDraft = useCallback((): CreatePostDraft => {
    return {
      content,
      workoutTypes,
      groupId,
      challengeId,
      eventId,
      mimeType,
      videoDurationSeconds,
      mediaUri,
      hasStoredMedia: Boolean(mediaBytesRef.current) || Boolean(mediaUri),
    };
  }, [content, workoutTypes, groupId, challengeId, eventId, mimeType, videoDurationSeconds, mediaUri]);

  const syncMemoryDraft = useCallback(() => {
    if (!userId) return;
    writeMemoryDraft(userId, buildDraft(), mediaBytesRef.current, pickedFile);
  }, [userId, buildDraft, pickedFile]);

  const flushDraft = useCallback(async () => {
    if (!userId || skipPersistRef.current) return;
    syncMemoryDraft();
    try {
      await saveCreatePostDraft(userId, buildDraft(), mediaBytesRef.current);
    } catch (error) {
      logCreatePostError("draft", error, { action: "flush" });
    }
  }, [userId, buildDraft, syncMemoryDraft]);

  const schedulePersist = useCallback(() => {
    if (!userId || !hydrated || skipPersistRef.current) return;
    syncMemoryDraft();
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      void flushDraft();
    }, 400);
  }, [userId, hydrated, flushDraft, syncMemoryDraft]);

  const applyRouteContext = useCallback(() => {
    if (routeAppliedRef.current) return;
    if (routeContext.groupId) setGroupId(routeContext.groupId);
    if (routeContext.challengeId) setChallengeId(routeContext.challengeId);
    if (routeContext.eventId) setEventId(routeContext.eventId);
    routeAppliedRef.current = true;
  }, [routeContext.groupId, routeContext.challengeId, routeContext.eventId]);

  const applyDraftState = useCallback(
    (draft: CreatePostDraft, restoredPickedFile?: File, mediaBytes?: ArrayBuffer | null) => {
      setContent(draft.content);
      setWorkoutTypes(draft.workoutTypes);
      setGroupId(draft.groupId);
      setChallengeId(draft.challengeId);
      setEventId(draft.eventId);
      setMimeType(draft.mimeType);
      setVideoDurationSeconds(draft.videoDurationSeconds);
      setMediaUri(draft.mediaUri);
      setPickedFile(restoredPickedFile);
      mediaBytesRef.current = mediaBytes ?? null;
    },
    []
  );

  useEffect(() => {
    if (!userId) {
      setHydrated(false);
      return;
    }

    if (hydratedForUserRef.current === userId) {
      return;
    }

    let cancelled = false;
    skipPersistRef.current = true;
    routeAppliedRef.current = false;

    const memory = peekMemoryDraft(userId);
    if (memory) {
      applyDraftState(memory.draft, memory.pickedFile, memory.mediaBytes);
      applyRouteContext();
      hydratedForUserRef.current = userId;
      skipPersistRef.current = false;
      setHydrated(true);
      return;
    }

    (async () => {
      try {
        const saved = await restoreCreatePostDraft(userId);
        if (cancelled) return;

        if (saved) {
          applyDraftState(saved, saved.pickedFile, null);
          if (saved.hasStoredMedia && saved.mediaUri) {
            if (saved.pickedFile) {
              mediaBytesRef.current = await saved.pickedFile.arrayBuffer();
            } else {
              mediaBytesRef.current = await readMediaBytesForDraft(saved.mediaUri, saved.mimeType);
            }
          }
          writeMemoryDraft(userId, saved, mediaBytesRef.current, saved.pickedFile);
        }

        applyRouteContext();
        hydratedForUserRef.current = userId;
        setHydrated(true);
      } catch (error) {
        logCreatePostError("draft", error, { action: "restore" });
        applyRouteContext();
        hydratedForUserRef.current = userId;
        setHydrated(true);
      } finally {
        if (!cancelled) skipPersistRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
  }, [userId, applyDraftState, applyRouteContext]);

  useEffect(() => {
    schedulePersist();
  }, [
    content,
    workoutTypes,
    groupId,
    challengeId,
    eventId,
    mediaUri,
    mimeType,
    videoDurationSeconds,
    pickedFile,
    schedulePersist,
  ]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        void flushDraft();
      };
    }, [flushDraft])
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "background" || nextState === "inactive") {
        void flushDraft();
      }
    });
    return () => subscription.remove();
  }, [flushDraft]);

  const setPersistPaused = useCallback((paused: boolean) => {
    skipPersistRef.current = paused;
  }, []);

  const applyPickedMedia = useCallback(
    async (
      asset: ImagePickerAsset,
      mime: string,
      file?: File,
      durationSeconds?: number | null
    ) => {
      const nextDuration = durationSeconds !== undefined ? durationSeconds : videoDurationSeconds;
      setMediaUri(asset.uri);
      setMimeType(mime);
      setPickedFile(file);
      if (durationSeconds !== undefined) setVideoDurationSeconds(durationSeconds);

      const bytes = await readMediaBytesForDraft(asset.uri, mime, file);
      mediaBytesRef.current = bytes;

      if (!userId || !hydrated) return;

      const draft: CreatePostDraft = {
        content,
        workoutTypes,
        groupId,
        challengeId,
        eventId,
        mimeType: mime,
        videoDurationSeconds: nextDuration,
        mediaUri: asset.uri,
        hasStoredMedia: Boolean(bytes),
      };
      writeMemoryDraft(userId, draft, bytes, file);
      try {
        await saveCreatePostDraft(userId, draft, bytes);
      } catch (error) {
        logCreatePostError("draft", error, { action: "save_media" });
      }
    },
    [userId, hydrated, content, workoutTypes, groupId, challengeId, eventId, videoDurationSeconds]
  );

  const clearMedia = useCallback(async () => {
    mediaBytesRef.current = null;
    setMediaUri(null);
    setMimeType("image/jpeg");
    setPickedFile(undefined);
    setVideoDurationSeconds(null);

    if (!userId || !hydrated) return;

    const draft: CreatePostDraft = {
      content,
      workoutTypes,
      groupId,
      challengeId,
      eventId,
      mimeType: "image/jpeg",
      videoDurationSeconds: null,
      mediaUri: null,
      hasStoredMedia: false,
    };
    writeMemoryDraft(userId, draft, null);
    try {
      await saveCreatePostDraft(userId, draft, null);
    } catch (error) {
      logCreatePostError("draft", error, { action: "clear_media" });
    }
  }, [userId, hydrated, content, workoutTypes, groupId, challengeId, eventId]);

  const clearDraft = useCallback(async () => {
    skipPersistRef.current = true;
    mediaBytesRef.current = null;
    hydratedForUserRef.current = null;
    routeAppliedRef.current = false;
    if (userId) {
      try {
        await clearCreatePostDraft(userId);
      } catch (error) {
        logCreatePostError("draft", error, { action: "clear" });
      }
    }
    setContent("");
    setWorkoutTypes([]);
    setGroupId(null);
    setChallengeId(null);
    setEventId(null);
    setMediaUri(null);
    setMimeType("image/jpeg");
    setPickedFile(undefined);
    setVideoDurationSeconds(null);
    skipPersistRef.current = false;
  }, [userId]);

  return {
    hydrated,
    content,
    setContent,
    workoutTypes,
    setWorkoutTypes,
    groupId,
    setGroupId,
    challengeId,
    setChallengeId,
    eventId,
    setEventId,
    mediaUri,
    mimeType,
    pickedFile,
    videoDurationSeconds,
    setVideoDurationSeconds,
    applyPickedMedia,
    clearMedia,
    clearDraft,
    setPersistPaused,
    flushDraft,
  };
}
