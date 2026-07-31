import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useIsFocused } from "@react-navigation/native";
import { usePathname } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Platform, RefreshControl, StyleSheet, Text, View } from "react-native";
import {
  archiveConversationForUser,
  archiveConversationsForUser,
  deleteConversationsForUser,
  getConversations,
  getErrorMessage,
  getFeedStoriesForPartners,
  sortInboxConversations,
  markConversationReadForUser,
  markConversationUnreadForUser,
  markConversationsReadForUser,
  markConversationsUnreadForUser,
  markDedicatedStoryViewed,
  muteConversationForUser,
  pinConversationForUser,
  sendStoryEventInvite,
  unfavoriteConversationForUser,
  unmuteConversationForUser,
  unpinConversationForUser,
} from "@frennix/api";
import type { Conversation, Profile } from "@frennix/types";
import { useAuth } from "@/providers/AuthProvider";
import { openStoryWorkoutInvite } from "@/lib/story-calendar-invite";
import { openTrainingCalendarCreate } from "@/lib/training-calendar-navigation";
import { AnimatedDismissRow } from "@/components/AnimatedDismissRow";
import { ConversationRow } from "@/components/ConversationRow";
import {
  FavoriteTrainingPartnersSection,
  type FavoritePartnerAction,
} from "@/components/FavoriteTrainingPartnersSection";
import { FeedStoryViewer } from "@/components/FeedStoryViewer";
import { EntityActionSheet } from "@/components/EntityActionSheet";
import { MessagesInboxToolbar, type MessagesBulkAction } from "@/components/MessagesInboxToolbar";
import { UndoSnackbar } from "@/components/UndoSnackbar";
import { SwipeableActionsRow } from "@/components/SwipeableActionsRow";
import {
  buildConversationInboxMenuActions,
  buildFavoritePartnerConversationMenuActions,
} from "@/lib/conversation-menu-actions";
import { isChatRoute } from "@/lib/safe-pathname";
import { pushScreen, switchTab } from "@/lib/press-utils";
import { scrollFlatListToTop, handleTabRetap } from "@/lib/tab-scroll-registry";
import { useScrollAtTop } from "@/lib/useScrollAtTop";
import { useGuardedRefresh } from "@/lib/useGuardedRefresh";
import { useTabScrollRegistration } from "@/lib/useTabScrollRegistration";
import { useProfilesPresence } from "@/lib/useProfilesPresence";
import { useConversationDeleteUndo } from "@/lib/useConversationDeleteUndo";
import {
  confirmArchiveSelectedConversations,
  confirmDeleteSelectedConversations,
  showAlert,
} from "@/lib/alerts";
import type { EntityActionId } from "@/lib/entity-actions";
import { MessagesListSkeleton } from "@/components/MessagesListSkeleton";
import { MessagesOfflineBanner } from "@/components/MessagesOfflineBanner";
import { ReportIssueLink } from "@/components/ReportIssueLink";
import { hydrateMessagesInboxCache, writeMessagesInboxCache } from "@/lib/messages-inbox-cache";
import { mergeInboxConversations } from "@/lib/messages-inbox-merge";
import { logInboxPerf, markInboxVisible } from "@/lib/messages-inbox-perf";
import { useNetworkStatus } from "@/lib/useNetworkStatus";
import {
  tabScreenScrollSurface,
  useTabScreenWebHeightStyle,
} from "@/lib/screen-shell";
import { TabScreenBoundary } from "@/components/TabScreenBoundary";
import { EmptyState, QueryErrorState, colors, spacing, typography } from "@frennix/ui";

const INBOX_ROW_HEIGHT = 84;

const SafeConversationRow = memo(function SafeConversationRow({
  conversation,
  onPress,
  onLongPress,
  onMenuPress,
  onDelete,
  dismissing,
  selectMode,
  selected,
  onToggleSelect,
}: {
  conversation: Conversation;
  onPress: (id: string) => void;
  onLongPress: (conversation: Conversation) => void;
  onMenuPress: (conversation: Conversation) => void;
  onDelete: (conversation: Conversation) => void;
  dismissing: boolean;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: (conversation: Conversation) => void;
}) {
  const handlePress = useCallback(() => onPress(conversation.id), [conversation.id, onPress]);
  const handleLongPress = useCallback(
    () => onLongPress(conversation),
    [conversation, onLongPress]
  );
  const handleMenuPress = useCallback(
    () => onMenuPress(conversation),
    [conversation, onMenuPress]
  );
  const handleDelete = useCallback(() => onDelete(conversation), [conversation, onDelete]);
  const handleToggleSelect = useCallback(
    () => onToggleSelect(conversation),
    [conversation, onToggleSelect]
  );

  const row = (
    <ConversationRow
      conversation={conversation}
      onPress={handlePress}
      onLongPress={handleLongPress}
      onMenuPress={handleMenuPress}
      selectMode={selectMode}
      selected={selected}
      onToggleSelect={handleToggleSelect}
    />
  );

  if (selectMode) {
    return row;
  }

  return (
    <AnimatedDismissRow dismissing={dismissing}>
      <SwipeableActionsRow
        rightActions={[
          {
            label: "Delete",
            onPress: handleDelete,
            accessibilityLabel: "Delete conversation",
          },
        ]}
      >
        {row}
      </SwipeableActionsRow>
    </AnimatedDismissRow>
  );
}, (previous, next) =>
  previous.conversation.id === next.conversation.id &&
  previous.dismissing === next.dismissing &&
  previous.selectMode === next.selectMode &&
  previous.selected === next.selected &&
  previous.conversation.unread_count === next.conversation.unread_count &&
  previous.conversation.is_pinned === next.conversation.is_pinned &&
  previous.conversation.is_muted === next.conversation.is_muted &&
  previous.conversation.marked_unread === next.conversation.marked_unread &&
  previous.conversation.last_message?.id === next.conversation.last_message?.id &&
  previous.conversation.last_message?.content === next.conversation.last_message?.content &&
  previous.conversation.other_participant?.avatar_url ===
    next.conversation.other_participant?.avatar_url &&
  previous.conversation.other_participant?.is_online ===
    next.conversation.other_participant?.is_online
);

export default function MessagesScreen() {
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const isFocused = useIsFocused();
  const pathname = usePathname();
  const isListActive = isFocused && !isChatRoute(pathname);
  const queryClient = useQueryClient();
  const webHeightStyle = useTabScreenWebHeightStyle();
  const [menuConversation, setMenuConversation] = useState<Conversation | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [storyViewerIndex, setStoryViewerIndex] = useState<number | null>(null);
  const [inviteLoadingUserId, setInviteLoadingUserId] = useState<string | null>(null);
  const { isOnline } = useNetworkStatus();
  const inboxVisibleLoggedRef = useRef(false);
  const inboxPaintStartedRef = useRef<number | null>(null);

  useEffect(() => {
    inboxVisibleLoggedRef.current = false;
    inboxPaintStartedRef.current = null;
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    void hydrateMessagesInboxCache(queryClient, userId);
  }, [queryClient, userId]);

  const {
    data: conversations = [],
    refetch,
    isRefetching,
    isFetching,
    isPending,
    isError,
    error,
    isFetchedAfterMount,
  } = useQuery({
    queryKey: ["conversations", userId],
    queryFn: async () => {
      const started = performance.now();
      const result = await getConversations(userId);
      logInboxPerf("inbox-query", started, { count: result.length, source: "network" });
      void writeMessagesInboxCache(userId, result);
      return result;
    },
    enabled: !!userId,
    staleTime: 60_000,
    gcTime: 30 * 60 * 1000,
    networkMode: "offlineFirst",
    placeholderData: (previousData) => previousData,
    initialData: () => queryClient.getQueryData<Conversation[]>(["conversations", userId]),
    initialDataUpdatedAt: () =>
      queryClient.getQueryState(["conversations", userId])?.dataUpdatedAt,
    structuralSharing: (previousData, nextData) =>
      mergeInboxConversations(
        previousData as Conversation[] | undefined,
        nextData as Conversation[]
      ),
    refetchInterval: isListActive ? 60_000 : false,
    refetchIntervalInBackground: false,
  });

  const showListSkeleton = isPending && conversations.length === 0;

  useEffect(() => {
    if (!isListActive || !conversations.length) return;
    if (inboxVisibleLoggedRef.current) return;
    inboxVisibleLoggedRef.current = true;
    const started = inboxPaintStartedRef.current ?? performance.now();
    logInboxPerf("inbox-visible", started, {
      count: conversations.length,
      source: isFetching && !isFetchedAfterMount ? "network" : "cache",
    });
    markInboxVisible(
      userId,
      conversations.length,
      isFetching && !isFetchedAfterMount ? "network" : "cache"
    );
  }, [conversations.length, isFetchedAfterMount, isFetching, isListActive, userId]);

  useEffect(() => {
    if (!isListActive) return;
    inboxPaintStartedRef.current = performance.now();
  }, [isListActive]);

  const patchConversations = useCallback(
    (updater: (current: Conversation[]) => Conversation[]) => {
      queryClient.setQueryData<Conversation[]>(["conversations", userId], (current) =>
        updater(current ?? [])
      );
    },
    [queryClient, userId]
  );

  const getConversationsList = useCallback(
    () => queryClient.getQueryData<Conversation[]>(["conversations", userId]) ?? conversations,
    [conversations, queryClient, userId]
  );

  const {
    pendingDelete,
    requestDelete,
    undoDelete,
    flushPendingDelete,
    isDismissing,
  } = useConversationDeleteUndo({
    userId,
    patchConversations,
    getConversationsList,
  });

  useEffect(() => {
    if (isListActive) return;
    flushPendingDelete();
    setSelectMode(false);
    setSelectedIds(new Set());
    setMenuConversation(null);
  }, [flushPendingDelete, isListActive]);

  const batchDeleteMutation = useMutation({
    mutationFn: (conversationIds: string[]) =>
      deleteConversationsForUser(conversationIds, userId),
    onMutate: async (conversationIds) => {
      await queryClient.cancelQueries({ queryKey: ["conversations", userId] });
      const previous = queryClient.getQueryData<Conversation[]>(["conversations", userId]);
      const selected = new Set(conversationIds);
      patchConversations((current) => current.filter((item) => !selected.has(item.id)));
      return { previous };
    },
    onSuccess: () => {
      setSelectMode(false);
      setSelectedIds(new Set());
    },
    onError: (mutationError, _ids, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["conversations", userId], context.previous);
      }
      showAlert("Could not delete conversations", getErrorMessage(mutationError));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["unread-messages", userId] });
    },
  });

  const batchArchiveMutation = useMutation({
    mutationFn: (conversationIds: string[]) =>
      archiveConversationsForUser(conversationIds, userId),
    onMutate: async (conversationIds) => {
      await queryClient.cancelQueries({ queryKey: ["conversations", userId] });
      const previous = queryClient.getQueryData<Conversation[]>(["conversations", userId]);
      const selected = new Set(conversationIds);
      patchConversations((current) => current.filter((item) => !selected.has(item.id)));
      return { previous };
    },
    onSuccess: () => {
      setSelectMode(false);
      setSelectedIds(new Set());
    },
    onError: (mutationError, _ids, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["conversations", userId], context.previous);
      }
      showAlert("Could not archive conversations", getErrorMessage(mutationError));
    },
  });

  const batchMarkReadMutation = useMutation({
    mutationFn: (conversationIds: string[]) =>
      markConversationsReadForUser(conversationIds, userId),
    onMutate: async (conversationIds) => {
      await queryClient.cancelQueries({ queryKey: ["conversations", userId] });
      const previous = queryClient.getQueryData<Conversation[]>(["conversations", userId]);
      const selected = new Set(conversationIds);
      patchConversations((current) =>
        current.map((item) =>
          selected.has(item.id)
            ? { ...item, unread_count: 0, marked_unread: false }
            : item
        )
      );
      return { previous };
    },
    onSuccess: () => {
      setSelectMode(false);
      setSelectedIds(new Set());
    },
    onError: (mutationError, _ids, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["conversations", userId], context.previous);
      }
      showAlert("Could not mark conversations read", getErrorMessage(mutationError));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["unread-messages", userId] });
    },
  });

  const batchMarkUnreadMutation = useMutation({
    mutationFn: (conversationIds: string[]) =>
      markConversationsUnreadForUser(conversationIds, userId),
    onMutate: async (conversationIds) => {
      await queryClient.cancelQueries({ queryKey: ["conversations", userId] });
      const previous = queryClient.getQueryData<Conversation[]>(["conversations", userId]);
      const selected = new Set(conversationIds);
      patchConversations((current) =>
        current.map((item) =>
          selected.has(item.id)
            ? {
                ...item,
                marked_unread: true,
                unread_count: Math.max(1, item.unread_count ?? 0),
              }
            : item
        )
      );
      return { previous };
    },
    onSuccess: () => {
      setSelectMode(false);
      setSelectedIds(new Set());
    },
    onError: (mutationError, _ids, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["conversations", userId], context.previous);
      }
      showAlert("Could not mark conversations unread", getErrorMessage(mutationError));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["unread-messages", userId] });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (conversationId: string) => archiveConversationForUser(conversationId, userId),
    onMutate: async (conversationId) => {
      await queryClient.cancelQueries({ queryKey: ["conversations", userId] });
      const previous = queryClient.getQueryData<Conversation[]>(["conversations", userId]);
      patchConversations((current) => current.filter((item) => item.id !== conversationId));
      return { previous };
    },
    onError: (mutationError, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["conversations", userId], context.previous);
      }
      showAlert("Could not archive conversation", getErrorMessage(mutationError));
    },
  });

  const preferenceMutation = useMutation({
    mutationFn: async ({
      conversationId,
      action,
    }: {
      conversationId: string;
      action: EntityActionId;
    }) => {
      switch (action) {
        case "pin":
          await pinConversationForUser(conversationId, userId);
          return;
        case "unpin":
          await unpinConversationForUser(conversationId, userId);
          return;
        case "unfavorite":
          await unfavoriteConversationForUser(conversationId, userId);
          return;
        case "mute":
          await muteConversationForUser(conversationId, userId);
          return;
        case "unmute":
          await unmuteConversationForUser(conversationId, userId);
          return;
        case "mark_read":
          await markConversationReadForUser(conversationId, userId);
          return;
        case "mark_unread":
          await markConversationUnreadForUser(conversationId, userId);
          return;
        default:
          return;
      }
    },
    onMutate: async ({ conversationId, action }) => {
      await queryClient.cancelQueries({ queryKey: ["conversations", userId] });
      const previous = queryClient.getQueryData<Conversation[]>(["conversations", userId]);
      const now = new Date().toISOString();

      patchConversations((current) => {
        const next = current.map((item) => {
          if (item.id !== conversationId) return item;
          if (action === "pin") {
            return { ...item, is_pinned: true, pinned_at: now };
          }
          if (action === "unpin") {
            return { ...item, is_pinned: false, pinned_at: null };
          }
          if (action === "unfavorite") {
            return { ...item, is_favorite: false, favorited_at: null };
          }
          if (action === "mute") {
            return { ...item, is_muted: true };
          }
          if (action === "unmute") {
            return { ...item, is_muted: false };
          }
          if (action === "mark_read") {
            return { ...item, unread_count: 0, marked_unread: false };
          }
          if (action === "mark_unread") {
            return {
              ...item,
              marked_unread: true,
              unread_count: Math.max(1, item.unread_count ?? 0),
            };
          }
          return item;
        });

        if (
          action === "pin" ||
          action === "unpin" ||
          action === "unfavorite"
        ) {
          return sortInboxConversations(next);
        }

        return next;
      });

      return { previous };
    },
    onError: (mutationError, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["conversations", userId], context.previous);
      }
      showAlert("Could not update conversation", getErrorMessage(mutationError));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["unread-messages", userId] });
      void queryClient.invalidateQueries({ queryKey: ["favorite-partner-stories", userId] });
    },
  });

  const handleDeleteConversation = useCallback(
    (conversation: Conversation) => {
      requestDelete(conversation);
    },
    [requestDelete]
  );

  const undoSnackbarMessage = pendingDelete
    ? `Conversation with ${
        pendingDelete.conversation.other_participant?.display_name ?? "this person"
      } deleted`
    : "";

  const openConversationMenu = useCallback((conversation: Conversation) => {
    if (selectMode) return;
    setMenuConversation(conversation);
  }, [selectMode]);

  const enterSelectMode = useCallback(() => {
    setMenuConversation(null);
    setSelectMode(true);
    setSelectedIds(new Set());
  }, []);

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  const toggleConversationSelection = useCallback((conversation: Conversation) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(conversation.id)) {
        next.delete(conversation.id);
      } else {
        next.add(conversation.id);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedIds((current) => {
      const allIds = conversations
        .filter((conversation) => !conversation.is_favorite)
        .map((conversation) => conversation.id);
      if (allIds.length > 0 && allIds.every((id) => current.has(id))) {
        return new Set();
      }
      return new Set(allIds);
    });
  }, [conversations]);

  const bulkLoading =
    batchDeleteMutation.isPending ||
    batchArchiveMutation.isPending ||
    batchMarkReadMutation.isPending ||
    batchMarkUnreadMutation.isPending;

  const handleBulkAction = useCallback(
    (action: MessagesBulkAction) => {
      const ids = [...selectedIds];
      if (!ids.length) return;
      flushPendingDelete();

      if (action === "delete") {
        confirmDeleteSelectedConversations(() => {
          batchDeleteMutation.mutate(ids);
        });
        return;
      }

      if (action === "archive") {
        confirmArchiveSelectedConversations(() => {
          batchArchiveMutation.mutate(ids);
        });
        return;
      }

      if (action === "mark_read") {
        batchMarkReadMutation.mutate(ids);
        return;
      }

      batchMarkUnreadMutation.mutate(ids);
    },
    [
      batchArchiveMutation,
      batchDeleteMutation,
      batchMarkReadMutation,
      batchMarkUnreadMutation,
      flushPendingDelete,
      selectedIds,
    ]
  );

  const closeConversationMenu = useCallback(() => {
    setMenuConversation(null);
  }, []);

  const handleConversationMenuAction = useCallback(
    (actionId: EntityActionId) => {
      const conversation = menuConversation;
      closeConversationMenu();
      if (!conversation) return;

      if (actionId === "delete") {
        handleDeleteConversation(conversation);
        return;
      }

      if (actionId === "hide") {
        archiveMutation.mutate(conversation.id);
        return;
      }

      if (
        actionId === "pin" ||
        actionId === "unpin" ||
        actionId === "unfavorite" ||
        actionId === "mute" ||
        actionId === "unmute" ||
        actionId === "mark_read" ||
        actionId === "mark_unread"
      ) {
        preferenceMutation.mutate({ conversationId: conversation.id, action: actionId });
      }
    },
    [
      archiveMutation,
      closeConversationMenu,
      handleDeleteConversation,
      menuConversation,
      preferenceMutation,
    ]
  );

  const conversationMenuActions = useMemo(() => {
    if (!menuConversation) return [];
    return menuConversation.is_favorite
      ? buildFavoritePartnerConversationMenuActions(menuConversation)
      : buildConversationInboxMenuActions(menuConversation);
  }, [menuConversation]);

  const favoriteConversations = useMemo(
    () => conversations.filter((conversation) => conversation.is_favorite),
    [conversations]
  );

  const inboxConversations = useMemo(
    () => conversations.filter((conversation) => !conversation.is_favorite),
    [conversations]
  );

  const favoritePartnerProfiles = useMemo(
    () =>
      favoriteConversations
        .map((conversation) => conversation.other_participant)
        .filter((profile): profile is Profile => Boolean(profile)),
    [favoriteConversations]
  );

  const favoritePartnerIds = useMemo(
    () => favoritePartnerProfiles.map((profile) => profile.id),
    [favoritePartnerProfiles]
  );

  const { data: partnerStories = [] } = useQuery({
    queryKey: ["favorite-partner-stories", userId, favoritePartnerIds],
    queryFn: () => getFeedStoriesForPartners(userId, favoritePartnerProfiles),
    enabled: !!userId && favoritePartnerProfiles.length > 0 && isListActive,
    staleTime: 60_000,
  });

  const partnerStoriesByUserId = useMemo(
    () => new Map(partnerStories.map((story) => [story.user_id, story])),
    [partnerStories]
  );

  const partnerIds = useMemo(
    () =>
      inboxConversations
        .map((conversation) => conversation.other_participant?.id)
        .filter((id): id is string => Boolean(id)),
    [inboxConversations]
  );

  const { realtimeUnavailable } = useProfilesPresence(userId, [
    ...favoritePartnerIds,
    ...partnerIds,
  ]);

  const handlePress = useCallback(
    (id: string) => {
      if (selectMode) return;
      pushScreen(`/chat/${id}`);
    },
    [selectMode]
  );

  const handleFavoritePartnerAction = useCallback(
    async ({ conversation, action }: FavoritePartnerAction) => {
      const partner = conversation.other_participant;
      const partnerId = partner?.id;
      if (!partnerId) return;

      const partnerStory = partnerStoriesByUserId.get(partnerId);
      const latestStoryId = partnerStory?.active_stories.at(-1)?.id ?? null;
      const latestPostId = partnerStory?.active_stories.at(-1)?.post_id ?? null;

      if (action === "message") {
        pushScreen(`/chat/${conversation.id}`);
        return;
      }

      if (action === "profile") {
        if (partner.username) {
          pushScreen(`/user/${partner.username}`);
        }
        return;
      }

      if (action === "story") {
        const index = partnerStories.findIndex(
          (story) => story.user_id === partnerId && story.active_stories.length > 0
        );
        if (index >= 0) {
          setStoryViewerIndex(index);
        } else {
          showAlert("No story", "This partner does not have an active workout story right now.");
        }
        return;
      }

      if (action === "invite_workout") {
        openTrainingCalendarCreate({
          partnerId,
          partnerUsername: partner.username ?? "",
          workoutType: partnerStory?.active_stories.at(-1)?.workout_tag ?? "",
          sourceType: "message_invite",
          storyId: latestStoryId ?? "",
          fromStory: latestStoryId ? "1" : "",
        });
        return;
      }

      if (action === "invite_event") {
        if (!latestStoryId) {
          showAlert(
            "No active story",
            "Invite them to an event after they share a workout story, or message them to plan one."
          );
          return;
        }
        setInviteLoadingUserId(partnerId);
        try {
          await sendStoryEventInvite(userId, partnerId, latestStoryId);
          showAlert("Invite sent", "Your event invite was sent as a message.");
        } catch (inviteError) {
          showAlert("Could not invite", getErrorMessage(inviteError));
        } finally {
          setInviteLoadingUserId(null);
        }
      }
    },
    [partnerStories, partnerStoriesByUserId, userId]
  );

  const handleMarkStoryViewed = useCallback(
    (storyUserId: string, storyId: string | null, slideId: string | null) => {
      if (!storyId || !userId) return;
      void markDedicatedStoryViewed(userId, storyId, slideId, storyUserId).catch(() => undefined);
      queryClient.setQueryData(
        ["favorite-partner-stories", userId, favoritePartnerIds],
        (current: typeof partnerStories | undefined) =>
          (current ?? []).map((story) =>
            story.user_id === storyUserId ? { ...story, viewed: true } : story
          )
      );
    },
    [favoritePartnerIds, queryClient, userId]
  );

  const isConversationDismissing = useCallback(
    (id: string) => isDismissing(id),
    [isDismissing]
  );

  const renderListHeader = useCallback(
    () => (
      <>
        <FavoriteTrainingPartnersSection
          favorites={favoriteConversations}
          partnerStoriesByUserId={partnerStoriesByUserId}
          inviteLoadingUserId={inviteLoadingUserId}
          onAction={handleFavoritePartnerAction}
          onLongPress={openConversationMenu}
        />
      </>
    ),
    [
      favoriteConversations,
      handleFavoritePartnerAction,
      openConversationMenu,
      inviteLoadingUserId,
      partnerStoriesByUserId,
    ]
  );

  const canEditInbox = inboxConversations.length > 0;

  const renderItem = useCallback(
    ({ item }: { item: Conversation }) => (
      <SafeConversationRow
        conversation={item}
        onPress={handlePress}
        onLongPress={openConversationMenu}
        onMenuPress={openConversationMenu}
        onDelete={handleDeleteConversation}
        dismissing={isConversationDismissing(item.id)}
        selectMode={selectMode}
        selected={selectedIds.has(item.id)}
        onToggleSelect={toggleConversationSelection}
      />
    ),
    [
      handleDeleteConversation,
      handlePress,
      isConversationDismissing,
      openConversationMenu,
      selectMode,
      selectedIds,
      toggleConversationSelection,
    ]
  );

  const onRefresh = useGuardedRefresh(
    useCallback(() => {
      void refetch();
      void queryClient.invalidateQueries({ queryKey: ["favorite-partner-stories", userId] });
    }, [queryClient, refetch, userId]),
    { errorTitle: "Could not refresh messages", haptic: true }
  );

  const listRef = useRef<FlatList<Conversation>>(null);
  const { onScroll, isAtTop } = useScrollAtTop();

  useTabScrollRegistration(
    "messages",
    useCallback(
      () =>
        handleTabRetap({
          isAtTop,
          scrollToTop: () => scrollFlatListToTop(listRef.current),
          refresh: () => {
            void onRefresh();
          },
        }),
      [isAtTop, onRefresh]
    )
  );

  if (isError && conversations.length === 0 && !showListSkeleton) {
    return (
      <View style={styles.container}>
        <QueryErrorState
          title="Could not load messages"
          message={getErrorMessage(error)}
          onRetry={() => void refetch()}
        />
      </View>
    );
  }

  return (
    <TabScreenBoundary label="messages">
    <View style={styles.container}>
      {realtimeUnavailable ? (
        <View style={styles.realtimeBanner}>
          <Text style={styles.realtimeBannerText}>
            Live presence updates are temporarily unavailable. Your messages still load normally.
          </Text>
        </View>
      ) : null}
      <MessagesOfflineBanner visible={!isOnline && conversations.length > 0} retrying={isRefetching} />
      <MessagesInboxToolbar
        selectMode={selectMode}
        selectedCount={selectedIds.size}
        totalSelectable={inboxConversations.length}
        canEdit={canEditInbox}
        bulkLoading={bulkLoading}
        onEnterSelectMode={enterSelectMode}
        onExitSelectMode={exitSelectMode}
        onSelectAll={handleSelectAll}
        onBulkAction={handleBulkAction}
      />
      <FlatList
        ref={listRef}
        style={[tabScreenScrollSurface, webHeightStyle]}
        data={inboxConversations}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.list}
        initialNumToRender={14}
        maxToRenderPerBatch={12}
        windowSize={9}
        updateCellsBatchingPeriod={32}
        removeClippedSubviews={Platform.OS !== "web"}
        maintainVisibleContentPosition={{
          minIndexForVisible: 0,
          autoscrollToTopThreshold: 24,
        }}
        extraData={selectMode ? selectedIds : null}
        ListHeaderComponent={renderListHeader}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void onRefresh()}
            tintColor={colors.accent}
          />
        }
        ListEmptyComponent={
          showListSkeleton ? (
            <MessagesListSkeleton />
          ) : inboxConversations.length === 0 && favoriteConversations.length === 0 ? (
            <EmptyState
              title="No messages yet"
              description="Message someone from their profile to find a workout partner or training buddy."
              actionLabel="Discover people"
              onAction={() => switchTab("/(tabs)/discover")}
            />
          ) : null
        }
        ListFooterComponent={<ReportIssueLink area="messages" from="/(tabs)/messages" />}
        renderItem={renderItem}
      />
      <EntityActionSheet
        visible={!!menuConversation}
        title={menuConversation?.other_participant?.display_name ?? "Conversation"}
        actions={conversationMenuActions}
        onSelect={handleConversationMenuAction}
        onClose={closeConversationMenu}
      />
      <FeedStoryViewer
        stories={partnerStories}
        visible={storyViewerIndex !== null}
        initialStoryIndex={storyViewerIndex ?? 0}
        onClose={() => setStoryViewerIndex(null)}
        onViewProfile={(username) => {
          setStoryViewerIndex(null);
          pushScreen(`/user/${username}`);
        }}
        onMarkViewed={handleMarkStoryViewed}
        onInviteToTrain={(storyUserId, _postId) => {
          const feedStory = partnerStories.find((item) => item.user_id === storyUserId);
          const dedicatedStory = feedStory?.active_stories.at(-1) ?? null;
          setStoryViewerIndex(null);
          openStoryWorkoutInvite({
            partnerId: storyUserId,
            partnerUsername: feedStory?.profile.username,
            workoutType: dedicatedStory?.workout_tag ?? null,
            storyId: dedicatedStory?.id ?? null,
          });
        }}
        onInviteToEvent={async (storyUserId, storyId) => {
          setInviteLoadingUserId(storyUserId);
          try {
            await sendStoryEventInvite(userId, storyUserId, storyId);
            showAlert("Invite sent", "Your event invite was sent as a message.");
          } catch (inviteError) {
            showAlert("Could not invite", getErrorMessage(inviteError));
          } finally {
            setInviteLoadingUserId(null);
          }
        }}
      />
      <UndoSnackbar
        visible={!!pendingDelete}
        message={undoSnackbarMessage}
        onUndo={undoDelete}
      />
    </View>
    </TabScreenBoundary>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { flexGrow: 1, paddingBottom: spacing.xxl },
  realtimeBanner: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  realtimeBannerText: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
