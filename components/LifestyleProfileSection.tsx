import type { ReactNode } from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import type {
  ChildrenAgeGroup,
  LifestyleProfileFields,
  ParentStatus,
  ParentType,
  PreferredWorkoutTime,
} from "@frennix/types";
import {
  CHILDREN_AGE_GROUPS,
  PARENT_STATUSES,
  PARENT_TYPES,
  PREFERRED_WORKOUT_TIMES,
  formatChildrenAgeGroup,
  formatParentStatus,
  formatParentType,
  formatPreferredWorkoutTime,
  LIFESTYLE_BRAND,
} from "@/lib/lifestyle-matching";
import { Chip, colors, spacing, typography } from "@frennix/ui";

interface LifestyleProfileSectionProps {
  value: LifestyleProfileFields;
  onChange: (next: LifestyleProfileFields) => void;
  compact?: boolean;
}

function ChipSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.label}>{title}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

function BoolRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean | null;
  onChange: (next: boolean | null) => void;
}) {
  return (
    <View style={styles.boolRow}>
      <View style={styles.boolCopy}>
        <Text style={styles.boolLabel}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <Switch
        value={value === true}
        onValueChange={(on) => onChange(on ? true : null)}
        trackColor={{ false: colors.border, true: colors.accentMuted }}
        thumbColor={value === true ? colors.accent : colors.textMuted}
      />
    </View>
  );
}

export function LifestyleProfileSection({
  value,
  onChange,
  compact = false,
}: LifestyleProfileSectionProps) {
  const isParent = value.parent_status === "parent";

  function patch(partial: Partial<LifestyleProfileFields>) {
    onChange({ ...value, ...partial });
  }

  function toggleArrayItem<T extends string>(list: T[], item: T): T[] {
    return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
  }

  function selectParentStatus(status: ParentStatus) {
    if (value.parent_status === status) {
      patch({
        parent_status: null,
        parent_type: null,
        children_age_groups: [],
      });
      return;
    }
    if (status !== "parent") {
      patch({
        parent_status: status,
        parent_type: null,
        children_age_groups: [],
      });
      return;
    }
    patch({ parent_status: status });
  }

  return (
    <View style={styles.root}>
      {!compact ? (
        <>
          <Text style={styles.heading}>{LIFESTYLE_BRAND.profileSection}</Text>
          <Text style={styles.intro}>{LIFESTYLE_BRAND.profileIntro}</Text>
        </>
      ) : null}

      <ChipSection title="Parent status" hint="Tap to select. Tap again to clear.">
        {PARENT_STATUSES.map((status) => (
          <Chip
            key={status}
            label={formatParentStatus(status)}
            selected={value.parent_status === status}
            onPress={() => selectParentStatus(status)}
          />
        ))}
      </ChipSection>

      {isParent ? (
        <>
          <ChipSection title="Parent type">
            {PARENT_TYPES.map((type) => (
              <Chip
                key={type}
                label={formatParentType(type)}
                selected={value.parent_type === type}
                onPress={() =>
                  patch({
                    parent_type: value.parent_type === type ? null : type,
                  })
                }
              />
            ))}
          </ChipSection>

          <ChipSection title="Children age groups" hint="Select all that apply.">
            {CHILDREN_AGE_GROUPS.map((group) => (
              <Chip
                key={group}
                label={formatChildrenAgeGroup(group)}
                selected={(value.children_age_groups ?? []).includes(group)}
                onPress={() =>
                  patch({
                    children_age_groups: toggleArrayItem(
                      value.children_age_groups ?? [],
                      group as ChildrenAgeGroup
                    ),
                  })
                }
              />
            ))}
          </ChipSection>
        </>
      ) : null}

      <ChipSection title="Preferred workout times" hint="When do you usually train?">
        {PREFERRED_WORKOUT_TIMES.map((slot) => (
          <Chip
            key={slot}
            label={formatPreferredWorkoutTime(slot)}
            selected={(value.preferred_workout_times ?? []).includes(slot)}
            onPress={() =>
              patch({
                preferred_workout_times: toggleArrayItem(
                  value.preferred_workout_times ?? [],
                  slot as PreferredWorkoutTime
                ),
              })
            }
          />
        ))}
      </ChipSection>

      <BoolRow
        label="Kid-friendly workouts"
        hint="Open to workouts that work with kids nearby."
        value={value.kid_friendly_workouts ?? null}
        onChange={(kid_friendly_workouts) => patch({ kid_friendly_workouts })}
      />

      <BoolRow
        label="Looking for parent training partner"
        hint="Show others you want to train with fellow parents."
        value={value.looking_for_parent_partner ?? null}
        onChange={(looking_for_parent_partner) => patch({ looking_for_parent_partner })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  heading: { ...typography.body, fontWeight: "700", color: colors.text },
  intro: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },
  section: { gap: spacing.sm },
  label: { ...typography.body, fontWeight: "600", color: colors.text },
  hint: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  boolRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  boolCopy: { flex: 1, gap: 2 },
  boolLabel: { ...typography.body, fontWeight: "600", color: colors.text },
});
