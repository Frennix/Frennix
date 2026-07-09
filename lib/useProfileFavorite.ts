import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getErrorMessage, setProfileFavorite, setProfileFavoritePinned } from "@frennix/api";
import type { ProfileSocialContext } from "@frennix/types";
import { showAlert } from "@/lib/alerts";

export function useProfileFavorite(currentUserId: string, targetUserId: string) {
  const queryClient = useQueryClient();

  const favoriteMutation = useMutation({
    mutationFn: (favorite: boolean) => setProfileFavorite(currentUserId, targetUserId, favorite),
    onMutate: (favorite) => {
      queryClient.setQueryData<ProfileSocialContext>(
        ["profile-social", currentUserId, targetUserId],
        (old) => (old ? { ...old, isFavorited: favorite, isPinned: favorite ? old.isPinned : false } : old)
      );
    },
    onError: (error) => showAlert("Favorite failed", getErrorMessage(error)),
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: ["profile-social", currentUserId, targetUserId],
      });
      void queryClient.invalidateQueries({ queryKey: ["favorite-profiles", currentUserId] });
    },
  });

  const pinMutation = useMutation({
    mutationFn: (pinned: boolean) => setProfileFavoritePinned(currentUserId, targetUserId, pinned),
    onMutate: (pinned) => {
      queryClient.setQueryData<ProfileSocialContext>(
        ["profile-social", currentUserId, targetUserId],
        (old) => (old ? { ...old, isPinned: pinned, isFavorited: true } : old)
      );
    },
    onError: (error) => showAlert("Pin failed", getErrorMessage(error)),
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: ["profile-social", currentUserId, targetUserId],
      });
      void queryClient.invalidateQueries({ queryKey: ["favorite-profiles", currentUserId] });
    },
  });

  return { favoriteMutation, pinMutation };
}
