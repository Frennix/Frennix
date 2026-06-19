import { router } from "expo-router";

export type PhotoAdjustmentMode = "feed" | "avatar";

export type PhotoAdjustmentRequest = {
  uri: string;
  mimeType: string;
  mode?: PhotoAdjustmentMode;
};

export type AdjustedPhotoResult = {
  uri: string;
  mimeType: string;
  file?: File;
};

let pendingResolve: ((result: AdjustedPhotoResult | null) => void) | null = null;

export function requestPhotoAdjustment(request: PhotoAdjustmentRequest): Promise<AdjustedPhotoResult | null> {
  return new Promise((resolve) => {
    pendingResolve = resolve;
    router.push({
      pathname: "/adjust-photo",
      params: {
        uri: request.uri,
        mimeType: request.mimeType,
        mode: request.mode ?? "feed",
      },
    });
  });
}

export function completePhotoAdjustment(result: AdjustedPhotoResult) {
  pendingResolve?.(result);
  pendingResolve = null;
}

export function cancelPhotoAdjustment() {
  pendingResolve?.(null);
  pendingResolve = null;
}
