/** SHA-256 hash for staff invite / bootstrap tokens (hex). */
export async function hashStaffToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Generate a cryptographically random invite token. */
export function generateStaffInviteToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function staffInviteUrl(token: string): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/staff/join?token=${encodeURIComponent(token)}`;
  }
  return `/staff/join?token=${encodeURIComponent(token)}`;
}
