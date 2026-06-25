export function normalizeMediaExt(mimeType: string): string {
  const ext = mimeType.split("/")[1]?.toLowerCase() ?? "bin";
  if (ext === "jpeg") return "jpg";
  if (ext === "quicktime") return "mov";
  if (["mp4", "webm", "mov", "m4v", "jpg", "png", "webp", "gif"].includes(ext)) return ext;
  if (mimeType.startsWith("video/")) return "mp4";
  if (mimeType.startsWith("image/")) return "jpg";
  return "bin";
}

export function isVideoMime(mimeType: string): boolean {
  return mimeType.startsWith("video/");
}

export function postTypeFromMime(mimeType: string): "video" | "photo" {
  return isVideoMime(mimeType) ? "video" : "photo";
}

export function isVideoPost(postType?: string, mediaUrl?: string | null): boolean {
  if (postType === "video") return true;
  if (!mediaUrl) return false;
  return /\.(mp4|mov|webm|m4v)(\?|$)/i.test(mediaUrl);
}
