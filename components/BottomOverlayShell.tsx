import type { ReactNode } from "react";
import { Modal, Platform, Pressable, StyleSheet, type ViewStyle } from "react-native";
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
}: BottomOverlayShellProps) {
  const { sheetMarginBottom, contentBottomPadding, sheetMaxHeight: computedMaxHeight, webOverlayStyle } =
    useSheetSafeArea(expanded, visible);

  if (Platform.OS === "web" && !visible) return null;

  const maxHeight = sheetMaxHeight ?? computedMaxHeight;

  return (
    <Modal
      visible={visible}
      transparent
      animationType={animationType}
      onRequestClose={onClose}
      accessibilityViewIsModal={accessibilityViewIsModal}
    >
      <Pressable
        style={[
          styles.backdrop,
          { backgroundColor: backdropColor, paddingHorizontal: horizontalPadding },
          webOverlayStyle,
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
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    width: "100%",
  },
});
