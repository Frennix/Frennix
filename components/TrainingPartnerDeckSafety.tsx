import { useEffect, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useModeration } from "@/lib/useModeration";
import { colors, spacing, typography } from "@frennix/ui";

type TrainingPartnerDeckSafetyProps = {
  userId: string;
  partnerId: string;
  partnerName: string;
  onPartnerRemoved: () => void;
};

export function TrainingPartnerDeckSafety({
  userId,
  partnerId,
  partnerName,
  onPartnerRemoved,
}: TrainingPartnerDeckSafetyProps) {
  const { openUserModeration, moderationSheets, blockMutation } = useModeration(userId);
  const handledBlock = useRef(false);

  useEffect(() => {
    if (blockMutation.isSuccess && !handledBlock.current) {
      handledBlock.current = true;
      onPartnerRemoved();
      blockMutation.reset();
    }
    if (!blockMutation.isSuccess) {
      handledBlock.current = false;
    }
  }, [blockMutation, blockMutation.isSuccess, onPartnerRemoved]);

  return (
    <>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Report or block ${partnerName}`}
          onPress={() => openUserModeration(partnerId)}
          hitSlop={8}
        >
          <Text style={styles.link}>Report or block</Text>
        </Pressable>
      </View>
      {moderationSheets}
    </>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: "center", paddingTop: spacing.xs },
  link: { ...typography.caption, color: colors.textMuted, fontWeight: "600" },
});
