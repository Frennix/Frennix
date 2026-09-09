/** Stacking order for root-level web portals (higher = closer to user). */
export const OVERLAY_Z_INDEX = {
  commentsSheet: 99998,
  imageLightbox: 99999,
  commentsVideoOverlay: 100001,
  commentOptions: 100002,
  shareSheet: 100002,
} as const;
