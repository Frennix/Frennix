import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { reverseGeocode } from "@/lib/location-geocode";
import { withTimeout } from "@/lib/async-timeout";
import {
  DEVICE_LOCATION_TIMEOUT_MS,
  isLocationTimeoutError,
  isPermissionDeniedError,
  LOCATION_STEP_MESSAGES,
  nativeForegroundPermissionAction,
  shouldAttemptDeviceLocationRead,
  type DeviceLocationResult,
  type LiveLocationPermission,
} from "@/lib/signup-location-flow";

const PERMISSION_DENIED_KEY = "frennix:location-permission-denied";

export type { DeviceLocationResult };

export async function wasLocationPermissionDenied(): Promise<boolean> {
  const value = await AsyncStorage.getItem(PERMISSION_DENIED_KEY);
  return value === "1";
}

export async function markLocationPermissionDenied(): Promise<void> {
  await AsyncStorage.setItem(PERMISSION_DENIED_KEY, "1");
}

export async function clearLocationPermissionDenied(): Promise<void> {
  await AsyncStorage.removeItem(PERMISSION_DENIED_KEY);
}

function deniedError(): Error {
  return Object.assign(new Error("Location permission denied"), { code: "denied" });
}

async function readWebPermission(): Promise<LiveLocationPermission> {
  if (typeof navigator === "undefined" || !navigator.permissions?.query) return "unknown";
  try {
    const status = await withTimeout(
      navigator.permissions.query({ name: "geolocation" }),
      2_000,
      "Location permission"
    );
    if (status.state === "granted" || status.state === "denied" || status.state === "prompt") {
      return status.state;
    }
    return "unknown";
  } catch {
    return "unknown";
  }
}

function readWebGeolocation(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation is not available on this device"));
      return;
    }

    // The Geolocation timeout does not start until the permission prompt is answered,
    // and some browsers never settle after a denial. Callers also race withTimeout.
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      maximumAge: 60_000,
      timeout: DEVICE_LOCATION_TIMEOUT_MS,
    });
  });
}

async function readWebCoordinates(): Promise<{ latitude: number; longitude: number }> {
  const livePermission = await readWebPermission();
  const rememberedDenial = await wasLocationPermissionDenied();
  if (!shouldAttemptDeviceLocationRead({ rememberedDenial, livePermission })) {
    throw deniedError();
  }

  const position = await withTimeout(
    readWebGeolocation(),
    DEVICE_LOCATION_TIMEOUT_MS,
    "Device location"
  );
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  };
}

async function readNativeCoordinates(): Promise<{ latitude: number; longitude: number }> {
  const servicesEnabled = await withTimeout(
    Location.hasServicesEnabledAsync(),
    DEVICE_LOCATION_TIMEOUT_MS,
    "Location services"
  );
  if (!servicesEnabled) {
    throw new Error(
      "Location services are turned off. Enter your city manually or continue without location."
    );
  }

  const existing = await withTimeout(
    Location.getForegroundPermissionsAsync(),
    DEVICE_LOCATION_TIMEOUT_MS,
    "Location permission"
  );
  const action = nativeForegroundPermissionAction({
    status: existing.status,
    canAskAgain: existing.canAskAgain,
  });

  if (action === "blocked") {
    throw deniedError();
  }

  if (action === "prompt") {
    const permission = await withTimeout(
      Location.requestForegroundPermissionsAsync(),
      DEVICE_LOCATION_TIMEOUT_MS,
      "Location permission"
    );
    if (permission.status !== "granted") {
      throw deniedError();
    }
  }

  const position = await withTimeout(
    Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Low,
    }),
    DEVICE_LOCATION_TIMEOUT_MS,
    "Device location"
  );

  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  };
}

/** Explicit user request. Times out instead of hanging, including an unanswered permission prompt. */
export async function requestApproximateDeviceLocation(): Promise<DeviceLocationResult> {
  try {
    const coords =
      Platform.OS === "web" ? await readWebCoordinates() : await readNativeCoordinates();

    const place = await reverseGeocode(coords.latitude, coords.longitude);
    if (!place) {
      return { status: "unavailable", message: "Could not determine your city from location." };
    }

    await clearLocationPermissionDenied();
    return { status: "granted", place };
  } catch (error) {
    if (isPermissionDeniedError(error)) {
      await markLocationPermissionDenied();
      return { status: "denied" };
    }

    if (isLocationTimeoutError(error)) {
      return { status: "timeout", message: LOCATION_STEP_MESSAGES.timeout };
    }

    const message = error instanceof Error ? error.message : LOCATION_STEP_MESSAGES.unavailable;
    return { status: "unavailable", message };
  }
}

/** Non-interactive check. Does not prompt when permission is still unanswered. */
export async function tryReadSavedDeviceLocation(): Promise<DeviceLocationResult> {
  if (Platform.OS === "web") {
    const live = await readWebPermission();
    if (live === "denied") {
      await markLocationPermissionDenied();
      return { status: "denied" };
    }
    if (live !== "granted") {
      return { status: "unavailable", message: "Location permission not granted" };
    }
  } else {
    const existing = await Location.getForegroundPermissionsAsync();
    const action = nativeForegroundPermissionAction({
      status: existing.status,
      canAskAgain: existing.canAskAgain,
    });
    if (action === "blocked") {
      await markLocationPermissionDenied();
      return { status: "denied" };
    }
    if (action !== "read") {
      return { status: "unavailable", message: "Location permission not granted" };
    }
  }

  return requestApproximateDeviceLocation();
}
