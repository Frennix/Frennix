import { useMemo, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import {
  ActionSheetGrid,
  ActionSheetPriorityGrid,
  ActionSheetTile,
  ACTION_SHEET_FONT_SCALE_MAX,
} from "@/components/ActionSheetGrid";
import { BottomActionSheet } from "@/components/BottomActionSheet";
import {
  MORE_ACTIONS_SCROLL_THRESHOLD,
  PRIMARY_ACTIONS_SCROLL_THRESHOLD,
  buildPrimaryActions,
  countMoreActions,
  isLightHapticAction,
  isMediumHapticAction,
  isReactionAction,
  partitionPrimaryActions,
  POST_INTERACTION_MORE_SECTIONS,
  type PostInteractionAction,
  type PostInteractionActionId,
} from "@/lib/post-interaction-actions";
import { hapticLight, hapticMedium } from "@/lib/haptics";
import { Avatar, ScalePressable, colors, radius, spacing, touchTarget, typography } from "@frennix/ui";
import type { Post, Profile } from "@frennix/types";

type PostInteractionPanel = "primary" | "more";

const REACTION_HIGHLIGHT_MS = 480;

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
        <Text style={styles.moreEmoji} allowFontScaling maxFontSizeMultiplier={ACTION_SHEET_FONT_SCALE_MAX}>
          {action.emoji}
        </Text>
      </View>
      <Text style={styles.moreLabel} allowFontScaling maxFontSizeMultiplier={ACTION_SHEET_FONT_SCALE_MAX}>
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
  const { height: windowHeight } = useWindowDimensions();
  const [highlightedId, setHighlightedId] = useState<PostInteractionActionId | null>(null);
  const dismissRef = useRef<() => void>(() => {});

  const primaryActions = useMemo(
    () => buildPrimaryActions(lastReactionId),
    [lastReactionId]
  );
  const { primaryRow, secondaryRow } = useMemo(
    () => partitionPrimaryActions(primaryActions),
    [primaryActions]
  );
  const usePriorityLayout = primaryActions.length <= 4;
  const moreActionCount = countMoreActions();
  const moreScrollBounded = moreActionCount > MORE_ACTIONS_SCROLL_THRESHOLD;
  const primaryScrollNeeded = primaryActions.length > PRIMARY_ACTIONS_SCROLL_THRESHOLD;
  const isPrimaryPanel = panel === "primary";
  const sheetScrollEnabled = isPrimaryPanel ? primaryScrollNeeded : moreScrollBounded;
  const moreScrollMaxHeight = Math.min(windowHeight * 0.55, 440);

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

  const isActionActive = (action: PostInteractionAction) => {
    if (action.id === "like") return liked;
    if (action.id === "strong_work") return myReaction === "💪";
    if (action.id === "reaction_fire") return myReaction === "🔥";
    if (action.id === "reaction_nice_work") return myReaction === "👏";
    return false;
  };

  const sheetHeader = (
    <View style={styles.headerRow}>
      {panel === "more" ? (
        <Pressable
          style={styles.backButton}
          onPress={() => onPanelChange("primary")}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back to primary actions"
        >
          <Text style={styles.backText} allowFontScaling maxFontSizeMultiplier={ACTION_SHEET_FONT_SCALE_MAX}>
            ‹ Back
          </Text>
        </Pressable>
      ) : (
        <View style={styles.headerMeta}>
          <Avatar uri={author?.avatar_url} name={author?.display_name} size={32} />
          <View style={styles.headerText}>
            <Text
              style={styles.headerName}
              numberOfLines={1}
              allowFontScaling
              maxFontSizeMultiplier={ACTION_SHEET_FONT_SCALE_MAX}
            >
              {author?.display_name ?? "Athlete"}
            </Text>
            {author?.username ? (
              <Text
                style={styles.headerUsername}
                numberOfLines={1}
                allowFontScaling
                maxFontSizeMultiplier={ACTION_SHEET_FONT_SCALE_MAX}
              >
                @{author.username}
              </Text>
            ) : null}
          </View>
        </View>
      )}

      <Pressable
        style={styles.closeButton}
        onPress={() => dismissRef.current()}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Close"
      >
        <Text style={styles.closeText}>✕</Text>
      </Pressable>
    </View>
  );

  const panelBody =
    isPrimaryPanel ? (
      usePriorityLayout ? (
        <ActionSheetPriorityGrid
          primaryRow={primaryRow}
          secondaryRow={secondaryRow}
          renderItem={(action, tier) => (
            <ActionSheetTile
              emoji={action.emoji}
              label={action.label}
              variant={tier}
              active={isActionActive(action)}
              highlighted={highlightedId === action.id}
              onPress={() => runAction(action.id)}
              accessibilityHint={
                action.id === "more" ? "Opens additional actions" : `Perform ${action.label}`
              }
            />
          )}
        />
      ) : (
        <ActionSheetGrid
          items={primaryActions}
          renderItem={(action) => (
            <ActionSheetTile
              emoji={action.emoji}
              label={action.label}
              variant="standard"
              active={isActionActive(action)}
              highlighted={highlightedId === action.id}
              onPress={() => runAction(action.id)}
              accessibilityHint={
                action.id === "more" ? "Opens additional actions" : `Perform ${action.label}`
              }
            />
          )}
        />
      )
    ) : (
      <View
        style={[styles.moreScroll, moreScrollBounded ? { maxHeight: moreScrollMaxHeight } : null]}
      >
        {POST_INTERACTION_MORE_SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text
              style={styles.sectionTitle}
              allowFontScaling
              maxFontSizeMultiplier={ACTION_SHEET_FONT_SCALE_MAX}
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
      </View>
    );

  return (
    <BottomActionSheet
      visible={visible}
      onClose={onClose}
      expanded={!isPrimaryPanel}
      fitToContent={isPrimaryPanel}
      scrollEnabled={sheetScrollEnabled}
      showScrollIndicator={sheetScrollEnabled}
      backdropAccessibilityLabel="Dismiss post actions"
      layoutOptions={{ contentSized: isPrimaryPanel, expanded: !isPrimaryPanel }}
      dismissRef={dismissRef}
    >
      {sheetHeader}
      {caption && isPrimaryPanel ? (
        <Text
          style={styles.captionPreview}
          numberOfLines={1}
          allowFontScaling
          maxFontSizeMultiplier={ACTION_SHEET_FONT_SCALE_MAX}
        >
          {caption}
        </Text>
      ) : null}
      {panelBody}
    </BottomActionSheet>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
    minHeight: touchTarget - 4,
  },
  headerMeta: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingRight: spacing.sm,
  },
  headerText: { flex: 1, gap: 1 },
  headerName: { ...typography.bodySmall, fontWeight: "700", color: colors.text },
  headerUsername: { ...typography.caption, color: colors.textMuted, fontSize: 12 },
  backButton: {
    minHeight: touchTarget,
    justifyContent: "center",
    paddingRight: spacing.md,
  },
  backText: { ...typography.body, fontWeight: "700", color: colors.accent },
  closeButton: {
    width: touchTarget - 4,
    height: touchTarget - 4,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  closeText: { ...typography.menuIconCompact, color: colors.textSecondary, fontSize: 14 },
  captionPreview: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    lineHeight: 18,
  },
  moreScroll: {
    flexGrow: 0,
    gap: spacing.lg,
    paddingBottom: spacing.sm,
  },
  section: { gap: spacing.xs },
  sectionTitle: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: spacing.xs,
  },
  moreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: touchTarget,
    paddingVertical: spacing.xs,
  },
  moreEmojiWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  moreEmoji: { fontSize: 22, lineHeight: 26 },
  moreLabel: { ...typography.body, fontWeight: "600", color: colors.text, flex: 1 },
});
