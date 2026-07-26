import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { GeocodedPlace } from "@/lib/location-geocode";
import { reverseGeocode } from "@/lib/location-geocode";

const PERMISSION_DENIED_KEY = "frennix:location-permission-denied";

export type DeviceLocationResult =
  | { status: "granted"; place: GeocodedPlace }
  | { status: "denied" }
  | { status: "unavailable"; message: string };

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

function readWebGeolocation(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation is not available on this device"));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      maximumAge: 60_000,
      timeout: 15_000,
    });
  });
}

async function readNativeGeolocation(): Promise<{ latitude: number; longitude: number }> {
  try {
    const Location = await import("expo-location");
    const servicesEnabled = await Location.hasServicesEnabledAsync();
    if (!servicesEnabled) {
      throw new Error("Location services are turned off");
    }

    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== "granted") {
      throw Object.assign(new Error("Location permission denied"), { code: "denied" });
    }

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Low,
    });

    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "denied") {
      throw error;
    }
    throw new Error("Could not read device location");
  }
}

/** Request device location once — never re-prompts after denial (caller checks wasLocationPermissionDenied). */
export async function requestApproximateDeviceLocation(): Promise<DeviceLocationResult> {
  if (await wasLocationPermissionDenied()) {
    return { status: "denied" };
  }

  try {
    const coords =
      Platform.OS === "web"
        ? await readWebGeolocation().then((position) => ({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          }))
        : await readNativeGeolocation();

    const place = await reverseGeocode(coords.latitude, coords.longitude);
    if (!place) {
      return { status: "unavailable", message: "Could not determine your city from location." };
    }

    await clearLocationPermissionDenied();
    return { status: "granted", place };
  } catch (error) {
    const denied =
      (error instanceof GeolocationPositionError && error.code === error.PERMISSION_DENIED) ||
      (error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code?: string }).code === "denied");

    if (denied) {
      await markLocationPermissionDenied();
      return { status: "denied" };
    }

    const message = error instanceof Error ? error.message : "Could not read location";
    return { status: "unavailable", message };
  }
}

/** Non-interactive check for platforms that already granted permission. */
export async function tryReadSavedDeviceLocation(): Promise<DeviceLocationResult> {
  if (Platform.OS === "web") {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      return { status: "unavailable", message: "Geolocation not available" };
    }
    if (navigator.permissions) {
      try {
        const status = await navigator.permissions.query({ name: "geolocation" });
        if (status.state === "denied") {
          await markLocationPermissionDenied();
          return { status: "denied" };
        }
        if (status.state !== "granted") {
          return { status: "unavailable", message: "Location permission not granted" };
        }
      } catch {
        // permissions API unavailable — fall through
      }
    }
  }

  return requestApproximateDeviceLocation();
}
