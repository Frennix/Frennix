import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";

export type PickedImage = {
  uri: string;
  mimeType: string;
  file?: File;
};

type PickImageOptions = {
  aspect?: [number, number];
  quality?: number;
};

/** Opens the platform photo picker. On web, skips permission prompts (browser handles access). */
export async function pickImageFromLibrary(options: PickImageOptions = {}): Promise<PickedImage | null> {
  if (Platform.OS !== "web") {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      throw new Error("Photo library access is required to choose a photo");
    }
  }

  const allowsEditing = Platform.OS !== "web" && Boolean(options.aspect);

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing,
    aspect: options.aspect,
    quality: options.quality ?? 0.85,
  });

  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  const file = "file" in asset ? asset.file ?? undefined : undefined;

  return {
    uri: asset.uri,
    mimeType: asset.mimeType ?? "image/jpeg",
    file,
  };
}
