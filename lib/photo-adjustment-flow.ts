import { router } from "expo-router";

export type PhotoAdjustmentRequest = {
  uri: string;
  mimeType: string;
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
