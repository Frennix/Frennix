import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  getCalendarView,
  getErrorMessage,
  respondTrainingSessionInvite,
} from "@frennix/api";
import type { CalendarViewItem, TrainingSessionInvite } from "@frennix/types";
import { useAuth } from "@/providers/AuthProvider";
import {
  openCalendarViewItem,
  openCommunityEventsBrowse,
  openTrainingCalendarCreate,
  openTrainingCalendarDetail,
} from "@/lib/training-calendar-navigation";
import { TrainingCalendarMonthGrid } from "@/components/training-calendar/TrainingCalendarMonthGrid";
import { TrainingCalendarWeekList } from "@/components/training-calendar/TrainingCalendarWeekList";
import { TrainingCalendarItemCard } from "@/components/training-calendar/TrainingCalendarItemCard";
import { TrainingCalendarInvitesRail } from "@/components/training-calendar/TrainingCalendarInvitesRail";
import {
  addDays,
  addMonths,
  buildMonthGrid,
  buildWeekDays,
  endOfMonth,
  monthLabel,
  startOfMonth,
  toDateKey,
  weekLabel,
} from "@/lib/training-calendar-utils";
import { scrollScrollViewToTop, handleTabRetap } from "@/lib/tab-scroll-registry";
import { useScrollAtTop } from "@/lib/useScrollAtTop";
import { useGuardedRefresh } from "@/lib/useGuardedRefresh";
import { useTabScrollRegistration } from "@/lib/useTabScrollRegistration";
import {
  frennixRefreshControlProps,
  tabScreenContainer,
  tabScreenScrollSurface,
  useTabScreenWebHeightStyle,
} from "@/lib/screen-shell";
import { showAlert } from "@/lib/alerts";
import { EmptyState, WorkoutStreakBadge, colors, spacing, typography } from "@frennix/ui";

type CalendarViewMode = "month" | "week";

export default function TrainingCalendarTabScreen() {
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const queryClient = useQueryClient();
  const webHeightStyle = useTabScreenWebHeightStyle();
  const scrollRef = useRef<ScrollView>(null);
  const { onScroll, isAtTop } = useScrollAtTop();
  const [inviteLoading, setInviteLoading] = useState(false);

  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [selectedDateKey, setSelectedDateKey] = useState(() => toDateKey(new Date()));
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");

  const rangeStart = useMemo(() => {
    const start = startOfMonth(anchorDate);
    return addDays(start, -7).toISOString();
  }, [anchorDate]);

  const rangeEnd = useMemo(() => {
    const end = endOfMonth(anchorDate);
    return addDays(end, 7).toISOString();
  }, [anchorDate]);

  const queryKey = ["calendar-view", userId, rangeStart, rangeEnd] as const;

  const { data: calendarView, isLoading, refetch, isRefetching } = useQuery({
    queryKey,
    queryFn: () => getCalendarView(userId, rangeStart, rangeEnd),
    enabled: Boolean(userId),
    staleTime: 60_000,
  });

  const items = calendarView?.items ?? [];
  const activityDateKeys = useMemo(
    () => new Set((calendarView?.activity ?? []).map((day) => day.date)),
    [calendarView?.activity]
  );
  const streak = calendarView?.streak ?? 0;
  const pendingInvites = calendarView?.pending_invites ?? [];
  const weekly = calendarView?.weekly_consistency;

  const monthDays = useMemo(
    () => buildMonthGrid(anchorDate, items, activityDateKeys),
    [anchorDate, items, activityDateKeys]
  );
  const weekDays = useMemo(
    () => buildWeekDays(anchorDate, items, activityDateKeys),
    [anchorDate, items, activityDateKeys]
  );
  const selectedDayItems = useMemo(
    () => items.filter((item) => item.scheduled_date.slice(0, 10) === selectedDateKey),
    [items, selectedDateKey]
  );

  const onRefresh = useGuardedRefresh(
    useCallback(() => refetch(), [refetch]),
    { errorTitle: "Could not refresh calendar", haptic: true }
  );

  useTabScrollRegistration(
    "events",
    useCallback(
      () =>
        handleTabRetap({
          isAtTop,
          scrollToTop: () => scrollScrollViewToTop(scrollRef.current),
          refresh: () => {
            void onRefresh();
          },
        }),
      [isAtTop, onRefresh]
    )
  );

  async function invalidateCalendar() {
    await queryClient.invalidateQueries({ queryKey: ["calendar-view", userId] });
    await queryClient.invalidateQueries({ queryKey: ["training-calendar", userId] });
  }

  async function handleInviteResponse(
    invite: TrainingSessionInvite,
    status: "accepted" | "declined" | "maybe_later"
  ) {
    if (!userId || inviteLoading) return;
    setInviteLoading(true);
    try {
      await respondTrainingSessionInvite(invite.id, userId, status);
      await invalidateCalendar();
      if (status === "accepted") {
        openTrainingCalendarDetail(invite.calendar_item_id);
      }
    } catch (error) {
      showAlert("Could not respond", getErrorMessage(error));
    } finally {
      setInviteLoading(false);
    }
  }

  function handleItemPress(item: CalendarViewItem) {
    openCalendarViewItem(item);
  }

  function shiftPeriod(direction: -1 | 1) {
    setAnchorDate((current) =>
      viewMode === "month" ? addMonths(current, direction) : addDays(current, direction * 7)
    );
  }

  if (!userId) {
    return (
      <View style={[styles.centered, webHeightStyle]}>
        <EmptyState
          title="Sign in to plan training"
          description="Use your Training Calendar to schedule workouts, events, and partner sessions."
          actionLabel="Sign in"
          onAction={() => router.push("/(auth)/login")}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, webHeightStyle]}>
      <ScrollView
        ref={scrollRef}
        style={[tabScreenScrollSurface, webHeightStyle]}
        contentContainerStyle={styles.content}
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void onRefresh()}
            tintColor={frennixRefreshControlProps.tintColor}
            colors={[...frennixRefreshControlProps.colors]}
            progressBackgroundColor={frennixRefreshControlProps.progressBackgroundColor}
          />
        }
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Training Calendar</Text>
            <Text style={styles.subtitle}>Your hub for workouts, events, and challenges</Text>
          </View>
          <Pressable style={styles.addButton} onPress={() => openTrainingCalendarCreate()}>
            <Text style={styles.addButtonText}>+ Add</Text>
          </Pressable>
        </View>

        <View style={styles.streakRow}>
          <WorkoutStreakBadge streak={streak} />
          <Pressable onPress={() => openCommunityEventsBrowse()}>
            <Text style={styles.link}>Community events</Text>
          </Pressable>
        </View>

        {weekly && weekly.scheduled > 0 ? (
          <View style={styles.consistencyCard}>
            <Text style={styles.consistencyTitle}>This week</Text>
            <Text style={styles.consistencyText}>
              {weekly.completed} completed · {weekly.missed} missed · {weekly.scheduled} scheduled
            </Text>
          </View>
        ) : null}

        <TrainingCalendarInvitesRail
          invites={pendingInvites}
          loading={inviteLoading}
          onAccept={(invite) => void handleInviteResponse(invite, "accepted")}
          onDecline={(invite) => void handleInviteResponse(invite, "declined")}
          onMaybeLater={(invite) => void handleInviteResponse(invite, "maybe_later")}
          onOpen={(invite) => openTrainingCalendarDetail(invite.calendar_item_id)}
        />

        <View style={styles.toggleRow}>
          <Pressable
            style={[styles.toggleChip, viewMode === "month" && styles.toggleChipActive]}
            onPress={() => setViewMode("month")}
          >
            <Text style={[styles.toggleText, viewMode === "month" && styles.toggleTextActive]}>
              Month
            </Text>
          </Pressable>
          <Pressable
            style={[styles.toggleChip, viewMode === "week" && styles.toggleChipActive]}
            onPress={() => setViewMode("week")}
          >
            <Text style={[styles.toggleText, viewMode === "week" && styles.toggleTextActive]}>
              Week
            </Text>
          </Pressable>
        </View>

        <View style={styles.periodRow}>
          <Pressable onPress={() => shiftPeriod(-1)} hitSlop={8}>
            <Text style={styles.nav}>‹</Text>
          </Pressable>
          <Text style={styles.periodLabel}>
            {viewMode === "month" ? monthLabel(anchorDate) : weekLabel(anchorDate)}
          </Text>
          <Pressable onPress={() => shiftPeriod(1)} hitSlop={8}>
            <Text style={styles.nav}>›</Text>
          </Pressable>
        </View>

        {viewMode === "month" ? (
          <>
            <TrainingCalendarMonthGrid
              days={monthDays}
              selectedDateKey={selectedDateKey}
              onSelectDate={setSelectedDateKey}
            />
            <View style={styles.selectedDaySection}>
              <Text style={styles.selectedDayTitle}>
                {new Date(`${selectedDateKey}T12:00:00`).toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </Text>
              {selectedDayItems.length ? (
                selectedDayItems.map((item) => (
                  <TrainingCalendarItemCard
                    key={item.id}
                    item={item}
                    onPress={() => handleItemPress(item)}
                  />
                ))
              ) : (
                <Text style={styles.empty}>
                  {isLoading ? "Loading sessions…" : "No sessions scheduled"}
                </Text>
              )}
            </View>
          </>
        ) : (
          <TrainingCalendarWeekList days={weekDays} onItemPress={handleItemPress} />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: tabScreenContainer,
  centered: {
    ...tabScreenContainer,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  title: {
    ...typography.heading,
    color: colors.text,
    fontWeight: "800",
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  addButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.accent,
  },
  addButtonText: {
    ...typography.bodySmall,
    color: colors.black,
    fontWeight: "800",
  },
  streakRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  consistencyCard: {
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  consistencyTitle: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  consistencyText: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: "600",
  },
  link: {
    ...typography.bodySmall,
    color: colors.accent,
    fontWeight: "700",
  },
  toggleRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  toggleChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  toggleChipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  toggleText: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: "700",
  },
  toggleTextActive: {
    color: colors.accent,
  },
  periodRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  periodLabel: {
    ...typography.body,
    color: colors.text,
    fontWeight: "700",
  },
  nav: {
    fontSize: 28,
    lineHeight: 32,
    color: colors.accent,
    fontWeight: "700",
    paddingHorizontal: spacing.sm,
  },
  selectedDaySection: {
    gap: spacing.sm,
  },
  selectedDayTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: "800",
  },
  empty: {
    ...typography.bodySmall,
    color: colors.textMuted,
    paddingVertical: spacing.sm,
  },
});
