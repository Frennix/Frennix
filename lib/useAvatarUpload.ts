import * as ImagePicker from "expo-image-picker";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getErrorMessage, updateProfile, uploadAvatar } from "@frennix/api";
import { useAuth } from "@/providers/AuthProvider";
import { showAlert } from "@/lib/alerts";

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

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setUploading(false);
      const message = "Photo library access is required to choose a profile picture";
      setError(message);
      showAlert("Profile photo", message);
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled) {
      setUploading(false);
      return null;
    }

    try {
      const asset = result.assets[0];
      const mimeType = asset.mimeType ?? "image/jpeg";
      const file = "file" in asset ? asset.file : undefined;

      const url = await uploadAvatar(session.user.id, asset.uri, mimeType, file);
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
