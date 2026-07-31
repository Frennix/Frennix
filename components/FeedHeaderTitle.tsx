import { memo, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { FrennixLogo } from "@/components/FrennixLogo";
import { colors, spacing, typography } from "@frennix/ui";

function greetingForHour(hour: number): string {
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

interface FeedHeaderTitleProps {
  displayName?: string | null;
}

export const FeedHeaderTitle = memo(function FeedHeaderTitle({ displayName }: FeedHeaderTitleProps) {
  const greeting = useMemo(() => greetingForHour(new Date().getHours()), []);
  const firstName = displayName?.trim().split(/\s+/)[0] ?? "Athlete";

  return (
    <View style={styles.wrap}>
      <FrennixLogo variant="full" height={41} />
      <Text style={styles.greeting} numberOfLines={1}>
        {greeting}, {firstName}
      </Text>
      <Text style={styles.subtitle} numberOfLines={1}>
        Ready for today&apos;s workout?
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    alignItems: "flex-start",
    gap: 2,
    maxWidth: "100%",
    overflow: "visible",
    paddingBottom: 2,
  },
  greeting: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: "800",
    marginTop: spacing.xxs,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: "500",
  },
});
