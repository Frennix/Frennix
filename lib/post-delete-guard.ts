/** Start at most one delete request per post. A second tap while the first is in flight is ignored. */
export function claimPostDelete(inFlight: Set<string>, postId: string): boolean {
  if (!postId || inFlight.has(postId)) return false;
  inFlight.add(postId);
  return true;
}

export function releasePostDelete(inFlight: Set<string>, postId: string) {
  inFlight.delete(postId);
}
