/** Consistent success copy for ownership actions across all content types. */
export const ownershipMessages = {
  deleted: (label: string) => `${label} deleted.`,
  reportSubmitted: "Report submitted. Our team will review it.",
  userBlocked: "User blocked.",
  linkCopied: "Link copied to clipboard",
  updated: (label: string) => `${label} updated.`,
  closed: (label: string) => `${label} closed.`,
  cancelled: (label: string) => `${label} cancelled.`,
  errorGeneric: "Something went wrong. Please try again.",
  reportFailed: "Report failed",
  blockFailed: "Block failed",
} as const;
