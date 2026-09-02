import { Platform, Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Post } from "@frennix/types";
import { usePostCommentsContent } from "@/components/PostCommentsContent";
import { flexFill, webScrollSurface, webTabSceneShell } from "@/lib/flex-layout";
import { useRootPortalViewport } from "@/lib/use-root-portal-viewport";
import { useCommentsOverlayBottomReserve } from "@/lib/use-comment-composer-host-inset";
import { colors, spacing, touchTarget, typography } from "@frennix/ui";

type PostCommentsScreenProps = {
  post: Post;
  userId: string;
  authorProfile?: Post["author"];
  initialDraft?: string;
  onBack: () => void;
};

function blurActiveWebInput(): void {
  if (typeof document === "undefined") return;
  const active = document.activeElement;
  if (active instanceof HTMLElement) active.blur();
}

export function PostCommentsScreen({
  post,
  userId,
  authorProfile,
  initialDraft,
  onBack,
}: PostCommentsScreenProps) {
  const insets = useSafeAreaInsets();
  const { title, commentActionSheets, composer, thread } = usePostCommentsContent({
    post,
    userId,
    authorProfile,
    initialDraft,
    enabled: true,
    rootPortal: true,
    trackInputZoom: Platform.OS === "web",
  });

  const handleBack = () => {
    blurActiveWebInput();
    onBack();
  };

  const headerTopInset = Math.max(insets.top, spacing.sm);
  const { overlayTop, overlayHeight } = useRootPortalViewport(Platform.OS === "web");
  const overlayBottomReserve = useCommentsOverlayBottomReserve(Platform.OS === "web");
  const composerHostBottomInset =
    Platform.OS === "web" ? spacing.sm : Math.max(insets.bottom, spacing.sm);

  const effectiveOverlayHeight =
    Platform.OS === "web" && overlayHeight != null
      ? Math.max(180, overlayHeight - overlayBottomReserve)
      : overlayHeight;

  const webViewportRootStyle: ViewStyle | null =
    Platform.OS === "web" && effectiveOverlayHeight != null
      ? {
          position: "fixed",
          top: overlayTop,
          left: 0,
          right: 0,
          width: "100%",
          height: effectiveOverlayHeight,
          maxHeight: effectiveOverlayHeight,
        }
      : null;

  return (
    <>
      {commentActionSheets}
      <View
        style={[
          styles.root,
          webTabSceneShell,
          webViewportRootStyle,
          Platform.OS === "web" ? styles.rootWebViewport : null,
        ]}
        {...(Platform.OS === "web"
          ? ({
              nativeID: "frennix-comments-route",
              "data-frennix-comments-route": "true",
            } as object)
          : null)}
      >
        <View style={[styles.header, { paddingTop: headerTopInset }]}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Pressable
            onPress={handleBack}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close comments"
            style={styles.closeButton}
          >
            <Text style={styles.closeIcon}>✕</Text>
          </Pressable>
        </View>

        <ScrollView
          style={[styles.list, flexFill, webScrollSurface]}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          showsVerticalScrollIndicator={false}
        >
          {thread}
        </ScrollView>

        <View
          style={[styles.composerHost, { paddingBottom: composerHostBottomInset }]}
          {...(Platform.OS === "web"
            ? ({ "data-frennix-comment-composer-host": "true" } as object)
            : null)}
        >
          {composer}
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  rootWebViewport: {
    overflow: "visible",
  },
  header: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  title: {
    ...typography.heading,
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
    flex: 1,
  },
  closeButton: {
    width: touchTarget,
    height: touchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  closeIcon: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 18,
    lineHeight: 22,
  },
  list: {
    flex: 1,
    minHeight: 0,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  composerHost: {
    flexShrink: 0,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
});
