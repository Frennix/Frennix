import { Stack } from "expo-router";
import { useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EmptyState, colors, spacing, typography } from "@frennix/ui";
import { FounderSidebar } from "@/components/founder/FounderSidebar";
import { formatStaffRole, useStaffAccess } from "@/lib/founder/useStaffAccess";
import { FOUNDER_MOBILE_BREAKPOINT } from "@/lib/founder/types";

type FounderShellProps = {
  title?: string;
  children: ReactNode;
};

export function FounderShell({ title = "Founder Dashboard", children }: FounderShellProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isMobile = width < FOUNDER_MOBILE_BREAKPOINT;
  const [menuOpen, setMenuOpen] = useState(false);
  const { canAccessDashboard, isLoading, role } = useStaffAccess();

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (!canAccessDashboard) {
    return (
      <EmptyState
        title="Access denied"
        description="You do not have permission to view this page."
      />
    );
  }

  const roleLabel = role ? formatStaffRole(role) : "Staff";

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      {!isMobile ? <FounderSidebar mobileOpen={false} onCloseMobile={() => undefined} /> : null}
      <View style={styles.main}>
        <View
          style={[
            styles.topBar,
            {
              paddingTop: insets.top + spacing.sm,
              paddingHorizontal: spacing.md,
            },
          ]}
        >
          {isMobile ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open navigation menu"
              hitSlop={8}
              style={styles.menuBtn}
              onPress={() => setMenuOpen(true)}
            >
              <Text style={styles.menuIcon}>☰</Text>
            </Pressable>
          ) : null}
          <View style={styles.topBarTitles}>
            <Text style={styles.topTitle}>{title}</Text>
            <Text style={styles.topMeta}>{roleLabel} · M7.3 Operations</Text>
          </View>
          <View style={styles.envBadge}>
            <Text style={styles.envDot}>●</Text>
            <Text style={styles.envText}>Production</Text>
          </View>
        </View>
        <View style={[styles.content, { paddingBottom: insets.bottom + spacing.md }]}>
          {children}
        </View>
      </View>
      {isMobile ? (
        <FounderSidebar mobileOpen={menuOpen} onCloseMobile={() => setMenuOpen(false)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: "row", backgroundColor: colors.background },
  main: { flex: 1, minWidth: 0 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  menuBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  menuIcon: { fontSize: 18, color: colors.text },
  topBarTitles: { flex: 1, minWidth: 0 },
  topTitle: { ...typography.body, fontWeight: "700", color: colors.text },
  topMeta: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  envBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  envDot: { color: colors.accent, fontSize: 10 },
  envText: { ...typography.caption, color: colors.textSecondary, fontWeight: "600" },
  content: { flex: 1, paddingHorizontal: spacing.md, paddingTop: spacing.md },
});
