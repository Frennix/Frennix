/** Exact Bearer service-role authorization. Rejects missing, malformed, or extra text. */
const EXACT_BEARER = /^Bearer (\S+)$/;

export function parseExactBearerCredential(
  authorizationHeader: string | null | undefined
): string | null {
  if (typeof authorizationHeader !== "string") return null;
  const match = EXACT_BEARER.exec(authorizationHeader);
  return match?.[1] ?? null;
}

export function isExactServiceRoleAuthorization(
  authorizationHeader: string | null | undefined,
  serviceKey: string
): boolean {
  if (!serviceKey) return false;
  const credential = parseExactBearerCredential(authorizationHeader);
  return credential !== null && credential === serviceKey;
}
