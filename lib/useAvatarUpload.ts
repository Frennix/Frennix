import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getErrorMessage, updateProfile, uploadAvatar } from "@frennix/api";
import { useAuth } from "@/providers/AuthProvider";
import { showAlert } from "@/lib/alerts";
import { pickAdjustedAvatar } from "@/lib/pick-adjusted-avatar";

export function useAvatarUpload() {
  const { session, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pickAndUploadAvatar(): Promise<string | null> {
    setError(null);

    if (!session?.user.id) {
      const message = "You must be signed in to change your profile photo";
      setError(message);
      showAlert("Profile photo", message);
      return null;
    }

    setUploading(true);

    try {
      const adjusted = await pickAdjustedAvatar();
      if (!adjusted) {
        return null;
      }

      const url = await uploadAvatar(
        session.user.id,
        adjusted.uri,
        adjusted.mimeType,
        adjusted.file
      );
      const saved = await updateProfile(session.user.id, { avatar_url: url });

      if (!saved.avatar_url) {
        throw new Error("Profile saved but avatar URL is missing from the response");
      }

      await refreshProfile(session.user.id);
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["profile-stats"] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["conversation-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["user-posts"] });

      return saved.avatar_url;
    } catch (e) {
      const message = getErrorMessage(e);
      setError(message);
      showAlert("Profile photo failed", message);
      return null;
    } finally {
      setUploading(false);
    }
  }

  return { pickAndUploadAvatar, uploading, error, clearError: () => setError(null) };
}
