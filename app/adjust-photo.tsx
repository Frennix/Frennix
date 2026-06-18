import { router, Stack, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { PhotoAdjustEditor } from "@/components/PhotoAdjustEditor";
import { StackBackButton } from "@/components/StackBackButton";
import {
  cancelPhotoAdjustment,
  completePhotoAdjustment,
} from "@/lib/photo-adjustment-flow";
import { colors } from "@frennix/ui";

function paramValue(value: string | string[] | undefined): string {
  if (value == null) return "";
  return Array.isArray(value) ? value[0] ?? "" : value;
}

export default function AdjustPhotoScreen() {
  const params = useLocalSearchParams<{ uri?: string; mimeType?: string }>();
  const uri = paramValue(params.uri);
  const mimeType = paramValue(params.mimeType) || "image/jpeg";

  function handleCancel() {
    cancelPhotoAdjustment();
    router.back();
  }

  const screenOptions = {
    title: "Adjust photo",
    headerShown: true,
    headerBackVisible: false,
    presentation: "modal" as const,
    headerLeft: () => (
      <StackBackButton
        onBack={() => {
          cancelPhotoAdjustment();
          router.back();
        }}
      />
    ),
  };

  function handleDone(result: { uri: string; mimeType: string; file?: File }) {
    completePhotoAdjustment(result);
    router.back();
  }

  if (!uri) {
    handleCancel();
    return null;
  }

  return (
    <>
      <Stack.Screen options={screenOptions} />
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <PhotoAdjustEditor uri={uri} onDone={handleDone} onCancel={handleCancel} />
      </View>
    </>
  );
}
