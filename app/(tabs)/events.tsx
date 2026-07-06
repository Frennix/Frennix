import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
import { TrainingCalendarTodaysFocus } from "@/components/training-calendar/TrainingCalendarTodaysFocus";
import {
  TrainingCalendarViewControls,
  trainingCalendarStickyControlsStyle,
  type CalendarViewMode,
} from "@/components/training-calendar/TrainingCalendarViewControls";
import { TrainingCalendarCreateFab } from "@/components/training-calendar/TrainingCalendarCreateFab";
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
  useTabScreenWebContainerStyle,
} from "@/lib/screen-shell";
import { showAlert } from "@/lib/alerts";
import { buildTodaysFocus } from "@/lib/training-calendar-focus";
import { useCalendarWideLayout } from "@/lib/responsive";
import { getCalendarViewQueryKey, getDefaultCalendarRange } from "@/lib/calendar-query-range";
import { EmptyState, colors, spacing, typography } from "@frennix/ui";

/** Scroll child index for native sticky Month/Week controls (see ScrollView child order). */
const STICKY_CONTROLS_INDEX = 3;

export default function TrainingCalendarTabScreen() {
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const webHeightStyle = useTabScreenWebHeightStyle();
  const webContainerStyle = useTabScreenWebContainerStyle();
  const isWideLayout = useCalendarWideLayout();
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const { onScroll: onScrollAtTop, isAtTop } = useScrollAtTop();
  const [inviteLoading, setInviteLoading] = useState(false);

  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [selectedDateKey, setSelectedDateKey] = useState(() => toDateKey(new Date()));
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");

  const fabBottom = Platform.OS === "web" ? 80 : Math.max(insets.bottom, spacing.md) + 56;

  const [fabInteractive, setFabInteractive] = useState(false);

  const headerAddOpacity = scrollY.interpolate({
    inputRange: [0, 48, 88],
    outputRange: [1, 0.35, 0],
    extrapolate: "clamp",
  });

  const headerAddScale = scrollY.interpolate({
    inputRange: [0, 88],
    outputRange: [1, 0.85],
    extrapolate: "clamp",
  });

  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: true,
        listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
          onScrollAtTop(event);
          setFabInteractive(event.nativeEvent.contentOffset.y >= 72);
        },
      }),
    [onScrollAtTop, scrollY]
  );

  const rangeStart = useMemo(() => {
    const start = startOfMonth(anchorDate);
    return addDays(start, -7).toISOString();
  }, [anchorDate]);

  const rangeEnd = useMemo(() => {
    const end = endOfMonth(anchorDate);
    return addDays(end, 7).toISOString();
  }, [anchorDate]);

  const queryKey = getCalendarViewQueryKey(userId, rangeStart, rangeEnd);

  const { data: calendarView, isPending, refetch, isRefetching } = useQuery({
    queryKey,
    queryFn: () => getCalendarView(userId, rangeStart, rangeEnd),
    enabled: Boolean(userId),
    staleTime: 60_000,
    gcTime: 30 * 60 * 1000,
    placeholderData: (previousData) => previousData,
    initialData: () => {
      const { rangeStart: defaultStart, rangeEnd: defaultEnd } = getDefaultCalendarRange();
      if (rangeStart !== defaultStart || rangeEnd !== defaultEnd) return undefined;
      return queryClient.getQueryData<Awaited<ReturnType<typeof getCalendarView>>>(queryKey);
    },
    initialDataUpdatedAt: () =>
      queryClient.getQueryState(queryKey)?.dataUpdatedAt,
  });

  const showCalendarSkeleton = isPending && !calendarView;

  const items = calendarView?.items ?? [];
  const activityDateKeys = useMemo(
    () => new Set((calendarView?.activity ?? []).map((day) => day.date)),
    [calendarView?.activity]
  );
  const streak = calendarView?.streak ?? 0;
  const pendingInvites = calendarView?.pending_invites ?? [];
  const weekly = calendarView?.weekly_consistency;

  const partnersTrainingToday: TrainingSessionInvite[] = [];

  const todaysFocus = useMemo(
    () => buildTodaysFocus(items, streak, weekly, partnersTrainingToday),
    [items, streak, weekly, partnersTrainingToday]
  );

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

  const periodLabel = viewMode === "month" ? monthLabel(anchorDate) : weekLabel(anchorDate);

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

  function renderCommunityCard() {
    return (
      <View style={styles.communityCard}>
        <Text style={styles.communityTitle}>Community events</Text>
        <Text style={styles.communityBody}>
          Group workouts and public training events — separate from your personal schedule.
        </Text>
        <Pressable style={styles.communityButton} onPress={() => openCommunityEventsBrowse()}>
          <Text style={styles.communityButtonText}>Browse events</Text>
        </Pressable>
      </View>
    );
  }

  function renderCalendarBody() {
    if (viewMode === "month") {
      return (
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
            ) : showCalendarSkeleton ? (
              <View style={styles.dayLoading}>
                <ActivityIndicator color={colors.accent} />
                <Text style={styles.dayLoadingText}>Loading sessions…</Text>
              </View>
            ) : (
              <EmptyState
                title="Nothing scheduled"
                description="Tap + to plan a workout, event, or partner session for this day."
                actionLabel="Create session"
                onAction={() => openTrainingCalendarCreate()}
              />
            )}
          </View>
        </>
      );
    }

    return <TrainingCalendarWeekList days={weekDays} onItemPress={handleItemPress} />;
  }

  if (!userId) {
    return (
      <View style={[styles.centered, webContainerStyle]}>
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
    <View style={[styles.container, webContainerStyle]}>
      <Animated.ScrollView
        ref={scrollRef}
        nativeID="calendar-scroll"
        testID="calendar-scroll"
        style={[tabScreenScrollSurface, webHeightStyle]}
        contentContainerStyle={styles.content}
        onScroll={onScroll}
        scrollEventThrottle={16}
        stickyHeaderIndices={Platform.OS === "web" ? undefined : [STICKY_CONTROLS_INDEX]}
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
        <TrainingCalendarTodaysFocus focus={todaysFocus} />

        <View style={styles.pageHeader}>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Training Calendar</Text>
            <Text style={styles.subtitle}>Your personal training schedule</Text>
          </View>
          <Animated.View
            pointerEvents={fabInteractive ? "none" : "auto"}
            style={{
              opacity: headerAddOpacity,
              transform: [{ scale: headerAddScale }],
            }}
          >
            <Pressable style={styles.addButton} onPress={() => openTrainingCalendarCreate()}>
              <Text style={styles.addButtonText}>+ Add</Text>
            </Pressable>
          </Animated.View>
        </View>

        <View style={styles.sectionSlot}>
          <TrainingCalendarInvitesRail
            invites={pendingInvites}
            loading={inviteLoading}
            onAccept={(invite) => void handleInviteResponse(invite, "accepted")}
            onDecline={(invite) => void handleInviteResponse(invite, "declined")}
            onMaybeLater={(invite) => void handleInviteResponse(invite, "maybe_later")}
            onOpen={(invite) => openTrainingCalendarDetail(invite.calendar_item_id)}
          />
        </View>

        <View style={trainingCalendarStickyControlsStyle}>
          <TrainingCalendarViewControls
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            periodLabel={periodLabel}
            onShiftPeriod={shiftPeriod}
          />
        </View>

        <View style={[styles.body, isWideLayout && styles.bodyWide]}>
          <View style={styles.primaryColumn}>
            <View style={styles.calendarBody}>{renderCalendarBody()}</View>
            {!isWideLayout ? renderCommunityCard() : null}
          </View>

          {isWideLayout ? (
            <View style={[styles.secondaryColumn, styles.secondaryColumnWide]}>
              {renderCommunityCard()}
            </View>
          ) : null}
        </View>
      </Animated.ScrollView>

      <TrainingCalendarCreateFab
        scrollY={scrollY}
        bottom={fabBottom}
        interactive={fabInteractive}
        onPress={() => openTrainingCalendarCreate()}
      />
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
    paddingBottom: spacing.xl + 64,
    width: "100%",
    maxWidth: "100%",
    flexGrow: 1,
  },
  pageHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
    width: "100%",
    maxWidth: "100%",
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  sectionSlot: {
    width: "100%",
    maxWidth: "100%",
  },
  body: {
    width: "100%",
    maxWidth: "100%",
    gap: spacing.md,
  },
  bodyWide: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.lg,
  },
  primaryColumn: {
    flex: 1,
    minWidth: 0,
    gap: spacing.md,
    width: "100%",
  },
  calendarBody: {
    width: "100%",
    maxWidth: "100%",
    gap: spacing.md,
  },
  secondaryColumn: {
    width: "100%",
    maxWidth: "100%",
  },
  secondaryColumnWide: {
    width: 280,
    maxWidth: 300,
    flexShrink: 0,
  },
  communityCard: {
    width: "100%",
    maxWidth: "100%",
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  communityTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: "800",
  },
  communityBody: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  communityButton: {
    alignSelf: "flex-start",
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  communityButtonText: {
    ...typography.bodySmall,
    color: colors.accent,
    fontWeight: "800",
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
  selectedDaySection: {
    gap: spacing.sm,
    width: "100%",
    maxWidth: "100%",
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
  dayLoading: {
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  dayLoadingText: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
