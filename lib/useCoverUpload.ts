import * as ImagePicker from "expo-image-picker";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getErrorMessage, updateProfile, uploadCoverImage } from "@frennix/api";
import { useAuth } from "@/providers/AuthProvider";
import { showAlert } from "@/lib/alerts";

export function useCoverUpload() {
  const { session, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pickAndUploadCover(): Promise<string | null> {
    setError(null);

    if (!session?.user.id) {
      const message = "You must be signed in to change your cover photo";
      setError(message);
      showAlert("Cover photo", message);
      return null;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      const message = "Photo library access is required to choose a cover photo";
      setError(message);
      showAlert("Cover photo", message);
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.85,
    });

    if (result.canceled) return null;

    setUploading(true);
    try {
      const asset = result.assets[0];
      const mimeType = asset.mimeType ?? "image/jpeg";
      const file = "file" in asset ? asset.file : undefined;

      const url = await uploadCoverImage(session.user.id, asset.uri, mimeType, file);
      const saved = await updateProfile(session.user.id, { cover_image_url: url });

      await refreshProfile(session.user.id);
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["profile-stats"] });

      return saved.cover_image_url ?? url;
    } catch (e) {
      const message = getErrorMessage(e);
      setError(message);
      showAlert("Cover photo failed", message);
      return null;
    } finally {
      setUploading(false);
    }
  }

  return { pickAndUploadCover, uploading, error, clearError: () => setError(null) };
}
