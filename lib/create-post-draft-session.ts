import type { CreatePostDraft } from "./create-post-draft";

type MemoryDraft = {
  draft: CreatePostDraft;
  mediaBytes: ArrayBuffer | null;
  pickedFile?: File;
  generation: number;
};

const memoryDrafts = new Map<string, MemoryDraft>();
let draftWriteGeneration = 0;
const freshComposerUsers = new Set<string>();

export function currentDraftWriteGeneration() {
  return draftWriteGeneration;
}

export function invalidateDraftWrites() {
  draftWriteGeneration += 1;
  return draftWriteGeneration;
}

export function isDraftWriteCurrent(generation: number) {
  return generation === draftWriteGeneration;
}

/** The next new composer must open empty. The screen that just published stays as it is. */
export function markComposerPublished(userId: string) {
  invalidateDraftWrites();
  clearMemoryDraft(userId);
  freshComposerUsers.add(userId);
}

export function composerNeedsFreshStart(userId: string) {
  return freshComposerUsers.has(userId);
}

export function consumeComposerFreshStart(userId: string) {
  return freshComposerUsers.delete(userId);
}

export function peekMemoryDraft(userId: string): MemoryDraft | undefined {
  const memory = memoryDrafts.get(userId);
  if (!memory || memory.generation !== draftWriteGeneration) {
    if (memory) memoryDrafts.delete(userId);
    return undefined;
  }
  return memory;
}

export function writeMemoryDraft(
  userId: string,
  draft: CreatePostDraft,
  mediaBytes: ArrayBuffer | null,
  pickedFile?: File,
  generation = draftWriteGeneration
) {
  if (generation !== draftWriteGeneration) return;
  memoryDrafts.set(userId, { draft, mediaBytes, pickedFile, generation });
}

export function clearMemoryDraft(userId: string) {
  memoryDrafts.delete(userId);
}
