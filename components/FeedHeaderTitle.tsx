import { memo, useMemo } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { FrennixLogo } from "@/components/FrennixLogo";
import { colors, typography } from "@frennix/ui";

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
    <View
      style={styles.wrap}
      {...(Platform.OS === "web" ? ({ nativeID: "frennix-feed-header-title" } as object) : null)}
    >
      <FrennixLogo variant="full" height={32} />
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
    gap: 0,
    maxWidth: "100%",
    overflow: "hidden",
    paddingBottom: 0,
  },
  greeting: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: "800",
    marginTop: 0,
    lineHeight: 16,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: "500",
    lineHeight: 14,
  },
});
