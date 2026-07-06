import { useEffect, useState } from "react";
import { Platform } from "react-native";

function readOnlineState() {
  if (Platform.OS === "web" && typeof navigator !== "undefined") {
    return navigator.onLine;
  }
  return true;
}

/** Lightweight connectivity signal for inbox offline UX (web-first). */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(readOnlineState);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return { isOnline };
}
