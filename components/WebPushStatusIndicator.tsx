import { Platform, StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "@frennix/ui";
import {
  resolveWebPushSetupStatus,
  WEB_PUSH_STATUS_LABELS,
  type WebPushSetupStatus,
  type WebPushSetupStatusInput,
} from "@/lib/web-push-status";

type Props = WebPushSetupStatusInput & {
  loading?: boolean;
};

const STATUS_STYLES: Record<
  WebPushSetupStatus,
  { border: string; background: string; text: string }
> = {
  enabled: {
    border: colors.accent,
    background: colors.surface,
    text: colors.text,
  },
  disabled: {
    border: colors.border,
    background: colors.surfaceElevated,
    text: colors.textSecondary,
  },
  waiting_permission: {
    border: colors.accent,
    background: colors.surfaceElevated,
    text: colors.text,
  },
  home_screen_required: {
    border: colors.border,
    background: colors.surface,
    text: colors.text,
  },
};

export function WebPushStatusIndicator(props: Props) {
  if (Platform.OS !== "web") return null;

  const status = resolveWebPushSetupStatus(props);
  const palette = STATUS_STYLES[status];
  const label = props.loading ? "Checking notification status…" : WEB_PUSH_STATUS_LABELS[status];

  return (
    <View
      style={[
        styles.container,
        { borderColor: palette.border, backgroundColor: palette.background },
      ]}
    >
      <Text style={[styles.label, { color: palette.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  label: {
    ...typography.body,
    fontWeight: "700",
    textAlign: "center",
  },
});
