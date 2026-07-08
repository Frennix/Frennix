import { useEffect } from "react";
import { Platform } from "react-native";
import { usePathname } from "expo-router";
import { useAuth } from "@/providers/AuthProvider";
import {
  getDiagnosticContext,
  logDiagnostic,
  markDiagnosticFailure,
  setDiagnosticContext,
  setDiagnosticScreen,
} from "@/lib/client-diagnostics";
import { reportClientError } from "@/lib/report-client-error";

function patchFetchLogging() {
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  const globalWindow = window as Window & { __frennixFetchPatched?: boolean };
  if (globalWindow.__frennixFetchPatched) return;
  globalWindow.__frennixFetchPatched = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const started = Date.now();
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method ?? (typeof input !== "string" && !(input instanceof URL) ? input.method : "GET");
    try {
      const response = await originalFetch(input, init);
      const { logApiDiagnostic } = await import("@/lib/client-diagnostics");
      logApiDiagnostic({
        method,
        endpoint: url,
        status: response.status,
        durationMs: Date.now() - started,
        ok: response.ok,
      });
      return response;
    } catch (error) {
      const { logApiDiagnostic } = await import("@/lib/client-diagnostics");
      logApiDiagnostic({
        method,
        endpoint: url,
        durationMs: Date.now() - started,
        ok: false,
        error,
      });
      throw error;
    }
  };
}

function installGlobalErrorHandlers() {
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  const globalWindow = window as Window & { __frennixGlobalErrorsInstalled?: boolean };
  if (globalWindow.__frennixGlobalErrorsInstalled) return;
  globalWindow.__frennixGlobalErrorsInstalled = true;

  window.addEventListener("error", (event) => {
    const error = event.error ?? new Error(event.message);
    const { userId, email } = getDiagnosticContext();
    markDiagnosticFailure("window.error", error, { filename: event.filename, lineno: event.lineno });
    void reportClientError({
      source: "window.error",
      error,
      userId,
      email,
      screen: "global",
      extra: { filename: event.filename, lineno: event.lineno, colno: event.colno },
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const { userId, email } = getDiagnosticContext();
    markDiagnosticFailure("unhandledrejection", event.reason);
    void reportClientError({
      source: "unhandledrejection",
      error: event.reason,
      userId,
      email,
      screen: "global",
    });
  });
}

/** Tracks screen, connectivity, fetch, and global JS errors for beta diagnostics. */
export function ClientDiagnosticsBootstrap() {
  const pathname = usePathname();
  const { session } = useAuth();
  const userId = session?.user.id;
  const email = session?.user.email ?? undefined;

  useEffect(() => {
    patchFetchLogging();
    installGlobalErrorHandlers();
    logDiagnostic("bootstrap", "client diagnostics initialized", "info");
  }, []);

  useEffect(() => {
    setDiagnosticContext({ userId, email, online: true });
  }, [userId, email]);

  useEffect(() => {
    if (pathname) setDiagnosticScreen(pathname);
  }, [pathname]);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    const updateOnline = () => {
      setDiagnosticContext({ online: navigator.onLine });
      logDiagnostic("network", navigator.onLine ? "online" : "offline", navigator.onLine ? "info" : "warn");
    };

    updateOnline();
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);

  return null;
}
