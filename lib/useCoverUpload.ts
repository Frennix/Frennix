import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getErrorMessage, updateProfile, uploadCoverImage } from "@frennix/api";
import { useAuth } from "@/providers/AuthProvider";
import { showAlert } from "@/lib/alerts";
import { pickImageFromLibrary } from "@/lib/pick-image";

export function useCoverUpload() {
  const { session, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  async function pickAndUploadCover(): Promise<string | null> {
    setError(null);

    if (!session?.user.id) {
      const message = "You must be signed in to change your cover photo";
      setError(message);
      showAlert("Cover photo", message);
      return null;
    }

    let picked;
    try {
      picked = await pickImageFromLibrary({ aspect: [16, 9], quality: 0.85 });
    } catch (e) {
      const message = getErrorMessage(e);
      setError(message);
      showAlert("Cover photo", message);
      return null;
    }

    if (!picked) return null;

    setPreviewUri(picked.uri);
    setUploading(true);

    try {
      const url = await uploadCoverImage(
        session.user.id,
        picked.uri,
        picked.mimeType,
        picked.file
      );
      const saved = await updateProfile(session.user.id, { cover_image_url: url });

      if (!saved.cover_image_url) {
        throw new Error("Cover uploaded but cover_image_url is missing from the profile response");
      }

      await refreshProfile(saved);
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["profile-stats"] });
      setPreviewUri(null);

      return saved.cover_image_url;
    } catch (e) {
      const message = getErrorMessage(e);
      console.error("[cover] upload failed", e);
      setError(message);
      showAlert("Cover photo failed", message);
      return null;
    } finally {
      setUploading(false);
    }
  }

  return {
    pickAndUploadCover,
    uploading,
    error,
    previewUri,
    clearError: () => setError(null),
  };
}
