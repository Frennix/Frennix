export type SaveStoryMediaKind = "photo" | "video";

export type SaveStoryMediaResult = "shared" | "downloaded";

function extensionForMime(mimeType: string, kind: SaveStoryMediaKind): string {
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("gif")) return "gif";
  if (mimeType.includes("quicktime") || mimeType.includes("mov")) return "mov";
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("mp4") || kind === "video") return "mp4";
  return kind === "video" ? "mp4" : "jpg";
}

function defaultMime(kind: SaveStoryMediaKind): string {
  return kind === "video" ? "video/mp4" : "image/jpeg";
}

function triggerDownload(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
}

export async function saveStoryMediaToDevice(options: {
  url: string;
  kind: SaveStoryMediaKind;
  filenameStem: string;
  onProgress?: (message: string) => void;
}): Promise<SaveStoryMediaResult> {
  if (!options.url) throw new Error("This story has no media to save");
  if (typeof fetch !== "function") throw new Error("Saving is not available on this device");

  options.onProgress?.(options.kind === "video" ? "Preparing video…" : "Preparing photo…");

  const response = await fetch(options.url);
  if (!response.ok) throw new Error("Could not download the original story media");

  const blob = await response.blob();
  const mimeType = blob.type || defaultMime(options.kind);
  const filename = `${options.filenameStem}.${extensionForMime(mimeType, options.kind)}`;
  const file = new File([blob], filename, { type: mimeType });

  const nav = typeof navigator !== "undefined" ? navigator : null;
  if (nav && typeof nav.canShare === "function" && typeof nav.share === "function") {
    try {
      if (nav.canShare({ files: [file] })) {
        options.onProgress?.("Opening share sheet…");
        await nav.share({
          files: [file],
          title: options.kind === "video" ? "Save video" : "Save photo",
        });
        return "shared";
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }
    }
  }

  options.onProgress?.("Saving file…");
  triggerDownload(blob, filename);
  return "downloaded";
}
