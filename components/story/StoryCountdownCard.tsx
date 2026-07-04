import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { StoryCountdown } from "@frennix/types";
import { colors, overlays, spacing, typography } from "@frennix/ui";

function formatCountdown(ms: number): string {
  if (ms <= 0) return "Starting now";
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

type StoryCountdownCardProps = {
  countdown: StoryCountdown;
  disabled?: boolean;
  onSubscribe?: () => void;
};

export function StoryCountdownCard({ countdown, disabled, onSubscribe }: StoryCountdownCardProps) {
  const targetMs = useMemo(() => new Date(countdown.target_at).getTime(), [countdown.target_at]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const remaining = targetMs - now;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>⏱ {countdown.label}</Text>
      <Text style={styles.timer}>{formatCountdown(remaining)}</Text>
      {onSubscribe ? (
        <Pressable
          style={[styles.cta, countdown.subscribed && styles.ctaDone]}
          onPress={onSubscribe}
          disabled={disabled || countdown.subscribed}
        >
          <Text style={styles.ctaText}>
            {countdown.subscribed ? "Reminder set" : "Remind me"}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: 14,
    backgroundColor: overlays.glassMedium,
    borderWidth: 1,
    borderColor: overlays.glassBorderStrong,
    alignItems: "center",
  },
  label: {
    ...typography.body,
    color: colors.white,
    fontWeight: "800",
    textAlign: "center",
  },
  timer: {
    ...typography.heading,
    color: colors.accent,
    fontWeight: "800",
  },
  cta: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: overlays.glass,
    borderWidth: 1,
    borderColor: overlays.glassBorder,
  },
  ctaDone: {
    opacity: 0.75,
  },
  ctaText: {
    ...typography.caption,
    color: colors.white,
    fontWeight: "700",
  },
});
