import { useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { toggleSave } from "@frennix/api";
import type { FeedPage, Post } from "@frennix/types";

function patchPostSaved(post: Post, saved: boolean): Post {
  return { ...post, saved_by_me: !saved };
}

function patchPostsInFeedPage(page: FeedPage, postId: string, saved: boolean): FeedPage {
  return {
    ...page,
    posts: page.posts.map((p) => (p.id === postId ? patchPostSaved(p, saved) : p)),
  };
}

function patchPostsArray(posts: Post[], postId: string, saved: boolean): Post[] {
  return posts.map((p) => (p.id === postId ? patchPostSaved(p, saved) : p));
}

export function useSavePost(userId: string) {
  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: ({ postId, saved }: { postId: string; saved: boolean }) =>
      toggleSave(postId, userId, saved),
    onMutate: async ({ postId, saved }) => {
      await queryClient.cancelQueries({ queryKey: ["feed", userId] });
      await queryClient.cancelQueries({ queryKey: ["saved-posts", userId] });

      const previousFeed = queryClient.getQueryData<InfiniteData<FeedPage>>(["feed", userId]);
      const previousSaved = queryClient.getQueryData<InfiniteData<FeedPage>>([
        "saved-posts",
        userId,
      ]);

      queryClient.setQueryData<InfiniteData<FeedPage>>(["feed", userId], (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => patchPostsInFeedPage(page, postId, saved)),
        };
      });

      queryClient.setQueryData<InfiniteData<FeedPage>>(["saved-posts", userId], (old) => {
        if (!old) return old;
        if (saved) {
          return {
            ...old,
            pages: old.pages.map((page) => patchPostsInFeedPage(page, postId, saved)),
          };
        }
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            posts: page.posts.filter((p) => p.id !== postId),
          })),
        };
      });

      queryClient.setQueriesData<FeedPage>({ queryKey: ["user-posts"] }, (old) => {
        if (!old) return old;
        return patchPostsInFeedPage(old, postId, saved);
      });

      queryClient.setQueriesData<Post[]>({ queryKey: ["group-posts"] }, (old) => {
        if (!old) return old;
        return patchPostsArray(old, postId, saved);
      });

      queryClient.setQueriesData<Post[]>({ queryKey: ["challenge-posts"] }, (old) => {
        if (!old) return old;
        return patchPostsArray(old, postId, saved);
      });

      queryClient.setQueriesData<Post[]>({ queryKey: ["event-posts"] }, (old) => {
        if (!old) return old;
        return patchPostsArray(old, postId, saved);
      });

      queryClient.setQueriesData<Post>({ queryKey: ["post", postId] }, (old) => {
        if (!old) return old;
        return patchPostSaved(old, saved);
      });

      return { previousFeed, previousSaved };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousFeed) {
        queryClient.setQueryData(["feed", userId], context.previousFeed);
      }
      if (context?.previousSaved) {
        queryClient.setQueryData(["saved-posts", userId], context.previousSaved);
      }
    },
    onSettled: (_data, _err, { postId }) => {
      queryClient.invalidateQueries({ queryKey: ["feed", userId] });
      queryClient.invalidateQueries({ queryKey: ["saved-posts", userId] });
      queryClient.invalidateQueries({ queryKey: ["post", postId] });
      queryClient.invalidateQueries({ queryKey: ["user-posts"] });
      queryClient.invalidateQueries({ queryKey: ["group-posts"] });
      queryClient.invalidateQueries({ queryKey: ["challenge-posts"] });
      queryClient.invalidateQueries({ queryKey: ["event-posts"] });
    },
  });

  function toggleSavePost(postId: string, saved: boolean) {
    if (!userId) return;
    saveMutation.mutate({ postId, saved });
  }

  return { toggleSavePost, saveMutation };
}
