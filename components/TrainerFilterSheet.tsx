import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { TrainerSearchFilters } from "@frennix/types";
import {
  TRAINER_BUDGET_FILTER_OPTIONS,
  TRAINER_GOAL_FILTER_OPTIONS,
  formatCoachingFormat,
  formatTrainerCategory,
  formatTrainerSpecialty,
  formatVerificationLevel,
} from "@/lib/trainer-labels";
import { TRAINER_CATEGORIES, TRAINER_COACHING_FORMATS, TRAINER_SPECIALTIES, TRAINER_VERIFICATION_LEVELS } from "@frennix/types";
import { Button, Chip, Input, colors, spacing, typography } from "@frennix/ui";

type TrainerFilterSheetProps = {
  visible: boolean;
  filters: TrainerSearchFilters;
  onChange: (filters: TrainerSearchFilters) => void;
  onClose: () => void;
  onApply: () => void;
};

export function TrainerFilterSheet({
  visible,
  filters,
  onChange,
  onClose,
  onApply,
}: TrainerFilterSheetProps) {
  function patch(partial: Partial<TrainerSearchFilters>) {
    onChange({ ...filters, ...partial });
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Filter trainers</Text>
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.label}>Goal</Text>
            <View style={styles.chipRow}>
              {TRAINER_GOAL_FILTER_OPTIONS.map((opt) => (
                <Chip
                  key={opt.value}
                  label={opt.label}
                  selected={filters.goal === opt.value}
                  onPress={() => patch({ goal: filters.goal === opt.value ? undefined : opt.value })}
                />
              ))}
            </View>

            <Text style={styles.label}>Trainer category</Text>
            <View style={styles.chipRow}>
              {TRAINER_CATEGORIES.map((category) => (
                <Chip
                  key={category}
                  label={formatTrainerCategory(category)}
                  selected={filters.category === category}
                  onPress={() =>
                    patch({ category: filters.category === category ? undefined : category })
                  }
                />
              ))}
            </View>

            <Text style={styles.label}>Specialty</Text>
            <View style={styles.chipRow}>
              {TRAINER_SPECIALTIES.map((specialty) => (
                <Chip
                  key={specialty}
                  label={formatTrainerSpecialty(specialty)}
                  selected={filters.specialty === specialty}
                  onPress={() =>
                    patch({ specialty: filters.specialty === specialty ? undefined : specialty })
                  }
                />
              ))}
            </View>

            <Text style={styles.label}>Location</Text>
            <Input
              placeholder="City or region"
              value={filters.city ?? ""}
              onChangeText={(city) => patch({ city: city || undefined })}
            />

            <Text style={styles.label}>Budget</Text>
            <View style={styles.chipRow}>
              {TRAINER_BUDGET_FILTER_OPTIONS.map((opt) => (
                <Chip
                  key={opt.value}
                  label={opt.label}
                  selected={filters.budgetMax === opt.value}
                  onPress={() =>
                    patch({ budgetMax: filters.budgetMax === opt.value ? undefined : opt.value })
                  }
                />
              ))}
            </View>

            <Text style={styles.label}>Coaching format</Text>
            <View style={styles.chipRow}>
              {TRAINER_COACHING_FORMATS.map((format) => (
                <Chip
                  key={format}
                  label={formatCoachingFormat(format)}
                  selected={filters.coachingFormat === format}
                  onPress={() =>
                    patch({
                      coachingFormat: filters.coachingFormat === format ? undefined : format,
                    })
                  }
                />
              ))}
            </View>

            <Text style={styles.label}>Verification level</Text>
            <View style={styles.chipRow}>
              {TRAINER_VERIFICATION_LEVELS.filter((l) => l !== "trainer").map((level) => (
                <Chip
                  key={level}
                  label={formatVerificationLevel(level)}
                  selected={filters.verificationLevel === level}
                  onPress={() =>
                    patch({
                      verificationLevel:
                        filters.verificationLevel === level ? undefined : level,
                    })
                  }
                />
              ))}
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <Pressable onPress={() => onChange({})}>
              <Text style={styles.reset}>Reset</Text>
            </Pressable>
            <Button title="Apply filters" onPress={onApply} />
            <Button title="Close" variant="secondary" onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "85%",
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    ...typography.heading,
    fontSize: 18,
  },
  content: {
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  label: {
    ...typography.bodySmall,
    color: colors.textMuted,
    fontWeight: "600",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  actions: {
    gap: spacing.sm,
  },
  reset: {
    ...typography.body,
    color: colors.accent,
    textAlign: "center",
    paddingVertical: spacing.xs,
  },
});
