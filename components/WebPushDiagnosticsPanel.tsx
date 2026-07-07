import { useEffect, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "@frennix/ui";
import {
  formatPushLogEntry,
  getPushLogs,
  subscribePushLogs,
  type WebPushLogEntry,
} from "@/lib/web-push-diagnostics";

export function WebPushDiagnosticsPanel() {
  const [entries, setEntries] = useState<WebPushLogEntry[]>([]);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    setEntries(getPushLogs());
    return subscribePushLogs(() => setEntries(getPushLogs()));
  }, []);

  if (Platform.OS !== "web") return null;

  return (
    <View style={styles.container}>
      <Pressable onPress={() => setExpanded((value) => !value)}>
        <Text style={styles.title}>
          Push registration log ({entries.length}) {expanded ? "▾" : "▸"}
        </Text>
      </Pressable>
      {expanded ? (
        <ScrollView style={styles.scroll} nestedScrollEnabled>
          {entries.length === 0 ? (
            <Text style={styles.line}>No push logs yet. Tap Enable Push Notifications to start.</Text>
          ) : (
            entries.map((entry, index) => (
              <Text key={`${entry.ts}-${index}`} style={styles.line} selectable>
                {formatPushLogEntry(entry)}
              </Text>
            ))
          )}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: 220,
  },
  title: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  scroll: { maxHeight: 180 },
  line: {
    ...typography.caption,
    fontFamily: Platform.OS === "web" ? "monospace" : undefined,
    color: colors.textSecondary,
    lineHeight: 16,
    marginBottom: 4,
  },
});
