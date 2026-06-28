import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { readImageBytes } from "@frennix/api";

export type CreatePostDraft = {
  content: string;
  workoutTypes: string[];
  groupId: string | null;
  challengeId: string | null;
  eventId: string | null;
  mimeType: string;
  videoDurationSeconds: number | null;
  mediaUri: string | null;
  hasStoredMedia: boolean;
};

export type RestoredCreatePostDraft = CreatePostDraft & {
  pickedFile?: File;
};

type MemoryDraft = {
  draft: CreatePostDraft;
  mediaBytes: ArrayBuffer | null;
  pickedFile?: File;
};

const memoryDrafts = new Map<string, MemoryDraft>();

export function peekMemoryDraft(userId: string): MemoryDraft | undefined {
  return memoryDrafts.get(userId);
}

export function writeMemoryDraft(
  userId: string,
  draft: CreatePostDraft,
  mediaBytes: ArrayBuffer | null,
  pickedFile?: File
) {
  memoryDrafts.set(userId, { draft, mediaBytes, pickedFile });
}

export function clearMemoryDraft(userId: string) {
  memoryDrafts.delete(userId);
}

const DRAFT_VERSION = 2;
const DB_NAME = "frennix-create-post-media";
const DB_STORE = "media";

function draftKey(userId: string) {
  return `@frennix/create-post-draft/v${DRAFT_VERSION}/${userId}`;
}

function mediaKey(userId: string) {
  return `media/${userId}`;
}

export function emptyCreatePostDraft(): CreatePostDraft {
  return {
    content: "",
    workoutTypes: [],
    groupId: null,
    challengeId: null,
    eventId: null,
    mimeType: "image/jpeg",
    videoDurationSeconds: null,
    mediaUri: null,
    hasStoredMedia: false,
  };
}

function openMediaDb(): Promise<IDBDatabase> {
  if (Platform.OS !== "web" || typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable"));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
  });
}

async function saveMediaBlobWeb(userId: string, bytes: ArrayBuffer, mimeType: string) {
  const db = await openMediaDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).put({ bytes, mimeType }, mediaKey(userId));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB write failed"));
  });
  db.close();
}

async function loadMediaBlobWeb(
  userId: string
): Promise<{ bytes: ArrayBuffer; mimeType: string } | null> {
  const db = await openMediaDb();
  const record = await new Promise<{ bytes: ArrayBuffer; mimeType: string } | null>((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readonly");
    const request = tx.objectStore(DB_STORE).get(mediaKey(userId));
    request.onsuccess = () => resolve((request.result as { bytes: ArrayBuffer; mimeType: string }) ?? null);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB read failed"));
  });
  db.close();
  return record;
}

async function clearMediaBlobWeb(userId: string) {
  const db = await openMediaDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).delete(mediaKey(userId));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB delete failed"));
  });
  db.close();
}

function bytesToBase64(bytes: ArrayBuffer): string {
  const uint8 = new Uint8Array(bytes);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < uint8.length; i += chunkSize) {
    binary += String.fromCharCode(...uint8.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function saveMediaBlobNative(userId: string, bytes: ArrayBuffer, mimeType: string) {
  try {
    const payload = JSON.stringify({ mimeType, base64: bytesToBase64(bytes) });
    await AsyncStorage.setItem(`${draftKey(userId)}:media`, payload);
  } catch {
    // Large media may exceed storage limits; draft text/context still persist.
  }
}

async function loadMediaBlobNative(
  userId: string
): Promise<{ bytes: ArrayBuffer; mimeType: string } | null> {
  const raw = await AsyncStorage.getItem(`${draftKey(userId)}:media`);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { mimeType: string; base64: string };
    return { mimeType: parsed.mimeType, bytes: base64ToBytes(parsed.base64) };
  } catch {
    return null;
  }
}

async function clearMediaBlobNative(userId: string) {
  await AsyncStorage.removeItem(`${draftKey(userId)}:media`);
}

async function saveMediaBlob(userId: string, bytes: ArrayBuffer, mimeType: string) {
  if (Platform.OS === "web") return saveMediaBlobWeb(userId, bytes, mimeType);
  return saveMediaBlobNative(userId, bytes, mimeType);
}

async function loadMediaBlob(userId: string) {
  if (Platform.OS === "web") return loadMediaBlobWeb(userId);
  return loadMediaBlobNative(userId);
}

async function clearMediaBlob(userId: string) {
  if (Platform.OS === "web") return clearMediaBlobWeb(userId);
  return clearMediaBlobNative(userId);
}

function uriFromBytes(bytes: ArrayBuffer, mimeType: string): { uri: string; file?: File } {
  if (Platform.OS === "web") {
    const blob = new Blob([bytes], { type: mimeType });
    const uri = URL.createObjectURL(blob);
    const ext = mimeType.split("/")[1]?.replace("jpeg", "jpg") ?? "bin";
    return { uri, file: new File([blob], `draft-media.${ext}`, { type: mimeType }) };
  }

  return { uri: `data:${mimeType};base64,${bytesToBase64(bytes)}` };
}

export async function readMediaBytesForDraft(
  uri: string,
  mimeType: string,
  file?: File | null
): Promise<ArrayBuffer | null> {
  try {
    if (file) return file.arrayBuffer();
    return readImageBytes(uri, file);
  } catch {
    return null;
  }
}

export async function saveCreatePostDraft(
  userId: string,
  draft: CreatePostDraft,
  mediaBytes?: ArrayBuffer | null
) {
  const payload: CreatePostDraft = {
    ...draft,
    hasStoredMedia: Boolean(mediaBytes) || draft.hasStoredMedia,
  };

  if (mediaBytes) {
    await saveMediaBlob(userId, mediaBytes, draft.mimeType);
    payload.hasStoredMedia = true;
  } else if (!draft.mediaUri) {
    payload.hasStoredMedia = false;
    await clearMediaBlob(userId);
  }

  await AsyncStorage.setItem(draftKey(userId), JSON.stringify(payload));
}

export async function restoreCreatePostDraft(userId: string): Promise<RestoredCreatePostDraft | null> {
  const raw = await AsyncStorage.getItem(draftKey(userId));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as CreatePostDraft & { workoutType?: string | null };
    const draft: RestoredCreatePostDraft = {
      ...emptyCreatePostDraft(),
      ...parsed,
      workoutTypes:
        parsed.workoutTypes?.length
          ? parsed.workoutTypes
          : parsed.workoutType
            ? [parsed.workoutType]
            : [],
    };

    if (draft.hasStoredMedia) {
      const media = await loadMediaBlob(userId);
      if (media) {
        const restored = uriFromBytes(media.bytes, media.mimeType);
        draft.mediaUri = restored.uri;
        draft.mimeType = media.mimeType;
        draft.pickedFile = restored.file;
        draft.hasStoredMedia = true;
      } else {
        draft.mediaUri = null;
        draft.hasStoredMedia = false;
      }
    }

    return draft;
  } catch {
    return null;
  }
}

export async function clearCreatePostDraft(userId: string) {
  clearMemoryDraft(userId);
  await AsyncStorage.removeItem(draftKey(userId));
  await clearMediaBlob(userId);
}
