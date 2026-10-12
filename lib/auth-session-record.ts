/** SecureStore rejects values larger than 2048 bytes. */
export const SECURE_STORE_BYTE_LIMIT = 2048;

export type PersistedAuthRecord = {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
};

export const EMPTY_AUTH_RECORD: PersistedAuthRecord = {
  accessToken: null,
  refreshToken: null,
  expiresAt: null,
};

export function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (let i = 0; i < value.length; i += 1) {
    const codePoint = value.charCodeAt(i);
    if (codePoint >= 0xd800 && codePoint < 0xdc00 && i + 1 < value.length) {
      const next = value.charCodeAt(i + 1);
      if (next >= 0xdc00 && next < 0xe000) {
        bytes += 4;
        i += 1;
        continue;
      }
    }
    bytes += codePoint < 0x80 ? 1 : codePoint < 0x800 ? 2 : 3;
  }
  return bytes;
}

/** Split a session string into Keychain-sized pieces without cutting a character. */
export function chunkForSecureStore(value: string, limit = SECURE_STORE_BYTE_LIMIT): string[] {
  if (utf8ByteLength(value) <= limit) return [value];

  const chunks: string[] = [];
  let current = "";
  let currentBytes = 0;

  for (let i = 0; i < value.length; i += 1) {
    let char = value[i] ?? "";
    const codePoint = value.charCodeAt(i);
    if (codePoint >= 0xd800 && codePoint < 0xdc00 && i + 1 < value.length) {
      const next = value.charCodeAt(i + 1);
      if (next >= 0xdc00 && next < 0xe000) {
        char = value.slice(i, i + 2);
        i += 1;
      }
    }

    const size = utf8ByteLength(char);
    if (size > limit) {
      throw new Error("SecureStore cannot store a single character above the value limit");
    }
    if (current && currentBytes + size > limit) {
      chunks.push(current);
      current = char;
      currentBytes = size;
    } else {
      current += char;
      currentBytes += size;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

export function parsePersistedAuthRecord(raw: string | null): PersistedAuthRecord {
  if (!raw) return EMPTY_AUTH_RECORD;
  try {
    const parsed = JSON.parse(raw) as {
      access_token?: unknown;
      refresh_token?: unknown;
      expires_at?: unknown;
    };
    return {
      accessToken: typeof parsed.access_token === "string" && parsed.access_token ? parsed.access_token : null,
      refreshToken:
        typeof parsed.refresh_token === "string" && parsed.refresh_token ? parsed.refresh_token : null,
      expiresAt: typeof parsed.expires_at === "number" ? parsed.expires_at : null,
    };
  } catch {
    return EMPTY_AUTH_RECORD;
  }
}

/**
 * An access token past expires_at is still restorable when a refresh token is stored.
 * Supabase exchanges that refresh token on the next getSession().
 */
export function isExpiredNativeSessionWithoutRefresh(
  record: PersistedAuthRecord,
  nowSec = Math.floor(Date.now() / 1000)
): boolean {
  if (!record.accessToken || record.refreshToken) return false;
  return typeof record.expiresAt === "number" && record.expiresAt <= nowSec;
}
