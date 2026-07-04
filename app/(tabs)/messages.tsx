import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useIsFocused } from "@react-navigation/native";
import { usePathname } from "expo-router";
import { memo, useCallback, useMemo, useRef, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import {
  deleteConversationForUser,
  favoriteConversationForUser,
  getConversations,
  getErrorMessage,
  getFeedStoriesForPartners,
  hideConversationForUser,
  markConversationUnreadForUser,
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
import { SwipeableActionsRow } from "@/components/SwipeableActionsRow";
import { buildConversationMenuActions } from "@/lib/conversation-menu-actions";
import { pushScreen, switchTab } from "@/lib/press-utils";
import { scrollFlatListToTop, handleTabRetap } from "@/lib/tab-scroll-registry";
import { useScrollAtTop } from "@/lib/useScrollAtTop";
import { useGuardedRefresh } from "@/lib/useGuardedRefresh";
import { useTabScrollRegistration } from "@/lib/useTabScrollRegistration";
import { useProfilesPresence } from "@/lib/useProfilesPresence";
import { useDismissWithAnimation } from "@/lib/useDismissWithAnimation";
import { confirmDeleteConversation, confirmHideConversation, showAlert } from "@/lib/alerts";
import type { EntityActionId } from "@/lib/entity-actions";
import { MessagesListSkeleton } from "@/components/MessagesListSkeleton";
import { EmptyState, QueryErrorState, colors, spacing, typography } from "@frennix/ui";

const SafeConversationRow = memo(function SafeConversationRow({
  conversation,
  onPress,
  onLongPress,
  onHide,
  onDelete,
  dismissing,
}: {
  conversation: Conversation;
  onPress: (id: string) => void;
  onLongPress: (conversation: Conversation) => void;
  onHide: (conversation: Conversation) => void;
  onDelete: (conversation: Conversation) => void;
  dismissing: boolean;
}) {
  return (
    <AnimatedDismissRow dismissing={dismissing}>
      <SwipeableActionsRow
        rightActions={[
          {
            label: "Hide",
            backgroundColor: colors.textMuted,
            onPress: () => onHide(conversation),
            accessibilityLabel: "Hide conversation",
          },
          {
            label: "Delete",
            onPress: () => onDelete(conversation),
            accessibilityLabel: "Delete conversation",
          },
        ]}
      >
        <ConversationRow
          conversation={conversation}
          onPress={() => onPress(conversation.id)}
          onLongPress={() => onLongPress(conversation)}
        />
      </SwipeableActionsRow>
    </AnimatedDismissRow>
  );
});

export default function MessagesScreen() {
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const isFocused = useIsFocused();
  const pathname = usePathname();
  const isListActive = isFocused && !pathname.startsWith("/chat/");
  const queryClient = useQueryClient();
  const [menuConversation, setMenuConversation] = useState<Conversation | null>(null);
  const [storyViewerIndex, setStoryViewerIndex] = useState<number | null>(null);
  const [inviteLoadingUserId, setInviteLoadingUserId] = useState<string | null>(null);

  const { data: conversations = [], refetch, isRefetching, isLoading, isError, error } = useQuery({
    queryKey: ["conversations", userId],
    queryFn: () => getConversations(userId),
    enabled: !!userId && isListActive,
    staleTime: 60_000,
    placeholderData: (previousData) => previousData,
    refetchInterval: isListActive ? 60_000 : false,
    refetchIntervalInBackground: false,
  });

  const patchConversations = useCallback(
    (updater: (current: Conversation[]) => Conversation[]) => {
      queryClient.setQueryData<Conversation[]>(["conversations", userId], (current) =>
        updater(current ?? [])
      );
    },
    [queryClient, userId]
  );

  const hideMutation = useMutation({
    mutationFn: (conversationId: string) => hideConversationForUser(conversationId, userId),
    onMutate: async (conversationId) => {
      await queryClient.cancelQueries({ queryKey: ["conversations", userId] });
      const previous = queryClient.getQueryData<Conversation[]>(["conversations", userId]);
      patchConversations((current) => current.filter((item) => item.id !== conversationId));
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["conversations", userId], context.previous);
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (conversationId: string) => deleteConversationForUser(conversationId, userId),
    onMutate: async (conversationId) => {
      await queryClient.cancelQueries({ queryKey: ["conversations", userId] });
      const previous = queryClient.getQueryData<Conversation[]>(["conversations", userId]);
      patchConversations((current) => current.filter((item) => item.id !== conversationId));
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["conversations", userId], context.previous);
      }
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
        case "favorite":
          await favoriteConversationForUser(conversationId, userId);
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

      patchConversations((current) =>
        current.map((item) => {
          if (item.id !== conversationId) return item;
          if (action === "pin") {
            return { ...item, is_pinned: true, pinned_at: now };
          }
          if (action === "unpin") {
            return { ...item, is_pinned: false, pinned_at: null };
          }
          if (action === "favorite") {
            return { ...item, is_favorite: true, favorited_at: now };
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
          if (action === "mark_unread") {
            return {
              ...item,
              marked_unread: true,
              unread_count: Math.max(1, item.unread_count ?? 0),
            };
          }
          return item;
        })
      );

      return { previous };
    },
    onError: (mutationError, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["conversations", userId], context.previous);
      }
      showAlert("Could not update conversation", getErrorMessage(mutationError));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["conversations", userId] });
      void queryClient.invalidateQueries({ queryKey: ["unread-messages", userId] });
      void queryClient.invalidateQueries({ queryKey: ["favorite-partner-stories", userId] });
    },
  });

  const { requestDismiss: requestHide, isDismissing: isHiding } = useDismissWithAnimation(
    (conversationId) => hideMutation.mutate(conversationId),
    confirmHideConversation
  );

  const { requestDismiss: requestDelete, isDismissing: isDeleting } = useDismissWithAnimation(
    (conversationId) => deleteMutation.mutate(conversationId),
    confirmDeleteConversation
  );

  const handleHideConversation = useCallback(
    (conversation: Conversation) => {
      requestHide(conversation.id);
    },
    [requestHide]
  );

  const handleDeleteConversation = useCallback(
    (conversation: Conversation) => {
      requestDelete(conversation.id);
    },
    [requestDelete]
  );

  const handleLongPressConversation = useCallback((conversation: Conversation) => {
    setMenuConversation(conversation);
  }, []);

  const closeConversationMenu = useCallback(() => {
    setMenuConversation(null);
  }, []);

  const handleConversationMenuAction = useCallback(
    (actionId: EntityActionId) => {
      const conversation = menuConversation;
      closeConversationMenu();
      if (!conversation) return;

      if (actionId === "hide") {
        handleHideConversation(conversation);
        return;
      }

      if (actionId === "delete") {
        handleDeleteConversation(conversation);
        return;
      }

      if (
        actionId === "pin" ||
        actionId === "unpin" ||
        actionId === "favorite" ||
        actionId === "unfavorite" ||
        actionId === "mute" ||
        actionId === "unmute" ||
        actionId === "mark_unread"
      ) {
        preferenceMutation.mutate({ conversationId: conversation.id, action: actionId });
      }
    },
    [
      closeConversationMenu,
      handleDeleteConversation,
      handleHideConversation,
      menuConversation,
      preferenceMutation,
    ]
  );

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

  const handlePress = useCallback((id: string) => {
    pushScreen(`/chat/${id}`);
  }, []);

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
    (storyUserId: string, storyId: string | null) => {
      if (!storyId || !userId) return;
      void markDedicatedStoryViewed(userId, storyId, null, storyUserId).catch(() => undefined);
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
    (id: string) => isHiding(id) || isDeleting(id),
    [isDeleting, isHiding]
  );

  const renderListHeader = useCallback(
    () => (
      <FavoriteTrainingPartnersSection
        favorites={favoriteConversations}
        partnerStoriesByUserId={partnerStoriesByUserId}
        inviteLoadingUserId={inviteLoadingUserId}
        onAction={handleFavoritePartnerAction}
        onLongPress={handleLongPressConversation}
      />
    ),
    [
      favoriteConversations,
      handleFavoritePartnerAction,
      handleLongPressConversation,
      inviteLoadingUserId,
      partnerStoriesByUserId,
    ]
  );

  const renderItem = useCallback(
    ({ item }: { item: Conversation }) => (
      <SafeConversationRow
        conversation={item}
        onPress={handlePress}
        onLongPress={handleLongPressConversation}
        onHide={handleHideConversation}
        onDelete={handleDeleteConversation}
        dismissing={isConversationDismissing(item.id)}
      />
    ),
    [
      handleDeleteConversation,
      handleHideConversation,
      handleLongPressConversation,
      handlePress,
      isConversationDismissing,
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

  if (isError && conversations.length === 0) {
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
    <View style={styles.container}>
      {realtimeUnavailable ? (
        <View style={styles.realtimeBanner}>
          <Text style={styles.realtimeBannerText}>
            Live presence updates are temporarily unavailable. Your messages still load normally.
          </Text>
        </View>
      ) : null}
      <FlatList
        ref={listRef}
        data={inboxConversations}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.list}
        initialNumToRender={12}
        maxToRenderPerBatch={8}
        windowSize={7}
        ListHeaderComponent={renderListHeader}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void onRefresh()}
            tintColor={colors.accent}
          />
        }
        ListEmptyComponent={
          isLoading ? (
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
        actions={menuConversation ? buildConversationMenuActions(menuConversation) : []}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { flexGrow: 1 },
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
