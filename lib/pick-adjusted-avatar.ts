import * as ImagePicker from "expo-image-picker";
import { requestPhotoAdjustment } from "@/lib/photo-adjustment-flow";
import type { AdjustedPhotoResult } from "@/lib/photo-adjustment-flow";
import { showAlert } from "@/lib/alerts";

/** Pick a photo and open the avatar crop/zoom editor before upload. */
export async function pickAdjustedAvatar(): Promise<AdjustedPhotoResult | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    const message = "Photo library access is required to choose a profile picture";
    showAlert("Profile photo", message);
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: false,
    quality: 0.9,
  });

  if (result.canceled) return null;

  const asset = result.assets[0];
  const mimeType = asset.mimeType ?? "image/jpeg";
  const file = "file" in asset ? asset.file ?? undefined : undefined;
  const adjusted = await requestPhotoAdjustment({
    uri: asset.uri,
    mimeType,
    mode: "avatar",
  });

  if (!adjusted) return null;

  return {
    ...adjusted,
    file: adjusted.file ?? file,
  };
}
