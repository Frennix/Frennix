import { useEffect, useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { StoryShareMode } from "@frennix/types";
import { BottomOverlayShell } from "@/components/BottomOverlayShell";
import {
  measureSafariVisualViewport,
  requestSafariVisualViewportRemeasure,
  subscribeSafariVisualViewport,
} from "@/lib/safari-visual-viewport";
import { colors, spacing, typography } from "@frennix/ui";

export type WorkoutSavedShareMode = StoryShareMode | "done" | "reel";

const BASE_OPTIONS: Array<{
  mode: WorkoutSavedShareMode;
  label: string;
  hint: string;
  emoji: string;
}> = [
  { mode: "feed", label: "Post to Feed", hint: "Share on your home feed", emoji: "📰" },
  { mode: "story", label: "Share to Story", hint: "24-hour story only", emoji: "⭕" },
  { mode: "both", label: "Share to Both", hint: "Feed post and story", emoji: "✨" },
  { mode: "done", label: "Done", hint: "Save without sharing", emoji: "✓" },
];

const REEL_OPTION = {
  mode: "reel" as const,
  label: "Post to Reels",
  hint: "Share this journey video in Reels",
  emoji: "🎬",
};

type WorkoutSavedSheetProps = {
  visible: boolean;
  loading?: boolean;
  /** When true, Post to Reels is the first destination. */
  reelIntent?: boolean;
  onSelect: (mode: WorkoutSavedShareMode) => void;
  onClose: () => void;
};

export function WorkoutSavedSheet({
  visible,
  loading,
  reelIntent = false,
  onSelect,
  onClose,
}: WorkoutSavedSheetProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [visualHeight, setVisualHeight] = useState(windowHeight);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined" || !visible) return;

    const update = () => {
      const snap = measureSafariVisualViewport();
      setVisualHeight(snap.visualHeight);
    };

    update();
    requestSafariVisualViewportRemeasure();
    return subscribeSafariVisualViewport(update);
  }, [visible]);

  const sheetMaxHeight = useMemo(() => {
    const visibleHeight = Platform.OS === "web" ? visualHeight : windowHeight;
    const maxPx = Math.max(Math.round(visibleHeight * 0.82), 280);
    return Platform.OS === "web" ? (`min(82dvh, ${maxPx}px)` as const) : maxPx;
  }, [visualHeight, windowHeight]);

  const options = reelIntent ? [REEL_OPTION, ...BASE_OPTIONS] : BASE_OPTIONS;
  const scrollBottomPadding = Math.max(insets.bottom, spacing.md) + spacing.lg;

  return (
    <BottomOverlayShell
      visible={visible}
      onClose={onClose}
      animationType="slide"
      backdropColor="rgba(0,0,0,0.5)"
      horizontalPadding={0}
      sheetMaxHeight={sheetMaxHeight}
      sheetStyle={styles.sheet}
    >
      <View style={styles.header}>
        <Text style={styles.emoji}>💪</Text>
        <Text style={styles.title}>Workout Saved</Text>
        <Text style={styles.subtitle}>Choose where to share — nothing posts automatically.</Text>
      </View>

      <View style={styles.optionsViewport}>
        <ScrollView
          style={styles.optionsScroll}
          contentContainerStyle={[styles.optionsContent, { paddingBottom: scrollBottomPadding }]}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          showsVerticalScrollIndicator
        >
          {options.map((option) => (
            <Pressable
              key={option.mode}
              style={[styles.option, loading && styles.optionDisabled]}
              onPress={() => onSelect(option.mode)}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel={option.label}
            >
              <Text style={styles.optionEmoji}>{option.emoji}</Text>
              <View style={styles.optionText}>
                <Text style={styles.optionLabel}>{option.label}</Text>
                <Text style={styles.optionHint}>{option.hint}</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </BottomOverlayShell>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: 0,
    gap: spacing.md,
    flexDirection: "column",
    minHeight: 0,
    overflow: "hidden",
    width: "100%",
  },
  header: {
    alignItems: "center",
    gap: spacing.xs,
    flexShrink: 0,
  },
  emoji: {
    fontSize: 40,
    lineHeight: 44,
  },
  title: {
    ...typography.heading,
    color: colors.text,
    fontWeight: "800",
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textMuted,
    textAlign: "center",
  },
  optionsViewport: {
    flex: 1,
    minHeight: 0,
  },
  optionsScroll: {
    flex: 1,
    minHeight: 0,
  },
  optionsContent: {
    gap: spacing.sm,
    flexGrow: 0,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 48,
  },
  optionDisabled: {
    opacity: 0.6,
  },
  optionEmoji: {
    fontSize: 24,
    lineHeight: 28,
    width: 32,
    textAlign: "center",
  },
  optionText: {
    flex: 1,
    gap: 2,
  },
  optionLabel: {
    ...typography.body,
    color: colors.text,
    fontWeight: "700",
  },
  optionHint: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
