import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { FRENIX_MATCH_BRAND } from "@frennix/matching";
import { FrennixLogo } from "@/components/FrennixLogo";
import { useCenterOverlaySafeArea } from "@/components/BottomOverlayShell";
import { Button, colors, radius, spacing, typography } from "@frennix/ui";

type FrennixMatchExplainerModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function FrennixMatchExplainerModal({ visible, onClose }: FrennixMatchExplainerModalProps) {
  const { explainer } = FRENIX_MATCH_BRAND;
  const { backdropStyle } = useCenterOverlaySafeArea(visible);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <Pressable style={[styles.backdrop, ...backdropStyle]} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <FrennixLogo variant="icon" height={28} style={styles.logo} />

          <Text style={styles.title}>{explainer.title}</Text>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <Text style={styles.lead}>{explainer.lead}</Text>

            <Text style={styles.factorsHeading}>{explainer.factorsHeading}</Text>
            <View style={styles.factorList}>
              {explainer.factors.map((factor) => (
                <View key={factor} style={styles.factorRow}>
                  <View style={styles.factorDot} />
                  <Text style={styles.factorText}>{factor}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.closing}>{explainer.closing}</Text>
          </ScrollView>

          <Button title={explainer.dismissLabel} onPress={onClose} style={styles.dismiss} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(10, 10, 11, 0.78)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  sheet: {
    width: "100%",
    maxWidth: 380,
    maxHeight: "84%",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  logo: {
    alignSelf: "center",
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.heading,
    fontSize: 22,
    textAlign: "center",
    color: colors.text,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  lead: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 22,
    textAlign: "center",
  },
  factorsHeading: {
    ...typography.bodySmall,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  factorList: {
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  factorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  factorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  factorText: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: "500",
    flex: 1,
  },
  closing: {
    ...typography.bodySmall,
    color: colors.textMuted,
    lineHeight: 22,
    textAlign: "center",
  },
  dismiss: {
    marginTop: spacing.xs,
  },
});
