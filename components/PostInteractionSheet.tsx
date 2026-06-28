import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Post, Profile } from "@frennix/types";
import {
  MORE_ACTIONS_SCROLL_THRESHOLD,
  buildPrimaryActions,
  countMoreActions,
  isLightHapticAction,
  isMediumHapticAction,
  isReactionAction,
  POST_INTERACTION_MORE_SECTIONS,
  type PostInteractionAction,
  type PostInteractionActionId,
} from "@/lib/post-interaction-actions";
import { hapticLight, hapticMedium } from "@/lib/haptics";
import { Avatar, ScalePressable, colors, radius, spacing, touchTarget, typography } from "@frennix/ui";

type PostInteractionPanel = "primary" | "more";

const REACTION_HIGHLIGHT_MS = 480;
const DISMISS_DRAG_THRESHOLD = 120;
const MIN_BACKDROP_DISMISS_MS = 520;
const FONT_SCALE_MAX = 1.4;

type PostInteractionSheetProps = {
  visible: boolean;
  post: (Post & { author?: Profile }) | null;
  panel: PostInteractionPanel;
  lastReactionId: PostInteractionActionId | null;
  onPanelChange: (panel: PostInteractionPanel) => void;
  liked: boolean;
  myReaction: string | null | undefined;
  saved: boolean;
  onAction: (actionId: PostInteractionActionId) => boolean | void | Promise<boolean | void>;
  onClose: () => void;
};

function triggerActionHaptic(actionId: PostInteractionActionId) {
  if (isLightHapticAction(actionId) || actionId === "more") {
    hapticLight();
    return;
  }
  if (isMediumHapticAction(actionId)) {
    hapticMedium();
  }
}

function ActionTile({
  action,
  active,
  highlighted,
  onPress,
}: {
  action: PostInteractionAction;
  active?: boolean;
  highlighted?: boolean;
  onPress: () => void;
}) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!highlighted) {
      pulse.setValue(1);
      return;
    }
    Animated.sequence([
      Animated.spring(pulse, {
        toValue: 1.1,
        useNativeDriver: true,
        damping: 12,
        stiffness: 320,
      }),
      Animated.timing(pulse, {
        toValue: 1.04,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();
  }, [highlighted, pulse]);

  return (
    <ScalePressable
      containerStyle={styles.primaryTileWrap}
      style={[styles.primaryTile, (active || highlighted) && styles.primaryTileActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={action.label}
      accessibilityHint={
        action.id === "more" ? "Opens additional actions" : `Perform ${action.label}`
      }
      accessibilityState={{ selected: Boolean(active || highlighted) }}
    >
      <Animated.View
        style={[
          styles.primaryTileInner,
          (active || highlighted) && styles.primaryTileInnerActive,
          { transform: [{ scale: pulse }] },
        ]}
      >
        <Text style={styles.primaryEmoji} allowFontScaling maxFontSizeMultiplier={FONT_SCALE_MAX}>
          {action.emoji}
        </Text>
        <Text
          style={[styles.primaryLabel, (active || highlighted) && styles.primaryLabelActive]}
          numberOfLines={2}
          allowFontScaling
          maxFontSizeMultiplier={FONT_SCALE_MAX}
        >
          {action.label}
        </Text>
      </Animated.View>
    </ScalePressable>
  );
}

function MoreRow({
  action,
  onPress,
}: {
  action: PostInteractionAction;
  onPress: () => void;
}) {
  return (
    <ScalePressable
      style={styles.moreRow}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={action.label}
      accessibilityHint={`Perform ${action.label}`}
    >
      <View style={styles.moreEmojiWrap}>
        <Text style={styles.moreEmoji} allowFontScaling maxFontSizeMultiplier={FONT_SCALE_MAX}>
          {action.emoji}
        </Text>
      </View>
      <Text style={styles.moreLabel} allowFontScaling maxFontSizeMultiplier={FONT_SCALE_MAX}>
        {action.label}
      </Text>
    </ScalePressable>
  );
}

export function PostInteractionSheet({
  visible,
  post,
  panel,
  lastReactionId,
  onPanelChange,
  liked,
  myReaction,
  saved,
  onAction,
  onClose,
}: PostInteractionSheetProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const slide = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const [highlightedId, setHighlightedId] = useState<PostInteractionActionId | null>(null);
  const dismissingRef = useRef(false);
  const openedAtRef = useRef(0);

  const primaryActions = useMemo(
    () => buildPrimaryActions(lastReactionId),
    [lastReactionId]
  );
  const moreActionCount = countMoreActions();
  const moreScrollBounded = moreActionCount > MORE_ACTIONS_SCROLL_THRESHOLD;
  const moreScrollMaxHeight = Math.min(windowHeight * 0.42, 360);

  useEffect(() => {
    if (!visible) {
      slide.setValue(0);
      fade.setValue(0);
      dragY.setValue(0);
      setHighlightedId(null);
      dismissingRef.current = false;
      return;
    }

    slide.setValue(0);
    fade.setValue(0);
    dragY.setValue(0);
    openedAtRef.current = Date.now();
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 240,
        useNativeDriver: true,
      }),
      Animated.spring(slide, {
        toValue: 1,
        useNativeDriver: true,
        damping: 26,
        stiffness: 290,
        mass: 0.88,
      }),
    ]).start();
  }, [dragY, fade, slide, visible]);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;

    if (!visible) {
      document.body.style.removeProperty("overflow");
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      if (previousOverflow) {
        document.body.style.overflow = previousOverflow;
      } else {
        document.body.style.removeProperty("overflow");
      }
    };
  }, [visible]);

  const handleDismiss = useCallback(() => {
    if (dismissingRef.current) return;
    dismissingRef.current = true;
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slide, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(dragY, {
        toValue: 120,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) onClose();
      dismissingRef.current = false;
    });
  }, [dragY, fade, onClose, slide]);

  const handleBackdropPress = useCallback(() => {
    if (Date.now() - openedAtRef.current < MIN_BACKDROP_DISMISS_MS) return;
    handleDismiss();
  }, [handleDismiss]);

  const dismissRef = useRef(handleDismiss);
  dismissRef.current = handleDismiss;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.2,
        onPanResponderMove: (_, gesture) => {
          if (gesture.dy > 0) dragY.setValue(gesture.dy);
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy > DISMISS_DRAG_THRESHOLD || gesture.vy > 0.75) {
            dismissRef.current();
            return;
          }
          Animated.spring(dragY, {
            toValue: 0,
            useNativeDriver: true,
            damping: 22,
            stiffness: 280,
          }).start();
        },
      }),
    [dragY]
  );

  const runAction = (actionId: PostInteractionActionId) => {
    if (actionId === "more") {
      triggerActionHaptic(actionId);
      onPanelChange("more");
      return;
    }

    if (isReactionAction(actionId)) {
      triggerActionHaptic(actionId);
      setHighlightedId(actionId);
      window.setTimeout(() => {
        void onAction(actionId);
        setHighlightedId(null);
        dismissRef.current();
      }, REACTION_HIGHLIGHT_MS);
      return;
    }

    triggerActionHaptic(actionId);
    void Promise.resolve(onAction(actionId)).then((shouldDismiss) => {
      if (shouldDismiss !== false) dismissRef.current();
    });
  };

  if (Platform.OS === "web" && !visible) return null;
  if (!post) return null;

  const author = post.author;
  const caption = post.content?.trim();
  const sheetBottomPad = Math.max(insets.bottom, spacing.md);

  const openOffset = panel === "more" ? Math.min(windowHeight * 0.55, 460) : 300;
  const translateY = Animated.add(
    slide.interpolate({
      inputRange: [0, 1],
      outputRange: [openOffset, 0],
    }),
    dragY
  );

  const isActionActive = (action: PostInteractionAction) => {
    if (action.id === "like") return liked;
    if (action.id === "strong_work") return myReaction === "💪";
    if (action.id === "reaction_fire") return myReaction === "🔥";
    if (action.id === "reaction_nice_work") return myReaction === "👏";
    return false;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleDismiss}
      accessibilityViewIsModal
    >
      <View style={styles.root} pointerEvents="box-none">
        <Animated.View style={[styles.backdrop, styles.backdropBlur, { opacity: fade }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={handleBackdropPress}
            accessibilityRole="button"
            accessibilityLabel="Dismiss post actions"
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            panel === "more" && styles.sheetExpanded,
            {
              paddingBottom: sheetBottomPad,
              transform: [{ translateY }],
            },
          ]}
          {...panResponder.panHandlers}
        >
          <View
            style={styles.handleWrap}
            accessibilityRole="button"
            accessibilityLabel="Drag to dismiss"
            accessibilityHint="Swipe down on the sheet to close"
          >
            <View style={styles.handle} />
          </View>

          <View style={styles.headerRow}>
            {panel === "more" ? (
              <Pressable
                style={styles.backButton}
                onPress={() => onPanelChange("primary")}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Back to primary actions"
              >
                <Text
                  style={styles.backText}
                  allowFontScaling
                  maxFontSizeMultiplier={FONT_SCALE_MAX}
                >
                  ‹ Back
                </Text>
              </Pressable>
            ) : (
              <View style={styles.headerMeta}>
                <Avatar uri={author?.avatar_url} name={author?.display_name} size={36} />
                <View style={styles.headerText}>
                  <Text
                    style={styles.headerName}
                    numberOfLines={1}
                    allowFontScaling
                    maxFontSizeMultiplier={FONT_SCALE_MAX}
                  >
                    {author?.display_name ?? "Athlete"}
                  </Text>
                  {author?.username ? (
                    <Text
                      style={styles.headerUsername}
                      numberOfLines={1}
                      allowFontScaling
                      maxFontSizeMultiplier={FONT_SCALE_MAX}
                    >
                      @{author.username}
                    </Text>
                  ) : null}
                </View>
              </View>
            )}

            <Pressable
              style={styles.closeButton}
              onPress={handleDismiss}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>

          {caption && panel === "primary" ? (
            <Text
              style={styles.captionPreview}
              numberOfLines={3}
              allowFontScaling
              maxFontSizeMultiplier={FONT_SCALE_MAX}
            >
              {caption}
            </Text>
          ) : null}

          {panel === "primary" ? (
            <View style={styles.primaryGrid}>
              {primaryActions.map((action) => (
                <ActionTile
                  key={action.id}
                  action={action}
                  active={isActionActive(action)}
                  highlighted={highlightedId === action.id}
                  onPress={() => runAction(action.id)}
                />
              ))}
            </View>
          ) : (
            <ScrollView
              style={[
                styles.moreScroll,
                moreScrollBounded ? { maxHeight: moreScrollMaxHeight } : null,
              ]}
              contentContainerStyle={styles.moreScrollContent}
              showsVerticalScrollIndicator={moreScrollBounded}
              bounces
              nestedScrollEnabled
            >
              {POST_INTERACTION_MORE_SECTIONS.map((section) => (
                <View key={section.title} style={styles.section}>
                  <Text
                    style={styles.sectionTitle}
                    allowFontScaling
                    maxFontSizeMultiplier={FONT_SCALE_MAX}
                  >
                    {section.title}
                  </Text>
                  {section.actions.map((action) => (
                    <MoreRow
                      key={action.id}
                      action={{
                        ...action,
                        label: action.id === "save" && saved ? "Saved" : action.label,
                      }}
                      onPress={() => runAction(action.id)}
                    />
                  ))}
                </View>
              ))}
            </ScrollView>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const WEB_SHEET_SHADOW =
  Platform.OS === "web"
    ? ({
        boxShadow: "0 -16px 48px rgba(0, 0, 0, 0.45), 0 -1px 0 rgba(255,255,255,0.06)",
      } as object)
    : null;

const WEB_BACKDROP_BLUR =
  Platform.OS === "web"
    ? ({
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      } as object)
    : null;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(10, 10, 11, 0.01)",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10, 10, 11, 0.38)",
  },
  backdropBlur: WEB_BACKDROP_BLUR ?? {},
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg + 6,
    borderTopRightRadius: radius.lg + 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderBottomWidth: 0,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    maxHeight: "36%",
    ...(Platform.OS === "android" ? { elevation: 28 } : null),
    ...WEB_SHEET_SHADOW,
  },
  sheetExpanded: {
    maxHeight: "58%",
  },
  handleWrap: {
    alignItems: "center",
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    minHeight: touchTarget / 2,
    justifyContent: "center",
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: radius.full,
    backgroundColor: "rgba(255,255,255,0.28)",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
    minHeight: touchTarget,
  },
  headerMeta: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingRight: spacing.sm,
  },
  headerText: { flex: 1, gap: 2 },
  headerName: { ...typography.body, fontWeight: "700", color: colors.text },
  headerUsername: { ...typography.caption, color: colors.accent },
  backButton: {
    minHeight: touchTarget,
    justifyContent: "center",
    paddingRight: spacing.md,
  },
  backText: { ...typography.body, fontWeight: "700", color: colors.accent },
  closeButton: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  closeText: { ...typography.menuIconCompact, color: colors.textSecondary },
  captionPreview: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  primaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  primaryTileWrap: {
    width: "48%",
    minWidth: 148,
    flexGrow: 1,
  },
  primaryTile: {
    minHeight: touchTarget + 28,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  primaryTileInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  primaryTileInnerActive: {
    backgroundColor: "rgba(34, 197, 94, 0.14)",
  },
  primaryTileActive: {
    borderColor: colors.accent,
  },
  primaryEmoji: { fontSize: 28, lineHeight: 32 },
  primaryLabel: {
    ...typography.bodySmall,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  primaryLabelActive: { color: colors.accent },
  moreScroll: { flexGrow: 0 },
  moreScrollContent: {
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
  section: { gap: spacing.xs },
  sectionTitle: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.xs,
  },
  moreRow: {
    minHeight: touchTarget + 4,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  moreEmojiWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  moreEmoji: { fontSize: 20, lineHeight: 24 },
  moreLabel: { ...typography.body, fontWeight: "600", color: colors.text, flex: 1 },
});
