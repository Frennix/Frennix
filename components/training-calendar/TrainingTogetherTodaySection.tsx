import { Pressable, StyleSheet, Text, View } from "react-native";
import type { PartnerTrainingTodayEntry } from "@frennix/types";
import {
  joinPartnerTrainingSession,
  messagePartnerFromFocus,
  openPartnerTrainingSession,
  invitePartnerToTrainFromFocus,
} from "@/lib/training-calendar-navigation";
import { Avatar, colors, spacing, typography } from "@frennix/ui";

type TrainingTogetherTodaySectionProps = {
  partners: PartnerTrainingTodayEntry[];
};

function PartnerRow({ partner }: { partner: PartnerTrainingTodayEntry }) {
  return (
    <View style={styles.row}>
      <View style={styles.identity}>
        <Avatar uri={partner.avatar_url} name={partner.display_name} size={40} />
        <View style={styles.copy}>
          <Text style={styles.name} numberOfLines={1}>
            {partner.display_name}
          </Text>
          <Text style={styles.session} numberOfLines={2}>
            {partner.session_subline}
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable
          style={styles.actionChip}
          onPress={() => openPartnerTrainingSession(partner)}
          accessibilityLabel={`View ${partner.display_name}'s workout`}
        >
          <Text style={styles.actionEmoji}>👁</Text>
        </Pressable>
        <Pressable
          style={[styles.actionChip, !partner.can_join && styles.actionChipDisabled]}
          onPress={() => joinPartnerTrainingSession(partner)}
          disabled={!partner.can_join}
          accessibilityLabel={`Join ${partner.display_name}'s workout`}
        >
          <Text style={styles.actionEmoji}>🏋️</Text>
        </Pressable>
        <Pressable
          style={styles.actionChip}
          onPress={() => messagePartnerFromFocus(partner)}
          accessibilityLabel={`Message ${partner.display_name}`}
        >
          <Text style={styles.actionEmoji}>💬</Text>
        </Pressable>
        <Pressable
          style={styles.actionChip}
          onPress={() => invitePartnerToTrainFromFocus(partner)}
          accessibilityLabel={`Invite ${partner.display_name} to train`}
        >
          <Text style={styles.actionEmoji}>🤝</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Renders when privacy-visible partner workouts exist for today (v1.1+ data). */
export function TrainingTogetherTodaySection({ partners }: TrainingTogetherTodaySectionProps) {
  if (!partners.length) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>🏋️ Training Together Today</Text>
      {partners.map((partner) => (
        <PartnerRow key={`${partner.user_id}-${partner.session_id}`} partner={partner} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    maxWidth: "100%",
    gap: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  heading: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: "800",
  },
  row: {
    width: "100%",
    maxWidth: "100%",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minWidth: 0,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  name: {
    ...typography.body,
    color: colors.text,
    fontWeight: "700",
  },
  session: {
    ...typography.caption,
    color: colors.textMuted,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  actionChip: {
    minWidth: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionChipDisabled: {
    opacity: 0.35,
  },
  actionEmoji: {
    fontSize: 15,
    lineHeight: 18,
  },
});
