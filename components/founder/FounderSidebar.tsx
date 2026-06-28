import { usePathname, useRouter } from "expo-router";
import { useMemo } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FOUNDER_NAV_ITEMS, type FounderNavItem, type StaffCapability } from "@frennix/types";
import { useStaffCapability } from "@/lib/founder/useStaffAccess";
import { FOUNDER_MOBILE_BREAKPOINT } from "@/lib/founder/types";
import { colors, spacing, typography } from "@frennix/ui";

type FounderSidebarProps = {
  mobileOpen: boolean;
  onCloseMobile: () => void;
};

function NavRowInner({
  item,
  active,
  onPress,
}: {
  item: FounderNavItem;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.navRow, active && styles.navRowActive]}
    >
      <Text style={styles.navIcon}>{item.icon}</Text>
      <View style={styles.navLabelWrap}>
        <Text style={[styles.navLabel, active && styles.navLabelActive]}>{item.label}</Text>
        {item.milestone ? <Text style={styles.navMilestone}>{item.milestone}</Text> : null}
      </View>
    </Pressable>
  );
}

function NavRowGated({
  item,
  active,
  onPress,
  capability,
}: {
  item: FounderNavItem;
  active: boolean;
  onPress: () => void;
  capability: StaffCapability;
}) {
  const { allowed, isLoading } = useStaffCapability(capability);
  if (isLoading || !allowed) return null;
  return <NavRowInner item={item} active={active} onPress={onPress} />;
}

function NavRow({
  item,
  active,
  onPress,
}: {
  item: FounderNavItem;
  active: boolean;
  onPress: () => void;
}) {
  if (item.capability) {
    return (
      <NavRowGated item={item} active={active} onPress={onPress} capability={item.capability} />
    );
  }
  return <NavRowInner item={item} active={active} onPress={onPress} />;
}

function SidebarContent({ onNavigate }: { onNavigate: (href: string) => void }) {
  const pathname = usePathname();

  const items = useMemo(() => {
    return FOUNDER_NAV_ITEMS.map((item) => {
      const active =
        item.href === "/founder"
          ? pathname === "/founder" || pathname === "/founder/"
          : pathname.startsWith(item.href);
      return (
        <NavRow
          key={item.key}
          item={item}
          active={active}
          onPress={() => onNavigate(item.href)}
        />
      );
    });
  }, [onNavigate, pathname]);

  return (
    <ScrollView contentContainerStyle={styles.sidebarScroll} showsVerticalScrollIndicator={false}>
      <Text style={styles.brand}>Frennix Founder</Text>
      <Text style={styles.brandSub}>Operations</Text>
      <View style={styles.navList}>{items}</View>
    </ScrollView>
  );
}

export function FounderSidebar({ mobileOpen, onCloseMobile }: FounderSidebarProps) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isMobile = width < FOUNDER_MOBILE_BREAKPOINT;

  const navigate = (href: string) => {
    router.push(href as never);
    onCloseMobile();
  };

  if (isMobile) {
    return (
      <Modal visible={mobileOpen} animationType="slide" transparent onRequestClose={onCloseMobile}>
        <Pressable style={styles.backdrop} onPress={onCloseMobile} />
        <View style={[styles.drawer, { paddingTop: insets.top + spacing.md }]}>
          <SidebarContent onNavigate={navigate} />
        </View>
      </Modal>
    );
  }

  return (
    <View style={[styles.sidebar, { paddingTop: insets.top + spacing.md }]}>
      <SidebarContent onNavigate={navigate} />
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 248,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    backgroundColor: colors.background,
  },
  sidebarScroll: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl,
  },
  brand: { ...typography.heading, fontSize: 18, color: colors.text },
  brandSub: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.lg },
  navList: { gap: 4 },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 8,
  },
  navRowActive: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  navIcon: { width: 20, textAlign: "center", color: colors.accent, fontSize: 14 },
  navLabelWrap: { flex: 1 },
  navLabel: { ...typography.bodySmall, color: colors.textSecondary },
  navLabelActive: { color: colors.text, fontWeight: "600" },
  navMilestone: { ...typography.caption, color: colors.textMuted, fontSize: 10 },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  drawer: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: "82%",
    maxWidth: 300,
    backgroundColor: colors.background,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
});
