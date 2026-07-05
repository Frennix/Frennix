/**
 * Post interaction sheet layout — thin alias over the shared bottom action sheet hook.
 * @see lib/use-bottom-action-sheet-layout.ts
 */
import {
  BOTTOM_SHEET_EXPANDED_MAX_RATIO,
  BOTTOM_SHEET_EXPANDED_SNAP_RATIO,
  BOTTOM_SHEET_EXTRA_LIFT_PX,
  BOTTOM_SHEET_PRIMARY_SNAP_RATIO,
  BOTTOM_SHEET_SAFETY_MARGIN_PX,
  IOS_SAFARI_TOOLBAR_RESERVE_PX,
  useBottomActionSheetLayout,
  type BottomActionSheetLayout,
} from "@/lib/use-bottom-action-sheet-layout";

export const POST_SHEET_SAFETY_MARGIN_PX = BOTTOM_SHEET_SAFETY_MARGIN_PX;
export const POST_SHEET_PRIMARY_SNAP_RATIO = BOTTOM_SHEET_PRIMARY_SNAP_RATIO;
export const POST_SHEET_MORE_SNAP_RATIO = BOTTOM_SHEET_EXPANDED_SNAP_RATIO;
export const POST_SHEET_MORE_MAX_RATIO = BOTTOM_SHEET_EXPANDED_MAX_RATIO;
export const POST_SHEET_EXTRA_LIFT_PX = BOTTOM_SHEET_EXTRA_LIFT_PX;
export { IOS_SAFARI_TOOLBAR_RESERVE_PX };

export type PostInteractionSheetLayout = BottomActionSheetLayout;

/** Safari-safe layout for PostInteractionSheet — active only while the sheet is open. */
export function usePostInteractionSheetLayout(
  expanded: boolean,
  visible: boolean
): PostInteractionSheetLayout {
  return useBottomActionSheetLayout(visible, {
    expanded,
    contentSized: !expanded,
    primarySnapRatio: POST_SHEET_PRIMARY_SNAP_RATIO,
    expandedSnapRatio: POST_SHEET_MORE_SNAP_RATIO,
    expandedMaxRatio: POST_SHEET_MORE_MAX_RATIO,
  });
}
