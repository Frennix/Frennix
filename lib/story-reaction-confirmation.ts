export const REACTION_SENT_MESSAGE = "Reaction sent.";
export const REACTION_CONFIRMATION_VISIBLE_MS = 4500;

export type VisibleReactionConfirmation = {
  requestId: number;
  message: string;
};

export function applyVisibleReactionConfirmation(
  current: VisibleReactionConfirmation | null,
  incoming: VisibleReactionConfirmation
): VisibleReactionConfirmation | null {
  if (current && incoming.requestId < current.requestId) return current;
  return incoming;
}

export function clearVisibleReactionConfirmation(
  current: VisibleReactionConfirmation | null,
  requestId: number
): VisibleReactionConfirmation | null {
  if (!current || current.requestId !== requestId) return current;
  return null;
}

export function shouldAcceptReactionConfirmation(
  currentRequestId: number,
  incomingRequestId: number
): boolean {
  return incomingRequestId >= currentRequestId;
}
