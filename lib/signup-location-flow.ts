import { AsyncTimeoutError } from "./async-timeout";

/** Own timer for device location. Browser geolocation timeouts do not start until the permission prompt is answered. */
export const DEVICE_LOCATION_TIMEOUT_MS = 12_000;

export const LOCATION_STEP_MESSAGES = {
  denied: "Location access denied. Enter your city manually or continue without location.",
  timeout:
    "Location lookup timed out. Try again, enter your city, or continue without location.",
  unavailable:
    "We couldn't read your location. Try again, enter your city, or continue without location.",
} as const;

export type LiveLocationPermission = "granted" | "denied" | "prompt" | "unknown";

export type SignupPlace = {
  city: string;
  state: string | null;
  latitude: number;
  longitude: number;
};

export type DeviceLocationResult =
  | { status: "granted"; place: SignupPlace }
  | { status: "denied" }
  | { status: "timeout"; message: string }
  | { status: "unavailable"; message: string };

export type SignupLocationChoice = "pending" | "device" | "manual" | "skipped";

export type SignupLocationStepState = {
  requestId: number;
  loading: boolean;
  error: string;
  choice: SignupLocationChoice;
  devicePermissionDenied: boolean;
  place: SignupPlace | null;
};

export type SignupLocationEffect =
  | { type: "none" }
  | { type: "device_permission_denied" }
  | { type: "advance"; place: SignupPlace | null; devicePermissionDenied: boolean };

export type SignupLocationReduction = {
  state: SignupLocationStepState;
  effect: SignupLocationEffect;
};

const none = (state: SignupLocationStepState): SignupLocationReduction => ({
  state,
  effect: { type: "none" },
});

export function initialSignupLocationStepState(): SignupLocationStepState {
  return {
    requestId: 0,
    loading: false,
    error: "",
    choice: "pending",
    devicePermissionDenied: false,
    place: null,
  };
}

export function isPermissionDeniedError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: number | string; PERMISSION_DENIED?: number; message?: string };
  if (record.code === "denied" || record.code === 1) return true;
  if (typeof record.PERMISSION_DENIED === "number" && record.code === record.PERMISSION_DENIED) {
    return true;
  }
  return typeof record.message === "string" && /permission denied/i.test(record.message);
}

export function isLocationTimeoutError(error: unknown): boolean {
  if (error instanceof AsyncTimeoutError) return true;
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: number | string; TIMEOUT?: number; name?: string; message?: string };
  if (
    record.name === "AbortError" ||
    record.name === "AsyncTimeoutError" ||
    record.name === "TimeoutError"
  ) {
    return true;
  }
  if (record.code === 3) return true;
  if (typeof record.TIMEOUT === "number" && record.code === record.TIMEOUT) return true;
  return typeof record.message === "string" && /timed out/i.test(record.message);
}

/**
 * A stored denial only blocks the read when the OS still reports denied.
 * Prompt, granted, and unknown stay retryable so a later Allow tap can succeed.
 */
export function shouldAttemptDeviceLocationRead(input: {
  rememberedDenial: boolean;
  livePermission: LiveLocationPermission;
}): boolean {
  if (input.livePermission === "denied") return false;
  if (input.rememberedDenial && input.livePermission === "granted") return true;
  if (input.rememberedDenial && input.livePermission === "prompt") return true;
  if (input.rememberedDenial && input.livePermission === "unknown") return true;
  return true;
}

export function nativeForegroundPermissionAction(permission: {
  status: string;
  canAskAgain?: boolean;
}): "read" | "prompt" | "blocked" {
  if (permission.status === "granted") return "read";
  if (permission.status === "denied" && permission.canAskAgain === false) return "blocked";
  return "prompt";
}

export function beginSignupDeviceLocationRequest(
  state: SignupLocationStepState
): SignupLocationReduction {
  if (state.loading) return none(state);
  return {
    state: {
      ...state,
      requestId: state.requestId + 1,
      loading: true,
      error: "",
      choice: "device",
    },
    effect: { type: "none" },
  };
}

export function applySignupDeviceLocationResult(
  state: SignupLocationStepState,
  requestId: number,
  result: DeviceLocationResult
): SignupLocationReduction {
  if (requestId !== state.requestId || !state.loading) return none(state);

  if (result.status === "granted") {
    return {
      state: {
        ...state,
        loading: false,
        error: "",
        choice: "device",
        devicePermissionDenied: false,
        place: result.place,
      },
      effect: { type: "advance", place: result.place, devicePermissionDenied: false },
    };
  }

  if (result.status === "denied") {
    return {
      state: {
        ...state,
        loading: false,
        error: LOCATION_STEP_MESSAGES.denied,
        choice: "pending",
        devicePermissionDenied: true,
      },
      effect: { type: "device_permission_denied" },
    };
  }

  const message =
    result.status === "timeout"
      ? result.message || LOCATION_STEP_MESSAGES.timeout
      : result.message || LOCATION_STEP_MESSAGES.unavailable;

  return {
    state: {
      ...state,
      loading: false,
      error: message,
      choice: "pending",
    },
    effect: { type: "none" },
  };
}

export function skipSignupDeviceLocation(state: SignupLocationStepState): SignupLocationReduction {
  const next: SignupLocationStepState = {
    ...state,
    requestId: state.requestId + 1,
    loading: false,
    error: "",
    choice: "skipped",
    place: null,
  };
  return {
    state: next,
    effect: {
      type: "advance",
      place: null,
      devicePermissionDenied: next.devicePermissionDenied,
    },
  };
}

export function applySignupManualLocation(
  state: SignupLocationStepState,
  place: SignupPlace
): SignupLocationReduction {
  const next: SignupLocationStepState = {
    ...state,
    requestId: state.requestId + 1,
    loading: false,
    error: "",
    choice: "manual",
    place,
  };
  return {
    state: next,
    effect: {
      type: "advance",
      place,
      devicePermissionDenied: next.devicePermissionDenied,
    },
  };
}

/** Drop an in-flight device read without advancing. Used when opening manual entry or leaving the step. */
export function cancelSignupDeviceLocationRequest(
  state: SignupLocationStepState
): SignupLocationReduction {
  if (!state.loading) return none(state);
  return {
    state: {
      ...state,
      requestId: state.requestId + 1,
      loading: false,
      choice: state.choice === "device" ? "pending" : state.choice,
    },
    effect: { type: "none" },
  };
}
