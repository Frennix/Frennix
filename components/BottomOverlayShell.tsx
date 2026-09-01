import type { ReactNode } from "react";
import { Modal, Platform, Pressable, StyleSheet, type ViewStyle } from "react-native";
import { RootPortalOverlay } from "@/components/RootPortalOverlay";
import { OVERLAY_Z_INDEX } from "@/lib/overlay-z-index";
import { useSheetSafeArea } from "@/lib/use-sheet-safe-area";
import { colors, radius, spacing } from "@frennix/ui";

export type BottomOverlayShellProps = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  animationType?: "none" | "slide" | "fade";
  expanded?: boolean;
  sheetStyle?: ViewStyle;
  sheetMaxHeight?: number | string;
  backdropColor?: string;
  horizontalPadding?: number;
  dismissOnBackdrop?: boolean;
  accessibilityViewIsModal?: boolean;
  /** Web: portal to document.body above other fixed overlays (e.g. comments sheet). */
  rootPortal?: boolean;
  webZIndex?: number;
  portalDataAttribute?: string;
};

/**
 * Standard bottom sheet / action menu shell with permanent safe-area lift.
 * See features/releases/OVERLAY-SAFE-AREA.md
 */
export function BottomOverlayShell({
  visible,
  onClose,
  children,
  animationType = "fade",
  expanded = false,
  sheetStyle,
  sheetMaxHeight,
  backdropColor = "rgba(10, 10, 11, 0.72)",
  horizontalPadding = spacing.md,
  dismissOnBackdrop = true,
  accessibilityViewIsModal,
  rootPortal = false,
  webZIndex = OVERLAY_Z_INDEX.commentOptions,
  portalDataAttribute,
}: BottomOverlayShellProps) {
  const { sheetMarginBottom, contentBottomPadding, sheetMaxHeight: computedMaxHeight, webOverlayStyle } =
    useSheetSafeArea(expanded, visible);

  if (Platform.OS === "web" && !visible) return null;

  const maxHeight = sheetMaxHeight ?? computedMaxHeight;
  const useRootPortal = rootPortal && Platform.OS === "web";

  const overlayContent = (
    <Pressable
      style={[
        styles.backdrop,
        { backgroundColor: backdropColor, paddingHorizontal: horizontalPadding },
        useRootPortal ? styles.rootPortalBackdrop : null,
        useRootPortal ? null : webOverlayStyle,
        { paddingBottom: sheetMarginBottom },
      ]}
      onPress={dismissOnBackdrop ? onClose : undefined}
    >
      <Pressable
        style={[styles.sheet, { maxHeight, paddingBottom: contentBottomPadding }, sheetStyle]}
        onPress={(e) => e.stopPropagation()}
      >
        {children}
      </Pressable>
    </Pressable>
  );

  if (useRootPortal) {
    return (
      <RootPortalOverlay
        visible={visible}
        zIndex={webZIndex}
        dataAttribute={portalDataAttribute}
        justifyContent="flex-end"
      >
        {overlayContent}
      </RootPortalOverlay>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType={animationType}
      onRequestClose={onClose}
      accessibilityViewIsModal={accessibilityViewIsModal}
    >
      {overlayContent}
    </Modal>
  );
}

/** Apply safe bottom padding to centered modals (not flush against screen edge). */
export function useCenterOverlaySafeArea(active: boolean) {
  const { sheetMarginBottom, webOverlayStyle } = useSheetSafeArea(false, active);
  return {
    backdropStyle: [
      webOverlayStyle,
      { paddingBottom: Math.max(sheetMarginBottom, spacing.lg) },
    ] as ViewStyle[],
  };
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    ...(Platform.OS === "web"
      ? ({
          minHeight: "100dvh",
        } as object)
      : null),
  },
  rootPortalBackdrop: {
    flex: 1,
    width: "100%",
    minHeight: "100%",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    width: "100%",
  },
});
