import { useCallback, useEffect, useState } from "react";
import { AppState, Platform } from "react-native";
import { PwaUpdatePrompt } from "@/components/PwaUpdatePrompt";
import { reloadForPwaUpdate } from "@/lib/pwa-app-update";
import { isWebStandalone } from "@/lib/pwa";
import { runPwaUpdateCheck } from "@/lib/register-pwa-service-worker";

/** Web-only: service worker updates + deployed build refresh for Home Screen PWAs. */
export function PwaBootstrap() {
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);

  const refresh = useCallback(async () => {
    const result = await runPwaUpdateCheck();
    if (!result.reloaded) {
      setShowUpdatePrompt(result.showUpdatePrompt);
    }
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web" || !isWebStandalone()) return;

    void refresh();

    const onVisibility = () => {
      if (document.visibilityState === "visible") void refresh();
    };

    document.addEventListener("visibilitychange", onVisibility);
    const appStateSub = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      appStateSub.remove();
    };
  }, [refresh]);

  const handleReload = useCallback(() => {
    reloadForPwaUpdate("manual");
  }, []);

  return <PwaUpdatePrompt visible={showUpdatePrompt} onReload={handleReload} />;
}
